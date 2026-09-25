"""Creating employees, changing their role and access, resetting passwords.

Keycloak owns the identity (login, password, role group); the CRM state owns the
employee card (name, e-mail, team, data scope). Every operation changes both, so the
role in the token and the role in the CRM never diverge. Without a configured Keycloak
admin client the CRM card is still managed, and the UI says that sign-in is not set up.
"""

from __future__ import annotations

import secrets
import string
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import Principal
from app.domain.state import find_principal_user, project_state_for_principal
from app.schemas.accounts import AccountCreateRequest, AccountResult, AccountsStatus
from app.services.keycloak_admin import KeycloakAdmin
from app.services.state import get_state, mutate_state


ROLE_LABELS = {"manager": "Менеджер", "lead": "Руководитель", "admin": "Администратор"}
DEFAULT_SCOPE = {"manager": "own", "lead": "team", "admin": "all"}
AUDIT_LIMIT = 500


def generate_password(length: int = 14) -> str:
    """Временный пароль под политику realm: заглавные, строчные, цифры и спецсимволы."""

    alphabet = string.ascii_letters + string.digits + "!#%*+-=?@"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(char.islower() for char in password)
            and any(char.isupper() for char in password)
            and any(char.isdigit() for char in password)
            and any(char in "!#%*+-=?@" for char in password)
        ):
            return password


def _admin() -> KeycloakAdmin | None:
    return KeycloakAdmin() if settings.keycloak_admin_configured else None


def accounts_status() -> AccountsStatus:
    base = settings.keycloak_issuer_url.split("/realms/", 1)[0] if settings.keycloak_issuer_url else None
    return AccountsStatus(
        keycloak=settings.keycloak_admin_configured,
        realm=settings.keycloak_realm,
        admin_console_url=f"{base}/admin/master/console/#/{settings.keycloak_realm}/users" if base and settings.keycloak_realm else None,
    )


def _actor(state: dict[str, Any], principal: Principal) -> dict[str, Any]:
    if principal.role not in {"admin", "lead"}:
        raise APIError(403, "forbidden", "Управлять учётными записями может администратор или руководитель.")
    return find_principal_user(state, principal)


def _target(state: dict[str, Any], user_id: str) -> dict[str, Any]:
    user = next((item for item in state["users"] if item.get("id") == user_id), None)
    if user is None:
        raise APIError(404, "account_not_found", "Сотрудник не найден.")
    return user


def _require_team_member(actor: dict[str, Any], principal: Principal, target: dict[str, Any]) -> None:
    """Руководитель управляет только менеджерами своей команды, администратор — всеми."""

    if principal.role == "admin":
        return
    if target.get("role") != "manager" or target.get("leadId") != actor["id"]:
        raise APIError(403, "forbidden", "Руководитель управляет только менеджерами своей команды.")


def _audit(state: dict[str, Any], actor: dict[str, Any], text: str, target: dict[str, Any]) -> None:
    entry = {
        "id": f"audit-account-{uuid4().hex[:12]}",
        "at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "userId": actor["id"],
        "text": text,
        "target": {"type": "user", "id": target["id"], "label": target.get("name", "")},
    }
    state["audit"] = [entry, *state.get("audit", [])][:AUDIT_LIMIT]


def _result(snapshot, principal: Principal, user_id: str, *, password: str | None = None) -> AccountResult:
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    return AccountResult(user_id=user_id, temporary_password=password, keycloak=settings.keycloak_admin_configured, snapshot=snapshot)


