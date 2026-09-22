"""SQLAlchemy engine and session lifecycle."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def build_engine(database_url: str | None = None) -> Engine:
    url = database_url or settings.database_url
    connect_args: dict[str, object] = {}
    if url.startswith("sqlite"):
        # FastAPI sync dependencies can execute in different worker threads.
        connect_args["check_same_thread"] = False

    return create_engine(
        url,
        echo=settings.database_echo,
        pool_pre_ping=not url.startswith("sqlite"),
        connect_args=connect_args,
    )


engine = build_engine()
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Provide one transactional session per request."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_database_schema() -> None:
    # Importing the model registers it on Base.metadata.
    from app.models.base import Base
    from app.models.attachment import AttachmentModel  # noqa: F401
    from app.models.state import StateSnapshotModel  # noqa: F401

    Base.metadata.create_all(bind=engine)
