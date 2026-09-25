"""Account management: CRM users backed by Keycloak identities."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.common import APIModel
from app.schemas.state import StateSnapshotResponse


CrmRole = Literal["manager", "lead", "admin"]
DataScope = Literal["own", "team", "all"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=60, pattern=r"^[a-zA-Z0-9._-]+$")]


class AccountAccess(APIModel):
    scope: DataScope = "own"
    direction_ids: list[str] = Field(default_factory=list, max_length=100)


class AccountCreateRequest(APIModel):
    name: Name
    email: Email
    username: Username | None = None
    role: CrmRole = "manager"
    lead_id: str | None = Field(default=None, max_length=64)
    access: AccountAccess | None = None


class AccountRoleRequest(APIModel):
    role: CrmRole


class AccountStatusRequest(APIModel):
    active: bool


class AccountsStatus(APIModel):
    keycloak: bool
    realm: str | None
    admin_console_url: str | None


class AccountResult(APIModel):
    user_id: str
    # Пароль показывается один раз: его передают сотруднику, при первом входе он задаёт свой.
    temporary_password: str | None = None
    keycloak: bool
    snapshot: StateSnapshotResponse
