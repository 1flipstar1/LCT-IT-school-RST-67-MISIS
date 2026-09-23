"""Periodic LMS/site synchronizer for a dedicated deployment process.

Run continuously with ``python -m app.integration_worker`` or execute one
acceptance cycle with ``python -m app.integration_worker --once``.
"""

from __future__ import annotations

import argparse
import logging
import time

from app.core.config import settings
from app.core.database import SessionLocal, create_database_schema
from app.core.errors import APIError
from app.core.security import Principal
from app.services.integration import (
    SUPPORTED_SOURCES,
    fetch_records,
    ingest_records,
    record_failed_sync,
)


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def _system_principal() -> Principal:
    return Principal(
        subject=settings.integration_system_user_id,
        role="admin",
        name="Сервис интеграций",
        email=None,
        username="integration-worker",
        claims={"sub": settings.integration_system_user_id, "role": "admin", "token_use": "system"},
    )


def sync_source(source_id: str) -> dict[str, object]:
    principal = _system_principal()
    with SessionLocal() as db:
        try:
            records = fetch_records(source_id)
        except APIError as error:
            if error.status_code not in {500, 502, 503}:
                raise
            result = record_failed_sync(db, source_id=source_id, principal=principal, error=error)
        else:
            result = ingest_records(
                db,
                source_id=source_id,
                records=records,
                principal=principal,
                mode=settings.integration_mode(source_id),
            )
    entry = result.log_entry
    logger.info(
        "Integration %s finished with status=%s records=%s mode=%s",
        source_id,
        entry.get("status"),
        entry.get("records"),
        entry.get("mode", settings.integration_mode(source_id)),
    )
    return entry


def sync_once() -> None:
    failures: list[str] = []
    for source_id in sorted(SUPPORTED_SOURCES):
        try:
            entry = sync_source(source_id)
            if entry.get("status") != "success":
                failures.append(source_id)
        except Exception:
            logger.exception("Integration %s cycle failed", source_id)
            failures.append(source_id)
    if failures:
        raise RuntimeError(f"Integration cycle failed for: {', '.join(failures)}")


def run() -> None:
    create_database_schema()
    next_run = {source_id: 0.0 for source_id in SUPPORTED_SOURCES}
    logger.info(
        "Integration scheduler started (lms=%ss, site=%ss)",
        settings.integration_interval_seconds("lms"),
        settings.integration_interval_seconds("site"),
    )
    while True:
        now = time.monotonic()
        for source_id in sorted(SUPPORTED_SOURCES):
            if now < next_run[source_id]:
                continue
            try:
                sync_source(source_id)
            except Exception:
                logger.exception("Integration %s cycle failed", source_id)
            finally:
                next_run[source_id] = time.monotonic() + settings.integration_interval_seconds(source_id)
        time.sleep(min(5.0, max(0.5, min(next_run.values()) - time.monotonic())))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Synchronize configured LMS and site connectors")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    args = parser.parse_args()
    if args.once:
        create_database_schema()
        sync_once()
    elif not settings.integration_scheduler_enabled:
        raise SystemExit("INTEGRATION_SCHEDULER_ENABLED must be true for continuous mode")
    else:
        run()
