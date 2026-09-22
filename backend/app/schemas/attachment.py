"""Attachment API contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class AttachmentResponse(APIModel):
    id: str
    name: str
    size: int = Field(ge=0)
    content_type: str | None = None
    download_url: str
    created_at: datetime
