"""Local demo JWT issuing and optional Keycloak token verification."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import jwt
from jwt import InvalidTokenError, PyJWKClient

from app.core.config import Settings, settings
from app.core.errors import APIError


ROLE_ALIASES = {
    "manager": "manager",
    "kam": "manager",
    "lead": "lead",
    "manager_lead": "lead",
    "admin": "admin",
}


@dataclass(frozen=True, slots=True)
class Principal:
    subject: str
    role: str | None
    name: str | None
    email: str | None
    username: str | None
    claims: dict[str, Any]


def create_demo_token(
    *,
    user_id: str,
    role: str,
    name: str | None = None,
    email: str | None = None,
    config: Settings = settings,
) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_in = config.jwt_expires_seconds
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(seconds=expires_in),
        "iss": config.jwt_issuer,
        "aud": config.jwt_audience,
        "token_use": "demo",
    }
    if name:
        payload["name"] = name
    if email:
        payload["email"] = email
        payload["preferred_username"] = email
    token = jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algorithm)
    return token, expires_in


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True)


def _extract_role(claims: dict[str, Any], config: Settings) -> str | None:
    candidates: list[str] = []
    direct = claims.get("role")
    if isinstance(direct, str):
        candidates.append(direct)

    realm_access = claims.get("realm_access")
    if isinstance(realm_access, dict) and isinstance(realm_access.get("roles"), list):
        candidates.extend(str(role) for role in realm_access["roles"])

    resource_access = claims.get("resource_access")
    if isinstance(resource_access, dict):
        clients = [config.keycloak_client_id] if config.keycloak_client_id else resource_access.keys()
        for client in clients:
            access = resource_access.get(client) if client else None
            if isinstance(access, dict) and isinstance(access.get("roles"), list):
                candidates.extend(str(role) for role in access["roles"])

    for candidate in candidates:
        normalized = candidate.strip().lower().replace("-", "_")
        if normalized in ROLE_ALIASES:
            return ROLE_ALIASES[normalized]
    return None


def _decode_keycloak(token: str, config: Settings) -> dict[str, Any]:
    jwks_url = config.resolved_keycloak_jwks_url
    if not jwks_url or not config.keycloak_issuer_url:
        raise InvalidTokenError("Keycloak is not configured")

    key = _jwks_client(jwks_url).get_signing_key_from_jwt(token).key
    kwargs: dict[str, Any] = {
        "algorithms": ["RS256", "RS384", "RS512"],
        "issuer": config.keycloak_issuer_url.rstrip("/"),
    }
    if config.keycloak_audience:
        kwargs["audience"] = config.keycloak_audience
    else:
        kwargs["options"] = {"verify_aud": False}
    return jwt.decode(token, key=key, **kwargs)


def _decode_local(token: str, config: Settings) -> dict[str, Any]:
    return jwt.decode(
        token,
        key=config.jwt_secret,
        algorithms=[config.jwt_algorithm],
        issuer=config.jwt_issuer,
        audience=config.jwt_audience,
    )


def verify_access_token(token: str, config: Settings = settings) -> Principal:
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = str(unverified.get("iss", "")).rstrip("/")
        keycloak_issuer = (config.keycloak_issuer_url or "").rstrip("/")
        if keycloak_issuer and issuer == keycloak_issuer:
            claims = _decode_keycloak(token, config)
        else:
            claims = _decode_local(token, config)
    except Exception as exc:  # PyJWKClient can raise network errors as well.
        raise APIError(
            401,
            "invalid_token",
            "Токен недействителен или срок его действия истёк.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise APIError(
            401,
            "invalid_token",
            "В токене отсутствует идентификатор пользователя.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Principal(
        subject=subject,
        role=_extract_role(claims, config),
        name=claims.get("name") if isinstance(claims.get("name"), str) else None,
        email=claims.get("email") if isinstance(claims.get("email"), str) else None,
        username=(
            claims.get("preferred_username")
            if isinstance(claims.get("preferred_username"), str)
            else None
        ),
        claims=claims,
    )
