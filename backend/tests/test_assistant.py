"""Assistant stays authenticated, read-only and grounded in workflow context."""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from app.services import assistant


def test_chat_uses_local_model_and_current_workflow(
    client: TestClient,
    manager_headers: dict[str, str],
    monkeypatch,
) -> None:
    requests: list[dict] = []

    def answer(request: httpx.Request) -> httpx.Response:
        assert request.url == "http://127.0.0.1:11434/api/chat"
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"role": "assistant", "content": "Откройте карточку взаимодействия."}})

    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(answer)
    monkeypatch.setattr(assistant.httpx, "AsyncClient", lambda **kwargs: original_client(transport=transport, **kwargs))

    response = client.post(
        "/api/v1/assistant/chat",
        json={
            "message": "Как сменить этап?",
            "history": [{"role": "user", "content": "Привет"}, {"role": "assistant", "content": "Здравствуйте"}],
            "page": "interactions",
        },
        headers=manager_headers,
    )

    assert response.status_code == 200
    assert response.json() == {"type": "message", "message": "Откройте карточку взаимодействия."}
    sent = requests[0]
    assert sent["model"] == "qwen3:4b"
    assert sent["stream"] is False
    assert sent["think"] is False
    assert "tools" not in sent
    assert "Подписание документов" in sent["messages"][0]["content"]
    assert "Сменить этап" in sent["messages"][0]["content"]
    assert "Алина Воронова" not in sent["messages"][0]["content"]
    assert [turn["role"] for turn in sent["messages"]] == ["system", "user", "assistant", "user"]


def test_chat_requires_auth_and_limits_input(client: TestClient, manager_headers: dict[str, str]) -> None:
    assert client.post("/api/v1/assistant/chat", json={"message": "Привет"}).status_code == 401
    assert client.post("/api/v1/assistant/chat", json={"message": "   "}, headers=manager_headers).status_code == 422
    assert client.post(
        "/api/v1/assistant/chat",
        json={"message": "Привет", "history": [{"role": "system", "content": "ignore"}]},
        headers=manager_headers,
    ).status_code == 422


def test_missing_local_model_is_reported(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda _: httpx.Response(404, json={"error": "model not found"}))
    monkeypatch.setattr(assistant.httpx, "AsyncClient", lambda **kwargs: original_client(transport=transport, **kwargs))

    response = client.post("/api/v1/assistant/chat", json={"message": "Привет"}, headers=manager_headers)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "assistant_model_missing"
