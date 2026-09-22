"""Authentication request and response models."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import Field

from app.schemas.common import APIModel


class DemoRole(StrEnum):
    manager = "manager"
    lead = "lead"
    admin = "admin"


class DemoLoginRequest(APIModel):
    role: DemoRole


class DemoLoginResponse(APIModel):
    access_token: str
    token_type: str = "Bearer"
    user: dict[str, Any]
    expires_in: int = Field(gt=0)


class CurrentUserResponse(APIModel):
    id: str
    role: str | None = None
    name: str | None = None
    email: str | None = None
    username: str | None = None
