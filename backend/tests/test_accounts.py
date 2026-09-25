"""Accounts are created and managed from the CRM and stay in sync with Keycloak."""

from __future__ import annotations

import json
import re

from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services import keycloak_admin
from app.services.accounts import generate_password


REAL_CLIENT = httpx.Client
GROUPS = {"g-kam": "Менеджеры по вузам", "g-lead": "Руководители", "g-admin": "Администраторы"}


def _headers(client: TestClient, role: str) -> dict[str, str]:
    token = client.post("/api/v1/auth/demo", json={"role": role}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _users(response) -> list[dict]:
    return response.json()["snapshot"]["state"]["users"]


class FakeKeycloak:
    """Just enough of the Admin REST API to observe what the CRM asks Keycloak to do."""

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}
        self.memberships: dict[str, set[str]] = {}
        self.logouts: list[str] = []
        self.passwords: dict[str, dict] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/protocol/openid-connect/token"):
            return httpx.Response(200, json={"access_token": "service-token", "expires_in": 300})
        assert request.headers["Authorization"] == "Bearer service-token"
        route = path.split("/admin/realms/it-school", 1)[1]
        if route == "/groups":
            return httpx.Response(200, json=[{"id": group_id, "name": name} for group_id, name in GROUPS.items()])
        if route == "/users" and request.method == "POST":
            body = json.loads(request.content)
            if any(user["email"] == body["email"] for user in self.users.values()):
                return httpx.Response(409, json={"errorMessage": "User exists with same email"})
            user_id = f"kc-{uuid4().hex[:12]}"
            self.users[user_id] = {**body, "id": user_id}
            self.memberships[user_id] = set()
            self.passwords[user_id] = body["credentials"][0]
            return httpx.Response(201, headers={"Location": f"http://kc/admin/realms/it-school/users/{user_id}"})
        match = re.fullmatch(r"/users/([^/]+)(/.*)?", route)
        user_id, rest = match.group(1), match.group(2) or ""
        if user_id not in self.users:
            return httpx.Response(404, json={"error": "User not found"})
        if rest == "" and request.method == "GET":
            return httpx.Response(200, json=self.users[user_id])
        if rest == "" and request.method == "DELETE":
            self.users.pop(user_id)
            return httpx.Response(204)
        if rest == "" and request.method == "PUT":
            self.users[user_id].update(json.loads(request.content))
            return httpx.Response(204)
        if rest == "/groups":
            return httpx.Response(200, json=[{"id": group_id, "name": GROUPS[group_id]} for group_id in self.memberships[user_id]])
        if rest.startswith("/groups/"):
            group_id = rest.rsplit("/", 1)[1]
            (self.memberships[user_id].add if request.method == "PUT" else self.memberships[user_id].discard)(group_id)
            return httpx.Response(204)
        if rest == "/logout":
            self.logouts.append(user_id)
            return httpx.Response(204)
        if rest == "/reset-password":
            self.passwords[user_id] = json.loads(request.content)
            return httpx.Response(204)
        raise AssertionError(f"unexpected {request.method} {route}")


@pytest.fixture()
def fake_keycloak(monkeypatch) -> FakeKeycloak:
    fake = FakeKeycloak()
    monkeypatch.setattr(settings, "keycloak_admin_url", "http://kc")
    monkeypatch.setattr(settings, "keycloak_issuer_url", "http://kc/realms/it-school")
    monkeypatch.setattr(settings, "keycloak_admin_client_id", "rtk-it-school-admin")
    monkeypatch.setattr(settings, "keycloak_admin_client_secret", "secret")
    transport = httpx.MockTransport(fake)
    monkeypatch.setattr(keycloak_admin.httpx, "Client", lambda **kwargs: REAL_CLIENT(transport=transport, **kwargs))
    return fake


def test_password_matches_realm_policy() -> None:
    for _ in range(50):
        password = generate_password()
        assert len(password) >= 12
        assert re.search(r"[a-z]", password) and re.search(r"[A-Z]", password) and re.search(r"\d", password) and re.search(r"[!#%*+\-=?@]", password)


