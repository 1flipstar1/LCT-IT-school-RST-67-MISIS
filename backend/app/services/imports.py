"""Applying, listing and rolling back catalog imports.

The browser parses the file and plans the change with the same rules the user sees
on the check step. The server owns everything that must be trustworthy: permissions,
the revision check, validation of the resulting state, the history and the rollback.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import Principal
from app.domain.state import find_principal_user, project_state_for_principal
from app.models.import_job import ImportJobModel
from app.schemas.imports import ImportApplyResponse, ImportCreateRequest, ImportJob, ImportJobDetail
from app.services.state import get_state, replace_state


IMPORT_ROLES = {"lead", "admin"}
MAX_STORED_ISSUES = 1000
AUDIT_LIMIT = 500


def _now() -> datetime:
    return datetime.now(UTC)


def _require_import_role(principal: Principal) -> None:
    if principal.role not in IMPORT_ROLES:
        raise APIError(403, "forbidden", "Загружать данные из файлов может руководитель или администратор.")


def _with_audit(state: dict[str, Any], *, user_id: str, text: str, label: str, job_id: str) -> None:
    entry = {
        "id": f"audit-import-{uuid4().hex[:12]}",
        "at": _now().isoformat().replace("+00:00", "Z"),
        "userId": user_id,
        "text": text,
        "target": {"type": "import", "id": job_id, "label": label},
    }
    state["audit"] = [entry, *state.get("audit", [])][:AUDIT_LIMIT]


def _as_job(model: ImportJobModel, *, current_revision: int, detail: bool = False) -> ImportJob | ImportJobDetail:
    payload = {
        "id": model.id,
        "file_name": model.file_name,
        "attachment_id": model.attachment_id,
        "status": model.status,
        "summary": model.summary,
        "options": model.options or {},
        "stats": model.stats or {},
        "issue_count": len(model.issues or []),
        "created_by_name": model.created_by_name,
        "created_at": model.created_at if model.created_at.tzinfo else model.created_at.replace(tzinfo=UTC),
        "rolled_back_at": model.rolled_back_at,
        "rolled_back_by_name": model.rolled_back_by_name,
        # Без подтверждения откатить можно только импорт, после которого данные не менялись.
        "can_rollback": model.status == "applied" and model.revision_after == current_revision,
    }
    if detail:
        return ImportJobDetail(**payload, issues=model.issues or [])
    return ImportJob(**payload)


def apply_import(db: Session, payload: ImportCreateRequest, principal: Principal) -> ImportApplyResponse:
    _require_import_role(principal)
    current = get_state(db)
    if current.revision != payload.expected_revision:
        raise APIError(
            409,
            "revision_conflict",
            "Пока вы проверяли файл, данные изменились. Проверьте файл ещё раз.",
            {"expectedRevision": payload.expected_revision, "currentRevision": current.revision},
        )

    user = find_principal_user(current.state, principal)
    job_id = str(uuid4())
    # Браузер планирует импорт по видимой пользователю части данных — поверх неё и кладём изменения;
    # replace_state сольёт их с остальным состоянием по тем же правилам, что и обычное сохранение.
    next_state = project_state_for_principal(current.state, principal)
    # Для отката храним полные коллекции: отмена восстанавливает и то, что пользователю не видно.
    snapshot_before = {key: copy.deepcopy(current.state.get(key, [])) for key in payload.changes}
    for key, items in payload.changes.items():
        next_state[key] = items
    _with_audit(next_state, user_id=user["id"], text=payload.summary or f"Импорт «{payload.file_name}»", label=payload.file_name, job_id=job_id)

    # Запись истории и состояния — одна транзакция: replace_state фиксирует обе или откатывает обе.
    job = ImportJobModel(
        id=job_id,
        file_name=payload.file_name,
        attachment_id=payload.attachment_id,
        status="applied",
        summary=payload.summary,
        options=payload.options,
        stats=payload.stats,
        issues=[issue.model_dump(by_alias=True) for issue in payload.issues[:MAX_STORED_ISSUES]],
        snapshot_before=snapshot_before,
        revision_after=current.revision + 1,
        created_by=user["id"],
        created_by_name=str(user.get("name", "")),
        created_at=_now(),
    )
    db.add(job)
    snapshot = replace_state(db, next_state, expected_revision=current.revision, principal=principal)
    job = db.get(ImportJobModel, job_id)
    return ImportApplyResponse(job=_as_job(job, current_revision=snapshot.revision), snapshot=snapshot)


def list_imports(db: Session, principal: Principal, *, limit: int = 30) -> list[ImportJob]:
    _require_import_role(principal)
    revision = get_state(db).revision
    models = db.scalars(select(ImportJobModel).order_by(ImportJobModel.created_at.desc()).limit(limit)).all()
    return [_as_job(model, current_revision=revision) for model in models]


def _get_job(db: Session, job_id: str) -> ImportJobModel:
    model = db.get(ImportJobModel, job_id)
    if model is None:
        raise APIError(404, "import_not_found", "Импорт не найден.")
    return model


def get_import(db: Session, job_id: str, principal: Principal) -> ImportJobDetail:
    _require_import_role(principal)
    return _as_job(_get_job(db, job_id), current_revision=get_state(db).revision, detail=True)


def rollback_import(db: Session, job_id: str, principal: Principal, *, force: bool = False) -> ImportApplyResponse:
    _require_import_role(principal)
    model = _get_job(db, job_id)
    if model.status != "applied":
        raise APIError(409, "import_already_rolled_back", "Этот импорт уже отменён.")

    current = get_state(db)
    changes_since = current.revision - model.revision_after
    if changes_since and not force:
        raise APIError(
            409,
            "import_changed_since",
            "После импорта данные уже меняли. Отмена вернёт справочники к состоянию до импорта, и эти изменения пропадут.",
            {"changesSince": changes_since},
        )

    user = find_principal_user(current.state, principal)
    next_state = copy.deepcopy(current.state)
    for key, items in (model.snapshot_before or {}).items():
        next_state[key] = copy.deepcopy(items)
    _with_audit(next_state, user_id=user["id"], text=f"Отменён импорт «{model.file_name}»", label=model.file_name, job_id=model.id)

    model.status = "rolled_back"
    model.rolled_back_at = _now()
    model.rolled_back_by_name = str(user.get("name", ""))
    # snapshot_before — полные коллекции, поэтому состояние записывается без слияния по области видимости.
    snapshot = replace_state(db, next_state, expected_revision=current.revision)
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    model = db.get(ImportJobModel, job_id)
    return ImportApplyResponse(job=_as_job(model, current_revision=snapshot.revision), snapshot=snapshot)
