"""History of catalog imports with the data needed to roll one back."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


json_type = JSON().with_variant(JSONB(none_as_null=False), "postgresql")


class ImportJobModel(Base):
    """One applied Excel/CSV import.

    ``snapshot_before`` keeps the collections the import replaced, so the
    import can be undone as a whole; ``revision_after`` tells whether anyone
    changed the data since.
    """

    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    attachment_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="applied")
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    options: Mapped[dict[str, Any]] = mapped_column(json_type, nullable=False, default=dict)
    stats: Mapped[dict[str, Any]] = mapped_column(json_type, nullable=False, default=dict)
    issues: Mapped[list[dict[str, Any]]] = mapped_column(json_type, nullable=False, default=list)
    snapshot_before: Mapped[dict[str, Any]] = mapped_column(json_type, nullable=False, default=dict)
    revision_after: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_by_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True)
    rolled_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rolled_back_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
