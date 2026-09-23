"""RabbitMQ worker entry point: ``python -m app.worker``."""

from __future__ import annotations

import json
import logging
import time

import pika

from app.core.config import settings
from app.core.database import create_database_schema
from app.workers.tasks import process_message


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def run() -> None:
    create_database_schema()
    all_queues = (settings.rabbitmq_import_queue, settings.rabbitmq_report_queue)
    selected = [value.strip() for value in settings.worker_queues.split(",") if value.strip()]
    queues = tuple(queue for queue in all_queues if not selected or queue in selected)
    if not queues:
        raise RuntimeError("WORKER_QUEUES does not contain a configured queue")
    while True:
        try:
            connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
            channel = connection.channel()
            for queue in queues:
                channel.queue_declare(queue=queue, durable=True)
            channel.basic_qos(prefetch_count=1)

            def handle(ch, method, properties, body) -> None:
                del properties
                try:
                    process_message(json.loads(body.decode("utf-8")))
                except Exception:
                    logger.exception("Worker rejected an invalid task")
                finally:
                    ch.basic_ack(delivery_tag=method.delivery_tag)

            for queue in queues:
                channel.basic_consume(queue=queue, on_message_callback=handle)
            logger.info("Worker is consuming %s", ", ".join(queues))
            channel.start_consuming()
        except KeyboardInterrupt:
            return
        except Exception:
            logger.exception("Worker connection failed; retrying")
            time.sleep(5)


if __name__ == "__main__":
    run()
