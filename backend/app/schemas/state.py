"""Versioned state synchronization contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import APIModel


class StateSnapshotResponse(APIModel):
    state: dict[str, Any]
    revision: int = Field(ge=1)
    updated_at: datetime


class StateUpdateRequest(APIModel):
    state: dict[str, Any]
    expected_revision: int | None = Field(default=None, ge=1)
    force: bool = False


class StateResetRequest(APIModel):
    expected_revision: int | None = Field(default=None, ge=1)
    force: bool = False


class CollectionResponse(APIModel):
    items: list[Any]
    total: int = Field(ge=0)
    revision: int = Field(ge=1)
    updated_at: datetime


class DataResponse(APIModel):
    data: dict[str, Any]
    revision: int = Field(ge=1)
    updated_at: datetime
