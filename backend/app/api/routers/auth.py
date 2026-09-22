"""Demo authentication and bearer identity endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.core.config import settings
from app.core.errors import APIError
from app.core.security import create_demo_token
from app.schemas.auth import (
    CurrentUserResponse,
    DemoLoginRequest,
    DemoLoginResponse,
)
from app.schemas.common import ERROR_RESPONSES
from app.services.state import get_state


router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_USER_BY_ROLE = {
    "manager": "usr-1",
    "lead": "usr-6",
    "admin": "usr-8",
}

DEMO_USER_FALLBACKS = {
    "manager": {
        "id": "usr-1",
        "name": "Алина Воронова",
        "email": "a.voronova@rt.ru",
        "role": "manager",
        "active": True,
        "access": {"scope": "own", "directionIds": []},
    },
    "lead": {
        "id": "usr-6",
        "name": "Алексей Козлов",
        "email": "a.kozlov@rt.ru",
        "role": "lead",
        "active": True,
        "access": {"scope": "team", "directionIds": []},
    },
    "admin": {
        "id": "usr-8",
        "name": "Ирина Смирнова",
        "email": "i.smirnova@rt.ru",
        "role": "admin",
        "active": True,
        "access": {"scope": "all", "directionIds": []},
    },
}


def _demo_user(db: DbSession, role: str) -> dict[str, object]:
    users = get_state(db).state.get("users", [])
    user_id = DEMO_USER_BY_ROLE[role]
    if isinstance(users, list):
        user = next(
            (
                candidate
                for candidate in users
                if isinstance(candidate, dict) and candidate.get("id") == user_id
            ),
            None,
        )
        if user is not None:
            return user
    return DEMO_USER_FALLBACKS[role].copy()


@router.post(
    "/demo",
    response_model=DemoLoginResponse,
    responses={422: ERROR_RESPONSES[422]},
    summary="Войти в демо-режиме с выбранной ролью",
)
def demo_login(payload: DemoLoginRequest, db: DbSession) -> DemoLoginResponse:
    if not settings.effective_demo_auth_enabled:
        raise APIError(403, "demo_auth_disabled", "Демо-вход отключён.")

    role = payload.role.value
    user = _demo_user(db, role)
    token, expires_in = create_demo_token(
        user_id=str(user["id"]),
        role=role,
        name=str(user.get("name")) if user.get("name") else None,
        email=str(user.get("email")) if user.get("email") else None,
    )
    return DemoLoginResponse(
        access_token=token,
        token_type="Bearer",
        user=user,
        expires_in=expires_in,
    )


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить пользователя из Bearer-токена",
)
def current_user(principal: CurrentPrincipal) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=principal.subject,
        role=principal.role,
        name=principal.name,
        email=principal.email,
        username=principal.username,
    )
