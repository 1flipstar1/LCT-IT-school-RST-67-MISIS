"""Reusable FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import APIError
from app.core.security import Principal, verify_access_token


bearer_scheme = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]


def optional_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal | None:
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        raise APIError(
            401,
            "unauthorized",
            "Используйте Bearer-токен для доступа к API.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_access_token(credentials.credentials)


def state_access_principal(
    principal: Annotated[Principal | None, Depends(optional_principal)],
) -> Principal | None:
    if principal is not None or settings.anonymous_state_access:
        return principal
    raise APIError(
        401,
        "unauthorized",
        "Для доступа к данным требуется авторизация.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticated_principal(
    principal: Annotated[Principal | None, Depends(optional_principal)],
) -> Principal:
    if principal is None:
        raise APIError(
            401,
            "unauthorized",
            "Для выполнения запроса требуется авторизация.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


StateAccess = Annotated[Principal | None, Depends(state_access_principal)]
CurrentPrincipal = Annotated[Principal, Depends(authenticated_principal)]


def require_roles(*roles: str) -> Callable[[Principal], Principal]:
    """Build a dependency that rejects authenticated users without a role."""

    allowed = frozenset(roles)

    def dependency(principal: CurrentPrincipal) -> Principal:
        if principal.role not in allowed:
            raise APIError(403, "forbidden", "Недостаточно прав для выполнения операции.")
        return principal

    return dependency
