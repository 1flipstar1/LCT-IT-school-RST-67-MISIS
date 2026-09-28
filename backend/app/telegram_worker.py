"""Dedicated Telegram poller process, independent from API and frontend deploys."""

from __future__ import annotations

import logging
import time

from app.services import telegram
from app.core.config import settings


logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def main() -> None:
    if settings.telegram_heartbeat_path:
        settings.telegram_heartbeat_path.unlink(missing_ok=True)
    telegram.start_bot()
    started_at = time.monotonic()
    was_healthy = False
    while True:
        active = telegram.poller
        if active is None or not active.is_alive():
            raise SystemExit("Telegram poller stopped; container will restart")
        if active.healthy:
            was_healthy = True
        elif (was_healthy or time.monotonic() - started_at > 180) and not active.healthy:
            logger.error("Telegram poller stalled; restarting worker")
            raise SystemExit(1)
        time.sleep(5)


if __name__ == "__main__":
    main()
