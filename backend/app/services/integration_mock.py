"""Deterministic upstream records for demo and acceptance environments.

The customer contracts for LMS and the Laravel site are not available yet.
These records exercise the real ingestion, deduplication, audit and UI flows
without pretending to be a production connector.
"""

from __future__ import annotations

import copy
from typing import Any


MOCK_RECORDS: dict[str, list[dict[str, Any]]] = {
    "lms": [
        {
            "externalId": "mock-lms-flow-2026-09-analytics",
            "title": "LMS: обновление потока по аналитике данных",
            "universityId": "u1",
            "directionId": "d3",
            "programId": "pr3",
            "productId": "p3",
            "suggestedInteractionId": "i1",
            "message": "В демонстрационном потоке обучаются 92 студента, открыто 3 группы.",
            "students": 92,
            "streams": 3,
            "completionPercent": 68,
        }
    ],
    "site": [
        {
            "externalId": "mock-site-lead-misis-2026-09",
            "title": "Заявка с сайта: пилотный курс по кибербезопасности",
            "universityName": "НИТУ МИСИС",
            "universityId": None,
            "directionId": "d2",
            "programId": "pr2",
            "productId": "p5",
            "contact": {
                "name": "Мария Соколова",
                "position": "Руководитель образовательной программы",
                "email": "m.sokolova@example.test",
            },
            "message": "Демонстрационная заявка на запуск пилотного курса для 40 студентов.",
        }
    ],
}


def get_mock_records(source_id: str) -> list[dict[str, Any]]:
    """Return a copy so ingestion can safely normalize nested payloads."""

    return copy.deepcopy(MOCK_RECORDS[source_id])
