"""Начальная схема: справочники направлений, продуктов и вузов

Revision ID: 73a0ab7fcc0e
Revises: 
Create Date: 2026-09-20 01:41:19.918116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Идентификаторы ревизии для Alembic.
revision: str = '73a0ab7fcc0e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Применить миграцию."""
    # ### команды сгенерированы Alembic ###
    op.create_table('it_directions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('it_products',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('vendor', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('vendor', 'name', name='uq_it_products_vendor_name')
    )
    op.create_table('universities',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=500), nullable=False),
    sa.Column('short_name', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    # ### конец команд Alembic ###


def downgrade() -> None:
    """Откатить миграцию."""
    # ### команды сгенерированы Alembic ###
    op.drop_table('universities')
    op.drop_table('it_products')
    op.drop_table('it_directions')
    # ### конец команд Alembic ###