def test_admin_creates_account_in_keycloak_and_crm(client: TestClient, fake_keycloak: FakeKeycloak) -> None:
    admin = _headers(client, "admin")
    response = client.post(
        "/api/v1/accounts",
        json={"name": "Павел Новиков", "email": "P.Novikov@rt.ru", "role": "lead"},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["keycloak"] is True and len(body["temporaryPassword"]) >= 12
    kc_user = fake_keycloak.users[body["userId"]]
    assert kc_user["username"] == "p.novikov" and kc_user["requiredActions"] == ["UPDATE_PASSWORD"]
    assert fake_keycloak.passwords[body["userId"]]["temporary"] is True
    assert fake_keycloak.memberships[body["userId"]] == {"g-lead"}
    card = next(user for user in _users(response) if user["id"] == body["userId"])
    assert card == {"id": body["userId"], "name": "Павел Новиков", "email": "p.novikov@rt.ru", "role": "lead", "leadId": None, "active": True, "access": {"scope": "team", "directionIds": []}}

    role = client.put(f"/api/v1/accounts/{body['userId']}/role", json={"role": "admin"}, headers=admin)
    assert role.status_code == 200
    assert fake_keycloak.memberships[body["userId"]] == {"g-admin"}

    blocked = client.put(f"/api/v1/accounts/{body['userId']}/status", json={"active": False}, headers=admin)
    assert blocked.status_code == 200
    assert fake_keycloak.users[body["userId"]]["enabled"] is False and fake_keycloak.logouts == [body["userId"]]
    assert next(user for user in _users(blocked) if user["id"] == body["userId"])["active"] is False

    reset = client.post(f"/api/v1/accounts/{body['userId']}/password", headers=admin)
    assert reset.status_code == 200
    assert fake_keycloak.passwords[body["userId"]]["value"] == reset.json()["temporaryPassword"]

    duplicate = client.post("/api/v1/accounts", json={"name": "Павел Новиков", "email": "p.novikov@rt.ru"}, headers=admin)
    assert duplicate.status_code == 409


def test_lead_manages_only_managers_of_own_team(client: TestClient, fake_keycloak: FakeKeycloak) -> None:
    lead = _headers(client, "lead")
    created = client.post("/api/v1/accounts", json={"name": "Вера Лис", "email": "v.lis@rt.ru", "role": "manager", "leadId": "usr-7"}, headers=lead)
    assert created.status_code == 200, created.text
    card = next(user for user in _users(created) if user["id"] == created.json()["userId"])
    assert card["leadId"] == "usr-6" and card["access"]["scope"] == "own", "менеджер попадает в команду того, кто создал"
    assert fake_keycloak.memberships[card["id"]] == {"g-kam"}

    assert client.post("/api/v1/accounts", json={"name": "Кто-то Главный", "email": "boss@rt.ru", "role": "admin"}, headers=lead).status_code == 403
    assert client.put(f"/api/v1/accounts/{card['id']}/role", json={"role": "lead"}, headers=lead).status_code == 403
    assert client.post(f"/api/v1/accounts/{card['id']}/password", headers=lead).status_code == 200
    # Менеджер чужой команды (usr-3 у руководителя usr-7) — недоступен.
    assert client.put("/api/v1/accounts/usr-3/status", json={"active": False}, headers=lead).status_code == 403


def test_without_keycloak_the_crm_card_is_still_created(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "keycloak_admin_client_secret", None)
    admin = _headers(client, "admin")
    response = client.post("/api/v1/accounts", json={"name": "Иван Демо", "email": "i.demo@rt.ru", "role": "manager", "leadId": "usr-6"}, headers=admin)
    assert response.status_code == 200, response.text
    assert response.json()["keycloak"] is False and response.json()["temporaryPassword"] is None
    assert client.get("/api/v1/accounts/status", headers=admin).json()["keycloak"] is False
    assert client.post("/api/v1/accounts", json={"name": "Нет Прав", "email": "x@rt.ru"}, headers=_headers(client, "manager")).status_code == 403
    assert client.put("/api/v1/accounts/usr-8/role", json={"role": "manager"}, headers=admin).status_code == 409, "свою роль менять нельзя"


def test_onboarding_is_remembered_on_the_server(client: TestClient) -> None:
    manager = _headers(client, "manager")
    done = client.put("/api/v1/me/onboarding", json={"status": "skipped"}, headers=manager)
    assert done.status_code == 200, done.text
    me = next(user for user in done.json()["state"]["users"] if user["id"] == "usr-1")
    assert me["onboarding"]["status"] == "skipped"
    reset = client.put("/api/v1/me/onboarding", json={"status": "reset"}, headers=manager)
    assert "onboarding" not in next(user for user in reset.json()["state"]["users"] if user["id"] == "usr-1")
    assert client.put("/api/v1/me/onboarding", json={"status": "later"}, headers=manager).status_code == 422
