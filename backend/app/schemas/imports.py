"""Import history contract: the browser plans the change, the server applies and records it."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.state import StateSnapshotResponse


# Collections an import may replace. Workflows, users and settings are never touched by a file.
ImportCollection = Literal["universities", "programs", "products", "interactions", "events"]


class ImportIssue(APIModel):
    row_number: int = Field(ge=1)
    level: Literal["error", "warning"]
    message: str = Field(max_length=500)


class ImportCreateRequest(APIModel):
    file_name: str = Field(min_length=1, max_length=255)
    attachment_id: str | None = Field(default=None, max_length=36)
    expected_revision: int = Field(ge=1)
    summary: str = Field(default="", max_length=500)
    options: dict[str, bool] = Field(default_factory=dict)
    stats: dict[str, int] = Field(default_factory=dict)
    issues: list[ImportIssue] = Field(default_factory=list, max_length=5000)
    changes: dict[ImportCollection, list[dict[str, Any]]] = Field(min_length=1)


class ImportJob(APIModel):
    id: str
    file_name: str
    attachment_id: str | None
    status: Literal["applied", "rolled_back"]
    summary: str
    options: dict[str, Any]
    stats: dict[str, Any]
    issue_count: int
    created_by_name: str
    created_at: datetime
    rolled_back_at: datetime | None
    rolled_back_by_name: str | None
    can_rollback: bool


class ImportJobDetail(ImportJob):
    issues: list[dict[str, Any]]


class ImportApplyResponse(APIModel):
    job: ImportJob
    snapshot: StateSnapshotResponse


class ImportRollbackRequest(APIModel):
    force: bool = False
