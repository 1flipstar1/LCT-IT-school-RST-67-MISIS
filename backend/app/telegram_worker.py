"""Отдельный процесс Telegram-бота: не зависит от перезапусков API и выкладки фронтенда."""

from __future__ import annotations

import logging
import threading
import time

from app.services import telegram
from app.core.config import settings


logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def run_outbox() -> None:
    while True:
        try:
            processed = telegram.deliver_outbox_once()
        except Exception as exc:  # noqa: BLE001 — краткий сбой БД не останавливает бот.
            logger.warning("Telegram outbox temporarily unavailable: %s", type(exc).__name__)
            processed = False
        time.sleep(0.1 if processed else 0.5)


def main() -> None:
    if settings.telegram_heartbeat_path:
        settings.telegram_heartbeat_path.unlink(missing_ok=True)
    telegram.start_bot()
    outbox = None
    if settings.telegram_outbox_enabled:
        outbox = threading.Thread(target=run_outbox, name="telegram-outbox", daemon=True)
        outbox.start()
    started_at = time.monotonic()
    was_healthy = False
    while True:
        active = telegram.poller
        if active is None or not active.is_alive():
            raise SystemExit("Telegram poller stopped; container will restart")
        if outbox is not None and not outbox.is_alive():
            raise SystemExit("Telegram outbox stopped; container will restart")
        if active.healthy:
            was_healthy = True
        elif (was_healthy or time.monotonic() - started_at > 180) and not active.healthy:
            logger.error("Telegram poller stalled; restarting worker")
            raise SystemExit(1)
        time.sleep(5)


if __name__ == "__main__":
    main()
