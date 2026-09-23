"""Asynchronous report generation and artifact download endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from urllib.parse import quote

from fastapi import APIRouter, Response, status

from app.api.dependencies import CurrentPrincipal, DbSession
from app.core.errors import APIError
from app.infrastructure.broker import publish_task
from app.infrastructure.storage import get_object_storage
from app.models.job import JobModel
from app.schemas.jobs import JobResponse, ReportJobRequest
from app.services.job import as_job_response, get_job, mark_failed


router = APIRouter(prefix="/report-jobs", tags=["reports"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, summary="Поставить формирование отчёта в очередь")
def create_report_job(payload: ReportJobRequest, db: DbSession, principal: CurrentPrincipal) -> JobResponse:
    width = len(payload.table.header)
    if any(len(row) != width for row in payload.table.body):
        raise APIError(422, "invalid_report_table", "Число значений в строке не совпадает с числом колонок.")
    serialized = payload.model_dump_json().encode("utf-8")
    if len(serialized) > 20 * 1024 * 1024:
        raise APIError(413, "report_too_large", "Данные отчёта превышают допустимый размер.")
    now = datetime.now(UTC)
    job_id = str(uuid.uuid4())
    source_key = f"reports/{job_id}/request.json"
    get_object_storage().put(source_key, serialized, "application/json")
    job = JobModel(
        id=job_id,
        kind="report",
        status="queued",
        requester_id=principal.subject,
        source_key=source_key,
        payload={"name": payload.name, "format": payload.format},
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.commit()
    try:
        publish_task("report.generate", job.id)
    except Exception as exc:
        mark_failed(db, job, "Не удалось поставить отчёт в очередь.")
        raise APIError(503, "queue_unavailable", "Очередь заданий временно недоступна.") from exc
    db.refresh(job)
    return as_job_response(job)


@router.get("/{job_id}", response_model=JobResponse, summary="Получить статус отчёта")
def report_job_status(job_id: str, db: DbSession, principal: CurrentPrincipal) -> JobResponse:
    return as_job_response(get_job(db, job_id, principal, kind="report"))


@router.get("/{job_id}/download", summary="Скачать готовый отчёт")
def download_report(job_id: str, db: DbSession, principal: CurrentPrincipal) -> Response:
    job = get_job(db, job_id, principal, kind="report")
    if job.status != "completed" or not job.result_key:
        raise APIError(409, "report_not_ready", "Отчёт ещё не готов.")
    data = get_object_storage().get(job.result_key)
    filename = (job.result or {}).get("filename") or job.original_name or "report.bin"
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    return Response(content=data, media_type=job.content_type or "application/octet-stream", headers=headers)
