"""add attachment metadata

Revision ID: 20260922_02
Revises: 20260922_01
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922_02"
down_revision: Union[str, Sequence[str], None] = "20260922_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("original_name", sa.String(length=500), nullable=False),
        sa.Column("stored_name", sa.String(length=80), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stored_name"),
    )
    op.create_index("ix_attachments_uploaded_by", "attachments", ["uploaded_by"])


def downgrade() -> None:
    op.drop_index("ix_attachments_uploaded_by", table_name="attachments")
    op.drop_table("attachments")
