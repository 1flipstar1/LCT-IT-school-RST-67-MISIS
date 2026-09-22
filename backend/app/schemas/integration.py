"""External LMS and website integration contracts."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.state import StateSnapshotResponse


class IntegrationIngestRequest(APIModel):
    records: list[dict[str, Any]] = Field(min_length=1, max_length=5000)


class IntegrationSyncResult(APIModel):
    log_entry: dict[str, Any]
    snapshot: StateSnapshotResponse
