"""import history with rollback snapshots

Revision ID: 20260926_01
Revises: 20260922_02
Create Date: 2026-09-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260926_01"
down_revision: Union[str, Sequence[str], None] = "20260922_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

json_type = sa.JSON().with_variant(postgresql.JSONB(none_as_null=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("attachment_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("options", json_type, nullable=False),
        sa.Column("stats", json_type, nullable=False),
        sa.Column("issues", json_type, nullable=False),
        sa.Column("snapshot_before", json_type, nullable=False),
        sa.Column("revision_after", sa.BigInteger(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column("created_by_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rolled_back_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rolled_back_by_name", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_import_jobs_created_by", "import_jobs", ["created_by"])
    op.create_index("ix_import_jobs_created_at", "import_jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_import_jobs_created_at", table_name="import_jobs")
    op.drop_index("ix_import_jobs_created_by", table_name="import_jobs")
    op.drop_table("import_jobs")
