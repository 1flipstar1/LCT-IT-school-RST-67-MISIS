"""Metadata for files stored outside the aggregate JSON snapshot."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AttachmentModel(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
