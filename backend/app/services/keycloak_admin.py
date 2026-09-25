"""Minimal Keycloak Admin REST client for account management from the CRM.

Authenticates as the confidential service client ``rtk-it-school-admin`` (client
credentials) which has only ``manage-users``/``view-users``/``query-*`` rights in the
realm. Roles are granted through groups, so a role change is a group swap.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import Settings, settings
from app.core.errors import APIError


# Роль CRM → группа Keycloak (группа выдаёт роль realm: kam / manager_lead / admin).
ROLE_GROUPS = {
    "manager": "Менеджеры по вузам",
    "lead": "Руководители",
    "admin": "Администраторы",
}
TIMEOUT_SECONDS = 10


class KeycloakAdmin:
    def __init__(self, config: Settings = settings) -> None:
        if not config.keycloak_admin_configured:
            raise APIError(503, "keycloak_admin_not_configured", "Управление учётными записями Keycloak не настроено.")
        self._base = config.keycloak_admin_base_url
        self._realm = config.keycloak_realm
        self._client_id = config.keycloak_admin_client_id
        self._client_secret = config.keycloak_admin_client_secret
        self._token: str | None = None
        self._token_expires = 0.0
        self._groups: dict[str, str] | None = None

    # ---------- транспорт ----------

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=TIMEOUT_SECONDS, trust_env=False)

    def _access_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires:
            return self._token
        try:
            with self._client() as client:
                response = client.post(
                    f"{self._base}/realms/{self._realm}/protocol/openid-connect/token",
                    data={"grant_type": "client_credentials", "client_id": self._client_id, "client_secret": self._client_secret},
                )
        except httpx.RequestError as exc:
            raise APIError(503, "keycloak_unavailable", "Keycloak не отвечает. Попробуйте позже.") from exc
        if response.status_code != 200:
            raise APIError(503, "keycloak_admin_auth_failed", "CRM не смогла авторизоваться в Keycloak: проверьте служебный клиент и секрет.")
        payload = response.json()
        self._token = payload["access_token"]
        self._token_expires = time.monotonic() + max(10, int(payload.get("expires_in", 60)) - 10)
        return self._token

    def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        url = f"{self._base}/admin/realms/{self._realm}{path}"
        try:
            with self._client() as client:
                response = client.request(method, url, headers={"Authorization": f"Bearer {self._access_token()}"}, **kwargs)
        except httpx.RequestError as exc:
            raise APIError(503, "keycloak_unavailable", "Keycloak не отвечает. Попробуйте позже.") from exc
        if response.status_code == 409:
            raise APIError(409, "account_exists", "Пользователь с таким логином или почтой уже есть в Keycloak.")
        if response.status_code == 400:
            detail = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            message = detail.get("error_description") or detail.get("errorMessage") or "Keycloak отклонил данные."
            raise APIError(422, "keycloak_rejected", f"Keycloak отклонил данные: {message}")
        if response.status_code == 404:
            raise APIError(404, "account_not_found", "Учётная запись не найдена в Keycloak.")
        if response.status_code >= 300:
            raise APIError(502, "keycloak_error", "Keycloak вернул ошибку.", {"status": response.status_code})
        return response

    # ---------- группы ----------

    def _group_ids(self) -> dict[str, str]:
        if self._groups is None:
            groups = self._request("GET", "/groups", params={"briefRepresentation": "true", "max": 100}).json()
            self._groups = {group["name"]: group["id"] for group in groups}
        missing = [name for name in ROLE_GROUPS.values() if name not in self._groups]
        if missing:
            raise APIError(503, "keycloak_groups_missing", "В realm нет групп ролей CRM.", {"groups": missing})
        return self._groups

    # ---------- операции ----------

    def create_user(self, *, username: str, email: str, first_name: str, last_name: str, password: str, role: str) -> str:
        response = self._request(
            "POST",
            "/users",
            json={
                "username": username,
                "email": email,
                "firstName": first_name,
                "lastName": last_name,
                "enabled": True,
                "emailVerified": True,
                "attributes": {"locale": ["ru"]},
                # Временный пароль: при первом входе Keycloak попросит задать свой.
                "credentials": [{"type": "password", "value": password, "temporary": True}],
                "requiredActions": ["UPDATE_PASSWORD"],
            },
        )
        user_id = response.headers.get("Location", "").rstrip("/").rsplit("/", 1)[-1]
        if not user_id:
            raise APIError(502, "keycloak_error", "Keycloak не вернул идентификатор нового пользователя.")
        try:
            self.set_role(user_id, role)
        except APIError:
            # Без роли учётная запись бесполезна — не оставляем «полусозданного» пользователя.
            self.delete_user(user_id)
            raise
        return user_id

    def set_role(self, user_id: str, role: str) -> None:
        groups = self._group_ids()
        target = groups[ROLE_GROUPS[role]]
        for current in self._request("GET", f"/users/{user_id}/groups").json():
            if current["id"] in groups.values() and current["id"] != target:
                self._request("DELETE", f"/users/{user_id}/groups/{current['id']}")
        self._request("PUT", f"/users/{user_id}/groups/{target}")

    def set_enabled(self, user_id: str, enabled: bool) -> None:
        self._request("PUT", f"/users/{user_id}", json={"enabled": enabled})
        if not enabled:
            # Заблокированный сотрудник сразу теряет активные сессии.
            self._request("POST", f"/users/{user_id}/logout")

    def reset_password(self, user_id: str, password: str) -> None:
        self._request("PUT", f"/users/{user_id}/reset-password", json={"type": "password", "value": password, "temporary": True})

    def delete_user(self, user_id: str) -> None:
        try:
            self._request("DELETE", f"/users/{user_id}")
        except APIError:
            pass

    def exists(self, user_id: str) -> bool:
        try:
            self._request("GET", f"/users/{user_id}")
            return True
        except APIError as exc:
            if exc.code == "account_not_found":
                return False
            raise
