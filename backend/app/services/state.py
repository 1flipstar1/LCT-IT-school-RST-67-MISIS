"""Persistence and optimistic-concurrency operations for the state aggregate."""

from __future__ import annotations

import copy
import json
import logging
import random
import threading
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from collections.abc import Callable
from functools import lru_cache
from typing import Any, TypeVar

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.domain.changes import apply_changes
from app.domain.state import (
    authorize_state_replacement,
    merge_state_for_principal,
    project_state_for_principal,
    restore_server_owned_user_fields,
    validate_state,
)
from app.core.security import Principal
from app.models.state import StateSnapshotModel
from app.models.telegram_delivery import TelegramDeliveryModel
from app.schemas.state import StateSnapshotResponse


logger = logging.getLogger(__name__)
SINGLETON_ID = 1
MutationResult = TypeVar("MutationResult")
StateListener = Callable[[dict[str, Any], dict[str, Any]], None]
_state_listeners: list[StateListener] = []
# Server-side writes of this process wait here *before* taking a DB connection. The snapshot row lock
# serialises them anyway; without this queue every waiting write held a pooled connection, and a burst
# of saves exhausted the pool (30 s waits and 500s for plain reads). Other processes still queue on the row lock.
_write_queue = threading.Lock()


def _release_read_transaction(db: Session) -> None:
    """Return the pooled connection while waiting in the write queue (only reads happened so far)."""

    if db.in_transaction() and not (db.new or db.dirty or db.deleted):
        db.rollback()


def add_state_listener(listener: StateListener) -> None:
    """Подписка на сохранённые изменения состояния (прежняя и новая версии), например для уведомлений."""

    if listener not in _state_listeners:
        _state_listeners.append(listener)


def _notify_listeners(before: dict[str, Any], after: dict[str, Any]) -> None:
    for listener in _state_listeners:
        try:
            listener(before, after)
        except Exception:  # noqa: BLE001 — сбой подписчика не должен отменять уже сохранённое состояние.
            logger.exception("State listener %s failed", listener)


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
    return copy.deepcopy(_parsed_seed_state(path or settings.seed_state_path))


@lru_cache(maxsize=4)
def _parsed_seed_state(seed_path: Path) -> dict[str, Any]:
    """Seed is read once per process: replace_state compares every save with it."""
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


def get_state_for_principal(db: Session, principal: Principal | None) -> StateSnapshotResponse:
    # The projection copies only what it changes, so the ORM snapshot is not deep-copied first:
    # on a 1 MB state the copies used to cost more than the whole request.
    model = initialize_state(db)
    return _response(project_state_for_principal(model.state, principal), model.revision, model.updated_at)


def _response(state: dict[str, Any], revision: int, updated_at: datetime) -> StateSnapshotResponse:
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    return StateSnapshotResponse(state=state, revision=revision, updated_at=updated_at)


