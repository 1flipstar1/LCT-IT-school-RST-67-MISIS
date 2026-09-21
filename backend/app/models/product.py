from uuid import UUID, uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ITProductModel(Base):
    __tablename__ = "it_products"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    vendor: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "vendor",
            "name",
            name="uq_it_products_vendor_name",
        ),
    )