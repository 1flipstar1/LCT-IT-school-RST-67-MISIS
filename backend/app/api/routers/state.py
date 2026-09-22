"""Canonical state snapshot synchronization endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body

from app.api.dependencies import DbSession, StateAccess
from app.schemas.common import ERROR_RESPONSES
from app.schemas.state import (
    StateResetRequest,
    StateSnapshotResponse,
    StateUpdateRequest,
)
from app.services.state import get_state, replace_state, reset_state


router = APIRouter(prefix="/state", tags=["state"])


@router.get(
    "",
    response_model=StateSnapshotResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить актуальное состояние приложения",
)
def read_state(db: DbSession, _: StateAccess) -> StateSnapshotResponse:
    return get_state(db)


@router.put(
    "",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Сохранить состояние с контролем ревизии",
)
def write_state(
    payload: StateUpdateRequest,
    db: DbSession,
    _: StateAccess,
) -> StateSnapshotResponse:
    return replace_state(
        db,
        payload.state,
        expected_revision=payload.expected_revision,
        force=payload.force,
    )


@router.post(
    "/reset",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Вернуть исходные демо-данные",
)
def restore_seed_state(
    db: DbSession,
    _: StateAccess,
    payload: Annotated[StateResetRequest | None, Body()] = None,
) -> StateSnapshotResponse:
    request = payload or StateResetRequest()
    return reset_state(
        db,
        expected_revision=request.expected_revision,
        force=request.force,
    )
