"""Catalog imports from Excel/CSV: apply, history, rollback."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Query

from app.api.dependencies import CurrentPrincipal, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.schemas.imports import ImportApplyResponse, ImportCreateRequest, ImportJob, ImportJobDetail, ImportRollbackRequest
from app.services import imports


router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", response_model=ImportApplyResponse, responses=ERROR_RESPONSES, summary="Применить проверенный импорт и записать его в историю")
def create_import(payload: ImportCreateRequest, db: DbSession, principal: CurrentPrincipal) -> ImportApplyResponse:
    return imports.apply_import(db, payload, principal)


@router.get("", response_model=list[ImportJob], responses=ERROR_RESPONSES, summary="История импортов")
def list_imports(db: DbSession, principal: CurrentPrincipal, limit: Annotated[int, Query(ge=1, le=100)] = 30) -> list[ImportJob]:
    return imports.list_imports(db, principal, limit=limit)


@router.get("/{job_id}", response_model=ImportJobDetail, responses=ERROR_RESPONSES, summary="Импорт с замечаниями по строкам")
def read_import(job_id: str, db: DbSession, principal: CurrentPrincipal) -> ImportJobDetail:
    return imports.get_import(db, job_id, principal)


@router.post("/{job_id}/rollback", response_model=ImportApplyResponse, responses=ERROR_RESPONSES, summary="Отменить импорт целиком")
def rollback_import(
    job_id: str,
    db: DbSession,
    principal: CurrentPrincipal,
    payload: Annotated[ImportRollbackRequest | None, Body()] = None,
) -> ImportApplyResponse:
    return imports.rollback_import(db, job_id, principal, force=bool(payload and payload.force))
