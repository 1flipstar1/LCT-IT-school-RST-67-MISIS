"""Очередь уведомлений Telegram (telegram_deliveries)

Revision ID: 20260928_01
Revises: 20260926_01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260928_01"
down_revision: Union[str, Sequence[str], None] = "20260926_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_deliveries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("chat_id", sa.BigInteger(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", "chat_id", name="uq_telegram_delivery_event_chat"),
    )
    op.create_index("ix_telegram_deliveries_pending", "telegram_deliveries", ["delivered_at", "next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_telegram_deliveries_pending", table_name="telegram_deliveries")
    op.drop_table("telegram_deliveries")
