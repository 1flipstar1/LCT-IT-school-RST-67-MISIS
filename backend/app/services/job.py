"""Shared job persistence helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import Principal
from app.models.job import JobModel
from app.schemas.jobs import JobResponse


def as_job_response(job: JobModel) -> JobResponse:
    return JobResponse.model_validate(job)


def get_job(db: Session, job_id: str, principal: Principal, *, kind: str | None = None) -> JobModel:
    job = db.get(JobModel, job_id)
    if job is None or (kind is not None and job.kind != kind):
        raise APIError(404, "job_not_found", "Задание не найдено.")
    if principal.role != "admin" and job.requester_id != principal.subject:
        raise APIError(404, "job_not_found", "Задание не найдено.")
    return job


def mark_failed(db: Session, job: JobModel, message: str) -> None:
    now = datetime.now(UTC)
    job.status = "failed"
    job.error = message[:4000]
    job.updated_at = now
    job.completed_at = now
    db.commit()
