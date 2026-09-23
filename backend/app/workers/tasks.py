"""Idempotent handlers for messages received from RabbitMQ."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.core.database import SessionLocal
from app.core.errors import APIError
from app.infrastructure.storage import get_object_storage
from app.models.job import JobModel
from app.services.import_parser import parse_workbook
from app.services.import_plan import auto_match_columns, build_import_plan
from app.services.job import mark_failed
from app.services.report_writer import create_report
from app.services.state import get_state, replace_state


logger = logging.getLogger(__name__)


def _update_state(mutator) -> int:
    for attempt in range(3):
        with SessionLocal() as db:
            snapshot = get_state(db)
            state = mutator(snapshot.state)
            try:
                return replace_state(db, state, expected_revision=snapshot.revision).revision
            except APIError as exc:
                if exc.code != "revision_conflict" or attempt == 2:
                    raise
    raise RuntimeError("Could not update state")


def _process_import_parse(job_id: str) -> None:
    storage = get_object_storage()
    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        if job is None or job.kind != "import" or job.status in {"ready", "completed"}:
            return
        job.status = "processing"
        job.updated_at = datetime.now(UTC)
        db.commit()
        try:
            if not job.source_key or not job.original_name:
                raise RuntimeError("У задания отсутствует исходный файл.")
            rows = parse_workbook(storage.get(job.source_key), job.original_name)
            parsed_key = f"imports/{job.id}/parsed.json"
            storage.put(parsed_key, json.dumps(rows, ensure_ascii=False).encode("utf-8"), "application/json")
            job.parsed_key = parsed_key
            job.result = {
                "headers": rows[0],
                "previewRows": rows[1:6],
                "rowCount": len(rows) - 1,
                "suggestedMapping": auto_match_columns(rows[0]),
            }
            job.status = "ready"
            job.error = None
            job.updated_at = datetime.now(UTC)
            db.commit()
        except Exception as exc:
            logger.exception("Import parse failed for job %s", job_id)
            mark_failed(db, job, exc.message if isinstance(exc, APIError) else str(exc))


def _process_import_apply(job_id: str) -> None:
    storage = get_object_storage()
    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        if job is None or job.kind != "import" or job.status == "completed":
            return
        job.status = "processing"
        job.updated_at = datetime.now(UTC)
        db.commit()
        try:
            if not job.parsed_key:
                raise RuntimeError("Разобранные данные импорта не найдены.")
            rows = json.loads(storage.get(job.parsed_key).decode("utf-8"))
            mapping = (job.payload or {}).get("mapping", {})
            result_holder: dict[str, Any] = {}

            def mutate(state: dict[str, Any]) -> dict[str, Any]:
                plan = build_import_plan(rows, mapping, state)
                result_holder.update({"stats": plan["stats"], "issues": plan["issues"]})
                audit = plan["state"].setdefault("audit", [])
                audit_id = f"audit-import-{job.id}"
                if not any(item.get("id") == audit_id for item in audit if isinstance(item, dict)):
                    audit.insert(0, {
                        "id": audit_id,
                        "at": datetime.now(UTC).isoformat(),
                        "userId": job.requester_id,
                        "text": f"Импорт «{job.original_name}»: строк {plan['stats']['rows']}, новых вузов {plan['stats']['newUniversities']}, обновлено договоров {plan['stats']['updatedContracts']}",
                        "target": {"type": "import", "label": "Импорт каталога"},
                    })
                return plan["state"]

            revision = _update_state(mutate)
            now = datetime.now(UTC)
            job.result = {**result_holder, "revision": revision}
            job.status = "completed"
            job.error = None
            job.updated_at = now
            job.completed_at = now
            db.commit()
        except Exception as exc:
            logger.exception("Import apply failed for job %s", job_id)
            mark_failed(db, job, exc.message if isinstance(exc, APIError) else str(exc))


def _safe_stem(name: str) -> str:
    safe = "".join(character if character.isalnum() or character in "-_ " else "_" for character in name).strip()
    return safe[:160] or "report"


def _process_report(job_id: str) -> None:
    storage = get_object_storage()
    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        if job is None or job.kind != "report" or job.status == "completed":
            return
        job.status = "processing"
        job.updated_at = datetime.now(UTC)
        db.commit()
        try:
            if not job.source_key:
                raise RuntimeError("Данные для отчёта не найдены.")
            payload = json.loads(storage.get(job.source_key).decode("utf-8"))
            table = payload.get("table") or {}
            format_name = str(payload.get("format", ""))
            data, content_type = create_report(
                format_name,
                table.get("header", []),
                table.get("body", []),
                title=str(payload.get("name", "Отчёт")),
                summary=str(payload.get("summary", "")),
            )
            filename = f"{_safe_stem(str(payload.get('name', 'Отчёт')))}.{format_name}"
            result_key = f"reports/{job.id}/{filename}"
            storage.put(result_key, data, content_type)

            created_at = datetime.now(UTC)
            report_record = {
                "id": f"r-{job.id}",
                "jobId": job.id,
                "name": str(payload.get("name", "Отчёт")),
                "createdAt": created_at.isoformat(),
                "userId": job.requester_id,
                "format": format_name,
                "rowCount": len(table.get("body", [])),
                "summary": str(payload.get("summary", "")),
                "filters": payload.get("filters"),
                "columns": payload.get("columns"),
            }

            def mutate(state: dict[str, Any]) -> dict[str, Any]:
                reports = state.setdefault("reports", [])
                if not any(item.get("id") == report_record["id"] for item in reports if isinstance(item, dict)):
                    reports.insert(0, report_record)
                    state.setdefault("audit", []).insert(0, {
                        "id": f"audit-{uuid.uuid4().hex[:12]}",
                        "at": created_at.isoformat(),
                        "userId": job.requester_id,
                        "text": f"Сформирован отчёт ({format_name.upper()})",
                        "target": {"type": "report", "id": report_record["id"], "label": report_record["name"]},
                    })
                return state

            revision = _update_state(mutate)
            job.result_key = result_key
            job.content_type = content_type
            job.original_name = filename
            job.size_bytes = len(data)
            job.result = {"filename": filename, "rowCount": report_record["rowCount"], "revision": revision}
            job.status = "completed"
            job.error = None
            job.updated_at = created_at
            job.completed_at = created_at
            db.commit()
        except Exception as exc:
            logger.exception("Report generation failed for job %s", job_id)
            mark_failed(db, job, exc.message if isinstance(exc, APIError) else str(exc))


def process_message(message: dict[str, Any]) -> None:
    action = message.get("action")
    job_id = str(message.get("jobId", ""))
    if not job_id:
        raise ValueError("Message has no jobId")
    handlers = {
        "import.parse": _process_import_parse,
        "import.apply": _process_import_apply,
        "report.generate": _process_report,
    }
    handler = handlers.get(action)
    if handler is None:
        raise ValueError(f"Unknown action: {action}")
    handler(job_id)