def create_account(db: Session, payload: AccountCreateRequest, principal: Principal) -> AccountResult:
    current = get_state(db).state
    actor = _actor(current, principal)
    role = payload.role
    lead_id = payload.lead_id
    if principal.role == "lead":
        # Руководитель заводит только менеджеров к себе в команду.
        if role != "manager":
            raise APIError(403, "forbidden", "Руководитель может создавать только менеджеров.")
        lead_id = actor["id"]
    if role != "manager":
        lead_id = None
    elif lead_id and not any(item["id"] == lead_id and item.get("role") == "lead" for item in current["users"]):
        raise APIError(422, "invalid_lead", "Выбранный руководитель не найден.")
    if any(str(item.get("email", "")).casefold() == payload.email for item in current["users"]):
        raise APIError(409, "account_exists", "Сотрудник с такой почтой уже есть в CRM.")

    first_name, _, last_name = payload.name.partition(" ")
    username = payload.username or payload.email.split("@", 1)[0]
    password = None
    admin = _admin()
    if admin:
        password = generate_password()
        user_id = admin.create_user(username=username, email=payload.email, first_name=first_name, last_name=last_name or first_name, password=password, role=role)
    else:
        user_id = f"usr-{uuid4().hex[:10]}"

    access = payload.access.model_dump() if payload.access else {"scope": DEFAULT_SCOPE[role], "direction_ids": []}
    card = {
        "id": user_id,
        "name": payload.name,
        "email": payload.email,
        "role": role,
        "leadId": lead_id,
        "active": True,
        "access": {"scope": access["scope"] if principal.role == "admin" else "own", "directionIds": access["direction_ids"]},
    }

    def add(state: dict[str, Any]) -> None:
        state["users"] = [*state["users"], card]
        _audit(state, actor, f"Создана учётная запись: {ROLE_LABELS[role].lower()}", card)

    try:
        snapshot, _ = mutate_state(db, add)
    except APIError:
        if admin:
            admin.delete_user(user_id)
        raise
    return _result(snapshot, principal, user_id, password=password)


def change_role(db: Session, user_id: str, role: str, principal: Principal) -> AccountResult:
    current = get_state(db).state
    actor = _actor(current, principal)
    if principal.role != "admin":
        raise APIError(403, "forbidden", "Менять роль может только администратор.")
    if user_id == actor["id"]:
        raise APIError(409, "own_role", "Свою роль изменить нельзя — попросите другого администратора.")
    target = _target(current, user_id)
    admin = _admin()
    if admin and admin.exists(user_id):
        admin.set_role(user_id, role)

    def update(state: dict[str, Any]) -> None:
        user = _target(state, user_id)
        user["role"] = role
        if role != "manager":
            user["leadId"] = None
        # Руководителю по умолчанию видна команда, администратору — всё.
        if role != "manager" and user.get("access", {}).get("scope") == "own":
            user["access"] = {**user.get("access", {}), "scope": DEFAULT_SCOPE[role]}
        if role != "lead":
            for member in state["users"]:
                if member.get("leadId") == user_id:
                    member["leadId"] = None
        _audit(state, actor, f"Роль изменена на «{ROLE_LABELS[role]}»", target)

    snapshot, _ = mutate_state(db, update)
    return _result(snapshot, principal, user_id)


def set_active(db: Session, user_id: str, active: bool, principal: Principal) -> AccountResult:
    current = get_state(db).state
    actor = _actor(current, principal)
    if user_id == actor["id"]:
        raise APIError(409, "own_account", "Нельзя заблокировать свою учётную запись.")
    target = _target(current, user_id)
    _require_team_member(actor, principal, target)
    admin = _admin()
    if admin and admin.exists(user_id):
        admin.set_enabled(user_id, active)

    def update(state: dict[str, Any]) -> None:
        _target(state, user_id)["active"] = active
        _audit(state, actor, "Доступ восстановлен" if active else "Доступ заблокирован", target)

    snapshot, _ = mutate_state(db, update)
    return _result(snapshot, principal, user_id)


def reset_password(db: Session, user_id: str, principal: Principal) -> AccountResult:
    current = get_state(db).state
    actor = _actor(current, principal)
    target = _target(current, user_id)
    _require_team_member(actor, principal, target)
    admin = _admin()
    if admin is None:
        raise APIError(503, "keycloak_admin_not_configured", "Пароли хранит Keycloak, а он не подключён к CRM.")
    if not admin.exists(user_id):
        raise APIError(404, "account_not_found", "У сотрудника нет учётной записи в Keycloak.")
    password = generate_password()
    admin.reset_password(user_id, password)

    def update(state: dict[str, Any]) -> None:
        _audit(state, actor, "Выдан временный пароль", target)

    snapshot, _ = mutate_state(db, update)
    return _result(snapshot, principal, user_id, password=password)
