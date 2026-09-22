"""Server-owned integration operations."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.core.errors import APIError
from app.schemas.common import ERROR_RESPONSES
from app.schemas.integration import IntegrationIngestRequest, IntegrationSyncResult
from app.services.integration import SUPPORTED_SOURCES, fetch_records, ingest_records, record_failed_sync


router = APIRouter(prefix="/integrations", tags=["integrations"])


def _require_manager_role(principal: CurrentPrincipal) -> None:
    if principal.role not in {"lead", "admin"}:
        raise APIError(403, "forbidden", "Управлять интеграциями может руководитель или администратор.")


@router.post(
    "/{source_id}/ingest",
    response_model=IntegrationSyncResult,
    responses=ERROR_RESPONSES,
    summary="Принять согласованный JSON из LMS или сайта",
)
def ingest(
    source_id: str,
    payload: IntegrationIngestRequest,
    db: DbSession,
    principal: CurrentPrincipal,
) -> IntegrationSyncResult:
    _require_manager_role(principal)
    return ingest_records(db, source_id=source_id, records=payload.records, principal=principal)


@router.post(
    "/{source_id}/sync",
    response_model=IntegrationSyncResult,
    responses=ERROR_RESPONSES,
    summary="Запросить JSON у настроенного API LMS или сайта",
)
def sync(
    source_id: str,
    db: DbSession,
    principal: CurrentPrincipal,
) -> IntegrationSyncResult:
    _require_manager_role(principal)
    if source_id not in SUPPORTED_SOURCES:
        raise APIError(404, "integration_source_not_found", "Источник интеграции не найден.")
    try:
        records = fetch_records(source_id)
    except APIError as error:
        if error.status_code not in {502, 503}:
            raise
        return record_failed_sync(db, source_id=source_id, principal=principal, error=error)
    return ingest_records(db, source_id=source_id, records=records, principal=principal)
