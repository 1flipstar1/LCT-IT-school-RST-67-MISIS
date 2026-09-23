"""use JSONB for aggregate and job payloads on PostgreSQL

Revision ID: 20260923_02
Revises: 20260923_01
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260923_02"
down_revision: Union[str, Sequence[str], None] = "20260923_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.alter_column(
        "state_snapshots",
        "state",
        existing_type=postgresql.JSON(),
        type_=postgresql.JSONB(),
        existing_nullable=False,
        postgresql_using="state::jsonb",
    )
    for column_name in ("payload", "result"):
        op.alter_column(
            "jobs",
            column_name,
            existing_type=postgresql.JSON(),
            type_=postgresql.JSONB(),
            existing_nullable=True,
            postgresql_using=f"{column_name}::jsonb",
        )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.alter_column(
        "state_snapshots",
        "state",
        existing_type=postgresql.JSONB(),
        type_=postgresql.JSON(),
        existing_nullable=False,
        postgresql_using="state::json",
    )
    for column_name in ("payload", "result"):
        op.alter_column(
            "jobs",
            column_name,
            existing_type=postgresql.JSONB(),
            type_=postgresql.JSON(),
            existing_nullable=True,
            postgresql_using=f"{column_name}::json",
        )
