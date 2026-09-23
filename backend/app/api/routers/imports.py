"""Asynchronous XLS/XLSX catalog import endpoints."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.dependencies import DbSession, require_roles
from app.core.config import settings
from app.core.errors import APIError
from app.core.security import Principal
from app.infrastructure.broker import publish_task
from app.infrastructure.storage import get_object_storage
from app.models.job import JobModel
from app.schemas.jobs import ImportMappingRequest, ImportPreviewResponse, JobResponse
from app.services.import_plan import build_import_plan
from app.services.job import as_job_response, get_job, mark_failed
from app.services.state import get_state


router = APIRouter(prefix="/imports", tags=["imports"])
ImportPrincipal = Annotated[Principal, Depends(require_roles("lead", "admin"))]
SUPPORTED_EXTENSIONS = {".xls", ".xlsx"}


@router.post("", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, summary="Загрузить XLS/XLSX для разбора")
async def upload_import(file: Annotated[UploadFile, File()], db: DbSession, principal: ImportPrincipal) -> JobResponse:
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise APIError(415, "unsupported_import_format", "Поддерживаются только файлы XLS и XLSX.")
    data = await file.read(settings.max_upload_bytes + 1)
    if not data:
        raise APIError(422, "import_empty_file", "Выбран пустой файл.")
    if len(data) > settings.max_upload_bytes:
        raise APIError(413, "import_too_large", "Файл превышает допустимый размер.", {"maxBytes": settings.max_upload_bytes})

    job_id = str(uuid.uuid4())
    source_key = f"imports/{job_id}/source{extension}"
    get_object_storage().put(source_key, data, file.content_type or "application/octet-stream")
    now = datetime.now(UTC)
    job = JobModel(
        id=job_id,
        kind="import",
        status="queued",
        requester_id=principal.subject,
        original_name=filename,
        content_type=file.content_type,
        size_bytes=len(data),
        source_key=source_key,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.commit()
    try:
        publish_task("import.parse", job.id)
    except Exception as exc:
        mark_failed(db, job, "Не удалось поставить разбор файла в очередь.")
        raise APIError(503, "queue_unavailable", "Очередь заданий временно недоступна.") from exc
    db.refresh(job)
    return as_job_response(job)


@router.get("/{job_id}", response_model=JobResponse, summary="Получить статус импорта")
def import_status(job_id: str, db: DbSession, principal: ImportPrincipal) -> JobResponse:
    return as_job_response(get_job(db, job_id, principal, kind="import"))


def _parsed_rows(job: JobModel) -> list[list[object]]:
    if not job.parsed_key:
        raise APIError(409, "import_not_ready", "Файл ещё не разобран.")
    return json.loads(get_object_storage().get(job.parsed_key).decode("utf-8"))


@router.post("/{job_id}/preview", response_model=ImportPreviewResponse, summary="Проверить сопоставление и данные")
def preview_import(job_id: str, payload: ImportMappingRequest, db: DbSession, principal: ImportPrincipal) -> ImportPreviewResponse:
    job = get_job(db, job_id, principal, kind="import")
    if job.status != "ready":
        raise APIError(409, "import_not_ready", "Файл ещё не готов к проверке.")
    plan = build_import_plan(_parsed_rows(job), payload.mapping, get_state(db).state)
    return ImportPreviewResponse(stats=plan["stats"], issues=plan["issues"])


@router.post("/{job_id}/apply", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, summary="Применить импорт")
def apply_import(job_id: str, payload: ImportMappingRequest, db: DbSession, principal: ImportPrincipal) -> JobResponse:
    job = get_job(db, job_id, principal, kind="import")
    if job.status != "ready":
        raise APIError(409, "import_not_ready", "Импорт нельзя применить в текущем состоянии.")
    # Validate before queueing so mapping errors are returned synchronously.
    build_import_plan(_parsed_rows(job), payload.mapping, get_state(db).state)
    job.payload = {"mapping": payload.mapping}
    job.result = None
    job.status = "queued"
    job.error = None
    job.updated_at = datetime.now(UTC)
    db.commit()
    try:
        publish_task("import.apply", job.id)
    except Exception as exc:
        mark_failed(db, job, "Не удалось поставить импорт в очередь.")
        raise APIError(503, "queue_unavailable", "Очередь заданий временно недоступна.") from exc
    db.refresh(job)
    return as_job_response(job)
