"""Persistence and optimistic-concurrency operations for the state aggregate."""

from __future__ import annotations

import copy
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.models.state import StateSnapshotModel
from app.schemas.state import StateSnapshotResponse


logger = logging.getLogger(__name__)
SINGLETON_ID = 1


def empty_state() -> dict[str, Any]:
    """A shape-safe fallback; normally ``seed_state.json`` supplies demo data."""

    return {
        "version": 5,
        "universities": [],
        "directions": [],
        "programs": [],
        "products": [],
        "users": [],
        "workflows": [],
        "interactions": [],
        "events": [],
        "metrics": [],
        "inbox": [],
        "integrations": {"sources": [], "log": []},
        "reports": [],
        "audit": [],
    }


def load_seed_state(path: Path | None = None) -> dict[str, Any]:
    seed_path = path or settings.seed_state_path
    if not seed_path.is_file():
        logger.warning("Seed file %s does not exist; using an empty state", seed_path)
        return empty_state()

    try:
        state = json.loads(seed_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Could not read seed state %s: %s", seed_path, exc)
        return empty_state()

    if not isinstance(state, dict):
        logger.error("Seed state %s must contain a JSON object", seed_path)
        return empty_state()
    return state


def _validate_size(state: dict[str, Any]) -> None:
    size = len(json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    if size > settings.max_state_bytes:
        raise APIError(
            413,
            "state_too_large",
            "Состояние превышает допустимый размер.",
            {"maxBytes": settings.max_state_bytes, "actualBytes": size},
        )


def _as_response(model: StateSnapshotModel) -> StateSnapshotResponse:
    updated_at = model.updated_at
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    return StateSnapshotResponse(
        state=copy.deepcopy(model.state),
        revision=model.revision,
        updated_at=updated_at,
    )


def initialize_state(db: Session) -> StateSnapshotModel:
    model = db.get(StateSnapshotModel, SINGLETON_ID)
    if model is not None:
        return model

    model = StateSnapshotModel(
        id=SINGLETON_ID,
        state=load_seed_state(),
        revision=1,
        updated_at=datetime.now(UTC),
    )
    db.add(model)
    try:
        db.commit()
    except IntegrityError:
        # Another worker can win initialization between SELECT and INSERT.
        db.rollback()
        existing = db.get(StateSnapshotModel, SINGLETON_ID)
        if existing is None:
            raise
        return existing
    db.refresh(model)
    return model


def get_state(db: Session) -> StateSnapshotResponse:
    return _as_response(initialize_state(db))


def replace_state(
    db: Session,
    state: dict[str, Any],
    *,
    expected_revision: int | None,
    force: bool = False,
) -> StateSnapshotResponse:
    _validate_size(state)
    initialize_state(db)
    now = datetime.now(UTC)

    statement = (
        update(StateSnapshotModel)
        .where(StateSnapshotModel.id == SINGLETON_ID)
        .values(
            state=copy.deepcopy(state),
            revision=StateSnapshotModel.revision + 1,
            updated_at=now,
        )
    )
    if expected_revision is not None and not force:
        statement = statement.where(StateSnapshotModel.revision == expected_revision)

    result = db.execute(statement.execution_options(synchronize_session=False))
    if result.rowcount != 1:
        db.rollback()
        current = initialize_state(db)
        raise APIError(
            409,
            "revision_conflict",
            "Состояние уже было изменено другим клиентом.",
            {
                "expectedRevision": expected_revision,
                "currentRevision": current.revision,
            },
        )

    db.commit()
    model = db.scalar(select(StateSnapshotModel).where(StateSnapshotModel.id == SINGLETON_ID))
    if model is None:  # Defensive: the row cannot disappear through this API.
        raise APIError(500, "state_missing", "Состояние приложения не найдено.")
    return _as_response(model)


def reset_state(
    db: Session,
    *,
    expected_revision: int | None = None,
    force: bool = False,
) -> StateSnapshotResponse:
    return replace_state(
        db,
        load_seed_state(),
        expected_revision=expected_revision,
        force=force,
    )
