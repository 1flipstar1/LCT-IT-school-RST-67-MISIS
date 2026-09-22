"""Canonical state snapshot synchronization endpoints."""

from __future__ import annotations

from typing import Annotated

import json

from fastapi import APIRouter, Body
from fastapi.responses import Response

from app.api.dependencies import CurrentPrincipal, DbSession, StateAccess
from app.schemas.common import ERROR_RESPONSES
from app.schemas.state import (
    StateResetRequest,
    StateSnapshotResponse,
    StateUpdateRequest,
)
from app.services.state import get_state_for_principal, replace_state, reset_state


router = APIRouter(prefix="/state", tags=["state"])


@router.get(
    "",
    response_model=StateSnapshotResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить актуальное состояние приложения",
)
def read_state(db: DbSession, principal: StateAccess) -> StateSnapshotResponse:
    return get_state_for_principal(db, principal)


@router.get(
    "/export",
    responses={401: ERROR_RESPONSES[401]},
    summary="Скачать результирующее состояние в JSON",
)
def export_state(db: DbSession, principal: StateAccess) -> Response:
    snapshot = get_state_for_principal(db, principal)
    content = json.dumps(
        snapshot.model_dump(mode="json", by_alias=True),
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")
    return Response(
        content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="crm-state.json"'},
    )


@router.put(
    "",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Сохранить состояние с контролем ревизии",
)
def write_state(
    payload: StateUpdateRequest,
    db: DbSession,
    principal: CurrentPrincipal,
) -> StateSnapshotResponse:
    return replace_state(
        db,
        payload.state,
        expected_revision=payload.expected_revision,
        force=payload.force,
        principal=principal,
    )


@router.post(
    "/reset",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Вернуть исходные демо-данные",
)
def restore_seed_state(
    db: DbSession,
    principal: CurrentPrincipal,
    payload: Annotated[StateResetRequest | None, Body()] = None,
) -> StateSnapshotResponse:
    request = payload or StateResetRequest()
    return reset_state(
        db,
        expected_revision=request.expected_revision,
        force=request.force,
        principal=principal,
    )
