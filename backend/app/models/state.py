"""Persistent aggregate snapshot used by the browser client."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Integer, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


json_type = JSON().with_variant(JSONB(none_as_null=False), "postgresql")


class StateSnapshotModel(Base):
    """The application is a single versioned aggregate for reliable sync.

    The fixed primary key makes the invariant explicit and lets PUT use an
    atomic compare-and-swap on ``revision`` in both SQLite and PostgreSQL.
    """

    __tablename__ = "state_snapshots"
    __table_args__ = (CheckConstraint("id = 1", name="ck_state_snapshots_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    state: Mapped[dict[str, Any]] = mapped_column(json_type, nullable=False)
    revision: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
