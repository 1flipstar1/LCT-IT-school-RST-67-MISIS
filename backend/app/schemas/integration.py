"""External LMS and website integration contracts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.state import StateSnapshotResponse


class IntegrationIngestRequest(APIModel):
    records: list[dict[str, Any]] = Field(min_length=1, max_length=5000)


class IntegrationSyncResult(APIModel):
    log_entry: dict[str, Any]
    snapshot: StateSnapshotResponse


class IntegrationSourceRuntime(APIModel):
    source_id: Literal["lms", "site"]
    mode: Literal["remote", "mock", "unconfigured"]
    url_configured: bool
    token_configured: bool


class IntegrationRuntimeStatus(APIModel):
    sources: list[IntegrationSourceRuntime]
    scheduler_enabled: bool
