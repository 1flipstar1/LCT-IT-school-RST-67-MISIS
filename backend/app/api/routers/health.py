"""Operational health endpoint."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import text

from app.api.dependencies import DbSession
from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get(
    "/health/live",
    summary="Проверить, что HTTP-процесс запущен",
    response_description="Process liveness",
)
def liveness() -> dict[str, object]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(UTC),
    }


@router.get(
    "/health",
    summary="Проверить готовность API и базы данных",
    response_description="Service readiness",
)
def health(db: DbSession) -> dict[str, object]:
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "database": "ok",
        "storage": settings.job_storage_backend,
        "queue": settings.job_queue_backend,
        "integrations": {
            source_id: settings.integration_mode(source_id)
            for source_id in ("lms", "site")
        },
        "timestamp": datetime.now(UTC),
    }
