"""Operational health endpoint."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import text

from app.api.dependencies import DbSession
from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Проверить доступность API и базы данных",
    response_description="Service health",
)
def health(db: DbSession) -> dict[str, object]:
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "database": "ok",
        "timestamp": datetime.now(UTC),
    }
