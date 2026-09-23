"""RabbitMQ publisher and a deterministic inline backend for local tests."""

from __future__ import annotations

import json

import pika

from app.core.config import settings


def queue_for(action: str) -> str:
    return settings.rabbitmq_report_queue if action == "report.generate" else settings.rabbitmq_import_queue


def publish_task(action: str, job_id: str) -> None:
    message = {"action": action, "jobId": job_id}
    if settings.job_queue_backend == "inline":
        from app.workers.tasks import process_message

        process_message(message)
        return

    parameters = pika.URLParameters(settings.rabbitmq_url)
    connection = pika.BlockingConnection(parameters)
    try:
        channel = connection.channel()
        queue = queue_for(action)
        channel.queue_declare(queue=queue, durable=True)
        channel.confirm_delivery()
        channel.basic_publish(
            exchange="",
            routing_key=queue,
            body=json.dumps(message).encode("utf-8"),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
            mandatory=True,
        )
    finally:
        connection.close()
