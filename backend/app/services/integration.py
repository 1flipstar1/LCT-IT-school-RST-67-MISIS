"""Pull and push ingestion for the LMS and Laravel website JSON contracts."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import Principal
from app.domain.state import find_principal_user, project_state_for_principal
from app.schemas.integration import IntegrationSyncResult
from app.services.state import get_state, mutate_state


SUPPORTED_SOURCES = {"lms", "site"}
MAX_RESPONSE_BYTES = 10 * 1024 * 1024


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _records_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = next(
            (payload[key] for key in ("items", "records", "data") if isinstance(payload.get(key), list)),
            [payload],
        )
    else:
        raise APIError(502, "integration_invalid_json", "Внешняя система вернула JSON неподдерживаемой структуры.")
    if len(records) > 5000 or any(not isinstance(item, dict) for item in records):
        raise APIError(502, "integration_invalid_json", "Внешняя система вернула слишком много записей или записи неверного формата.")
    return records


def fetch_records(source_id: str) -> list[dict[str, Any]]:
    url = settings.integration_url(source_id)
    if not url:
        raise APIError(
            503,
            "integration_not_configured",
            "Для источника не настроен адрес API.",
            {"sourceId": source_id},
        )
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise APIError(500, "integration_url_invalid", "Адрес API источника настроен неверно.")

    headers = {"Accept": "application/json", "User-Agent": "RTK-IT-School-CRM/1.0"}
    token = settings.integration_token(source_id)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers, method="GET")
    try:
        with urlopen(request, timeout=settings.integration_timeout_seconds) as response:  # noqa: S310 - URL is operator-configured.
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise APIError(502, "integration_unavailable", "Внешняя система не ответила на запрос.", {"sourceId": source_id}) from exc
    if len(raw) > MAX_RESPONSE_BYTES:
        raise APIError(502, "integration_response_too_large", "Ответ внешней системы превышает допустимый размер.")
    try:
        return _records_from_payload(json.loads(raw.decode("utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise APIError(502, "integration_invalid_json", "Внешняя система вернула некорректный JSON.") from exc


def _title(source_id: str, record: dict[str, Any]) -> str:
    if isinstance(record.get("title"), str) and record["title"].strip():
        return record["title"].strip()
    payload = record.get("payload") if isinstance(record.get("payload"), dict) else record
    university = payload.get("universityName") or payload.get("university")
    if source_id == "lms":
        return f"LMS: {university or 'новая запись'}"
    return f"Заявка с сайта: {university or 'новая запись'}"


def ingest_records(
    db: Session,
    *,
    source_id: str,
    records: list[dict[str, Any]],
    principal: Principal,
) -> IntegrationSyncResult:
    if source_id not in SUPPORTED_SOURCES:
        raise APIError(404, "integration_source_not_found", "Источник интеграции не найден.")
    current = get_state(db)
    actor = find_principal_user(current.state, principal)
    timestamp = _now()
    log_entry = {
        "id": f"sl-{uuid4()}",
        "sourceId": source_id,
        "at": timestamp,
        "status": "success",
        "records": len(records),
    }

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        known_external_ids = {
            str(item.get("payload", {}).get("externalId"))
            for item in state["inbox"]
            if item.get("source") == source_id and item.get("payload", {}).get("externalId") is not None
        }
        added = 0
        for record in records:
            payload = dict(record.get("payload")) if isinstance(record.get("payload"), dict) else dict(record)
            external_id = record.get("externalId", record.get("id"))
            if external_id is not None:
                if str(external_id) in known_external_ids:
                    continue
                payload["externalId"] = external_id
                known_external_ids.add(str(external_id))
            state["inbox"].insert(
                0,
                {
                    "id": f"in-{uuid4()}",
                    "source": source_id,
                    "receivedAt": timestamp,
                    "status": "new",
                    "title": _title(source_id, record),
                    "payload": payload,
                },
            )
            added += 1
        entry = {**log_entry, "records": added}
        state["integrations"]["log"].insert(0, entry)
        for source in state["integrations"]["sources"]:
            if source.get("id") == source_id:
                source.update({"lastSyncAt": timestamp, "lastStatus": "success"})
                source.pop("lastErrorCode", None)
                break
        state["audit"].insert(
            0,
            {
                "id": f"audit-{uuid4()}",
                "at": timestamp,
                "userId": actor["id"],
                "text": f"Синхронизация {source_id.upper()}: получено записей — {added}",
                "target": {"type": "integration", "id": source_id, "label": source_id.upper()},
            },
        )
        state["audit"] = state["audit"][:500]
        return entry

    snapshot, saved_entry = mutate_state(db, mutation)
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    return IntegrationSyncResult(log_entry=saved_entry, snapshot=snapshot)


def record_failed_sync(
    db: Session,
    *,
    source_id: str,
    principal: Principal,
    error: APIError,
) -> IntegrationSyncResult:
    current = get_state(db)
    actor = find_principal_user(current.state, principal)
    timestamp = _now()
    log_entry = {
        "id": f"sl-{uuid4()}",
        "sourceId": source_id,
        "at": timestamp,
        "status": "failed",
        "records": 0,
        "errorCode": error.code,
    }

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state["integrations"]["log"].insert(0, log_entry)
        for source in state["integrations"]["sources"]:
            if source.get("id") == source_id:
                source.update({"lastSyncAt": timestamp, "lastStatus": "failed", "lastErrorCode": error.code})
                break
        state["audit"].insert(
            0,
            {
                "id": f"audit-{uuid4()}",
                "at": timestamp,
                "userId": actor["id"],
                "text": f"Ошибка синхронизации {source_id.upper()}: {error.code}",
                "target": {"type": "integration", "id": source_id, "label": source_id.upper()},
            },
        )
        state["audit"] = state["audit"][:500]
        return log_entry

    snapshot, saved_entry = mutate_state(db, mutation)
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    return IntegrationSyncResult(log_entry=saved_entry, snapshot=snapshot)
