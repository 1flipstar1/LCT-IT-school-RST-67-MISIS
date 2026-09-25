"""Assistant stays authenticated, grounded in catalogs and never executes actions itself."""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
from fastapi.testclient import TestClient

from app.services import assistant


REAL_ASYNC_CLIENT = httpx.AsyncClient


def mock_ollama(monkeypatch, handler: Callable[[httpx.Request], httpx.Response]) -> list[dict]:
    requests: list[dict] = []

    def record(request: httpx.Request) -> httpx.Response:
        if request.content:
            requests.append(json.loads(request.content))
        return handler(request)

    transport = httpx.MockTransport(record)
    monkeypatch.setattr(assistant.httpx, "AsyncClient", lambda **kwargs: REAL_ASYNC_CLIENT(transport=transport, **kwargs))
    return requests


def reply(message: dict) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _: httpx.Response(200, json={"message": {"role": "assistant", **message}})


def test_chat_uses_local_model_catalogs_and_tools(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Откройте карточку взаимодействия."}))

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
    assert response.json() == {"type": "message", "message": "Откройте карточку взаимодействия.", "action": None}
    sent = requests[0]
    assert sent["model"] == assistant.settings.ollama_model
    assert sent["stream"] is False
    assert sent["think"] is False
    assert {tool["function"]["name"] for tool in sent["tools"]} == assistant.ACTION_NAMES
    system = sent["messages"][0]["content"]
    assert "Подписание документов" in system
    assert "Сменить этап" in system
    assert "Казанский федеральный университет (КФУ)" in system
    # Имена сотрудников в модель не передаются: их распознаёт браузер по справочнику.
    assert "Алина Воронова" not in system
    assert [turn["role"] for turn in sent["messages"]] == ["system", "user", "assistant", "user"]


def test_tool_call_becomes_action_for_the_browser(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    call = {"function": {"name": "create_report", "arguments": {"universities": ["КФУ"], "format": "pdf"}}}
    mock_ollama(monkeypatch, reply({"content": "", "tool_calls": [call]}))

    response = client.post("/api/v1/assistant/chat", json={"message": "Отчёт по КФУ в PDF"}, headers=manager_headers)

    assert response.status_code == 200
    assert response.json() == {
        "type": "action",
        "message": "",
        "action": {"name": "create_report", "arguments": {"universities": ["КФУ"], "format": "pdf"}},
    }


def test_unknown_tool_is_ignored_and_guide_mode_sends_no_tools(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    call = {"function": {"name": "drop_database", "arguments": "{}"}}
    requests = mock_ollama(monkeypatch, reply({"content": "Откройте раздел «Отчёты».", "tool_calls": [call]}))

    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Сделай отчёт", "mode": "guide", "detail": "detailed"},
        headers=manager_headers,
    )

    assert response.status_code == 200
    assert response.json()["type"] == "message"
    assert "tools" not in requests[0]
    assert "подробно" in requests[0]["messages"][0]["content"]


def test_chat_requires_auth_and_limits_input(client: TestClient, manager_headers: dict[str, str]) -> None:
    assert client.post("/api/v1/assistant/chat", json={"message": "Привет"}).status_code == 401
    assert client.get("/api/v1/assistant/status").status_code == 401
    assert client.post("/api/v1/assistant/chat", json={"message": "   "}, headers=manager_headers).status_code == 422
    assert client.post(
        "/api/v1/assistant/chat",
        json={"message": "Привет", "history": [{"role": "system", "content": "ignore"}]},
        headers=manager_headers,
    ).status_code == 422
    assert client.post("/api/v1/assistant/chat", json={"message": "Привет", "mode": "root"}, headers=manager_headers).status_code == 422


def test_missing_local_model_is_reported(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    mock_ollama(monkeypatch, lambda _: httpx.Response(404, json={"error": "model not found"}))

    response = client.post("/api/v1/assistant/chat", json={"message": "Привет"}, headers=manager_headers)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "assistant_model_missing"


def test_status_reports_whether_the_model_is_pulled(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    model = assistant.settings.ollama_model
    mock_ollama(monkeypatch, lambda _: httpx.Response(200, json={"models": [{"name": model}]}))
    assert client.get("/api/v1/assistant/status", headers=manager_headers).json() == {"enabled": True, "available": True, "model": model}

    mock_ollama(monkeypatch, lambda _: httpx.Response(200, json={"models": [{"name": "other:1b"}]}))
    assert client.get("/api/v1/assistant/status", headers=manager_headers).json()["available"] is False

    def offline(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    mock_ollama(monkeypatch, offline)
    assert client.get("/api/v1/assistant/status", headers=manager_headers).json()["available"] is False


def test_off_topic_requests_never_reach_the_model(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "4"}))

    for message in ("2 + 2", "Сколько будет 7*8?", "Напиши код на Python", "какая погода в Казани"):
        response = client.post("/api/v1/assistant/chat", json={"message": message}, headers=manager_headers)
        assert response.status_code == 200
        assert response.json()["message"] == assistant.OUT_OF_SCOPE

    assert requests == []
    assert not assistant.is_out_of_scope("Отчёт по КФУ за 2025 год в PDF")