def replace_state(
    db: Session,
    state: dict[str, Any],
    *,
    expected_revision: int | None,
    force: bool = False,
    principal: Principal | None = None,
    scoped: bool = True,
) -> StateSnapshotResponse:
    """scoped — браузер прислал свою проекцию (PUT /state); иначе это уже полный снимок (POST /state/changes)."""

    current_model = initialize_state(db)
    is_demo_reset = not settings.is_production and state == _parsed_seed_state(settings.seed_state_path)
    # Read-only below (merge, checks, notifications build new objects), so no deep copy of the snapshot.
    current_state = current_model.state
    next_state = state
    if principal is not None and not is_demo_reset:
        next_state = (
            merge_state_for_principal(current_state, state, principal)
            if scoped
            else restore_server_owned_user_fields(current_state, dict(state))
        )
    _validate_size(next_state)
    validate_state(next_state, max_attachment_bytes=settings.max_attachment_bytes)
    if principal is not None and not is_demo_reset:
        authorize_state_replacement(current_state, next_state, principal)
    now = datetime.now(UTC)

    statement = (
        update(StateSnapshotModel)
        .where(StateSnapshotModel.id == SINGLETON_ID)
        .values(
            state=next_state,
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

    if not is_demo_reset and settings.telegram_outbox_enabled and settings.telegram_bot_token:
        # Queue in the same transaction as the stage change: a restart cannot
        # leave the new stage saved without its Telegram notification.
        from app.services.telegram import stage_notifications

        for notification in stage_notifications(current_state, next_state):
            due_at = now + timedelta(seconds=settings.telegram_notify_delay_seconds)
            db.add(TelegramDeliveryModel(
                id=str(uuid.uuid4()),
                event_id=notification.event_id,
                chat_id=notification.chat_id,
                text=notification.text,
                url=notification.url,
                due_at=due_at,
                next_attempt_at=due_at,
                attempts=0,
            ))

    db.commit()
    if not is_demo_reset and not settings.telegram_outbox_enabled:
        _notify_listeners(current_state, next_state)
    # ``expire_on_commit=False`` keeps request objects usable, so explicitly
    # invalidate the singleton after the SQL expression increments revision.
    db.expire_all()
    # Only the new revision is read back: the state we just wrote is already in memory.
    row = db.execute(
        select(StateSnapshotModel.revision, StateSnapshotModel.updated_at).where(StateSnapshotModel.id == SINGLETON_ID)
    ).one_or_none()
    if row is None:  # Defensive: the row cannot disappear through this API.
        raise APIError(500, "state_missing", "Состояние приложения не найдено.")
    state_out = project_state_for_principal(next_state, principal) if principal is not None else next_state
    return _response(state_out, row.revision, row.updated_at)


def reset_state(
    db: Session,
    *,
    expected_revision: int | None = None,
    force: bool = False,
    principal: Principal | None = None,
) -> StateSnapshotResponse:
    return replace_state(
        db,
        load_seed_state(),
        expected_revision=expected_revision,
        force=force,
        principal=principal,
    )


def mutate_state(
    db: Session,
    mutation: Callable[[dict[str, Any]], MutationResult],
    *,
    attempts: int = 8,
) -> tuple[StateSnapshotResponse, MutationResult]:
    """Apply a server-owned mutation (profile settings, Telegram binding, integrations).

    PostgreSQL: the snapshot row is locked (SELECT … FOR UPDATE) for the read-modify-write, so
    concurrent mutations queue up instead of failing — before this, 15 simultaneous
    «/me/onboarding» calls ran out of compare-and-swap retries and half of them returned 409.
    SQLite ignores the lock but serialises writers itself; the compare-and-swap retry with a
    short random pause covers the remaining races (and browser PUTs, which never lock).
    """

    _release_read_transaction(db)
    with _write_queue:
        last_conflict: APIError | None = None
        for attempt in range(attempts):
            if attempt:
                time.sleep(random.uniform(0.01, 0.05) * attempt)
            initialize_state(db)
            locked = db.scalar(
                select(StateSnapshotModel)
                .where(StateSnapshotModel.id == SINGLETON_ID)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            next_state = copy.deepcopy(locked.state)  # the mutation edits it in place
            result = mutation(next_state)
            try:
                saved = replace_state(
                    db,
                    next_state,
                    expected_revision=locked.revision,
                    force=False,
                )
                return saved, result
            except APIError as exc:
                if exc.code != "revision_conflict":
                    raise
                last_conflict = exc
        raise last_conflict or APIError(409, "revision_conflict", "Состояние уже было изменено другим клиентом.")


def _drop_events_of_removed_interactions(state: dict[str, Any], changes: dict[str, Any]) -> None:
    """Удалённая заявка уходит вместе со всеми событиями — и с теми, что коллега добавил в ту же секунду:
    браузер удалившего о них не знал, а событие без заявки не пройдёт проверку целостности (422 навсегда)."""

    interaction_change = changes.get("interactions")
    removed = interaction_change.get("remove", []) if isinstance(interaction_change, dict) else []
    removed = {item for item in removed if isinstance(item, str)} if isinstance(removed, list) else set()
    if removed and isinstance(state.get("events"), list):
        state["events"] = [event for event in state["events"] if event.get("interactionId") not in removed]


def apply_state_changes(
    db: Session,
    changes: dict[str, Any],
    *,
    principal: Principal,
    attempts: int = 8,
) -> StateSnapshotResponse:
    """Apply the browser's own changes (see app/domain/changes.py) to the latest snapshot.

    The row lock makes concurrent saves queue up instead of conflicting; the result is validated
    and authorised exactly like a full replacement, and the response is the caller's projection
    with everyone's changes, which the browser shows right away.
    """

    _release_read_transaction(db)
    with _write_queue:
        last_conflict: APIError | None = None
        for attempt in range(attempts):
            if attempt:
                time.sleep(random.uniform(0.01, 0.05) * attempt)
            initialize_state(db)
            locked = db.scalar(
                select(StateSnapshotModel)
                .where(StateSnapshotModel.id == SINGLETON_ID)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            next_state = apply_changes(locked.state, changes)  # builds new containers, does not modify locked.state
            _drop_events_of_removed_interactions(next_state, changes)
            try:
                return replace_state(db, next_state, expected_revision=locked.revision, principal=principal, scoped=False)
            except APIError as exc:
                if exc.code != "revision_conflict":
                    raise
                last_conflict = exc
        raise last_conflict or APIError(409, "revision_conflict", "Состояние уже было изменено другим клиентом.")
