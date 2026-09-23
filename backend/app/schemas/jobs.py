"""Public contracts for import and report jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import APIModel


class JobResponse(APIModel):
    id: str
    kind: Literal["import", "report"]
    status: Literal["queued", "processing", "ready", "completed", "failed"]
    original_name: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class ImportMappingRequest(APIModel):
    mapping: dict[str, int | str] = Field(default_factory=dict)


class ImportPreviewResponse(APIModel):
    stats: dict[str, int]
    issues: list[dict[str, Any]]


class ReportTable(APIModel):
    header: list[str] = Field(min_length=1, max_length=50)
    body: list[list[Any]] = Field(min_length=1, max_length=50_000)


class ReportJobRequest(APIModel):
    name: str = Field(min_length=1, max_length=240)
    format: Literal["xlsx", "xls", "pdf"]
    summary: str = Field(default="", max_length=1000)
    table: ReportTable
    filters: dict[str, Any] | None = None
    columns: list[str] | None = None
