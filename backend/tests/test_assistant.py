"""Assistant stays authenticated, grounded in catalogs and never executes actions itself."""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
from fastapi.testclient import TestClient

from app.services import assistant
from app.services.assistant_knowledge import allowed_pages, knowledge, navigation_target, retrieve


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
            "message": "Переведи КФУ на следующий этап",
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
    assert {tool["function"]["name"] for tool in sent["tools"]} == {
        "change_stage", "open_interaction", "interaction_details",
    }
    system = sent["messages"][0]["content"]
    assert "Аргументы бери из запроса" in system
    assert "Подписание документов" not in system
    assert "Казанский федеральный университет (КФУ)" not in system
    # Имена сотрудников в модель не передаются: их распознаёт браузер по справочнику.
    assert "Алина Воронова" not in system
    assert [turn["role"] for turn in sent["messages"]] == ["system", "user", "assistant", "user"]


def test_tool_call_becomes_action_for_the_browser(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    call = {"function": {"name": "create_report", "arguments": {"universities": ["КФУ"], "format": "pdf"}}}
    requests = mock_ollama(monkeypatch, reply({"content": "", "tool_calls": [call]}))

    response = client.post("/api/v1/assistant/chat", json={"message": "Отчёт по КФУ в PDF"}, headers=manager_headers)

    assert response.status_code == 200
    assert response.json() == {
        "type": "action",
        "message": "",
        "action": {"name": "create_report", "arguments": {"universities": ["КФУ"], "format": "pdf"}},
    }
    assert {tool["function"]["name"] for tool in requests[0]["tools"]} == {"create_report"}
    assert set(requests[0]["tools"][0]["function"]["parameters"]["properties"]) == {"universities", "format"}


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


def test_explanation_uses_a_short_prompt_without_tools(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Откройте этапы работы."}))
    response = client.post("/api/v1/assistant/chat", json={"message": "Какие этапы работы с вузом?"}, headers=manager_headers)
    assert response.status_code == 200
    sent = requests[0]
    assert "tools" not in sent
    assert "Подписание документов" in sent["messages"][0]["content"]
    assert len(sent["messages"][0]["content"]) < 3500


def test_open_question_does_not_send_all_tool_schemas(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Начните с обсуждения задачи вуза."}))
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Посоветуй стратегию переговоров с ректором"},
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert "tools" not in requests[0]


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


def test_knowledge_covers_help_and_respects_roles() -> None:
    assert len(knowledge()["articles"]) >= 90
    assert "users" not in allowed_pages("manager")
    assert "users" in allowed_pages("lead")
    assert "users" in allowed_pages("admin")
    assert navigation_target("Открой пользователей")["id"] == "users"
    assert navigation_target("Открой настройки профиля")["id"] == "profile"
    manager_docs, manager_denial = retrieve("Как сменить роль сотрудника?", "manager")
    assert manager_denial["id"] == "access-roles"
    assert all(article["id"] != "access-roles" for article in manager_docs)
    assert retrieve("Как сменить роль сотрудника?", "admin")[0][0]["id"] == "access-roles"


def test_manager_cannot_get_admin_instructions_or_open_admin_page(
    client: TestClient, manager_headers: dict[str, str], monkeypatch,
) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Нажмите управление ролями."}))
    response = client.post("/api/v1/assistant/chat", json={"message": "Как сменить роль сотрудника?"}, headers=manager_headers)
    assert response.status_code == 200
    assert "недоступна" in response.json()["message"]
    assert requests == []

    call = {"function": {"name": "open_page", "arguments": {"page": "users"}}}
    requests = mock_ollama(monkeypatch, reply({"content": "", "tool_calls": [call]}))
    response = client.post("/api/v1/assistant/chat", json={"message": "Открой пользователей"}, headers=manager_headers)
    assert response.status_code == 200
    assert response.json()["type"] == "message"
    assert "недоступен" in response.json()["message"]
    assert requests == []

    response = client.post("/api/v1/assistant/chat", json={"message": "Открой неизвестный раздел"}, headers=manager_headers)
    assert response.status_code == 200
    assert response.json()["type"] == "message"
    assert "недоступен" in response.json()["message"]
    assert "users" not in requests[0]["tools"][0]["function"]["parameters"]["properties"]["page"]["enum"]


def test_role_grounded_prompt_uses_relevant_help_article(client: TestClient, admin_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Откройте строку сотрудника и выберите роль."}))
    response = client.post("/api/v1/assistant/chat", json={"message": "Как сменить роль сотрудника?"}, headers=admin_headers)
    assert response.status_code == 200
    prompt = requests[0]["messages"][0]["content"]
    assert "Роль пользователя: Администратор" in prompt
    assert "Как сменить роль сотрудника" in prompt
    assert "Свою роль изменить нельзя" in prompt


def test_lead_can_navigate_to_team_without_model(client: TestClient, monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": ""}))
    token = client.post("/api/v1/auth/demo", json={"role": "lead"}).json()["accessToken"]
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Открой пользователей"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["action"] == {"name": "open_page", "arguments": {"page": "users"}}
    assert requests == []


def test_deleting_employee_is_not_claimed_as_a_feature(client: TestClient, admin_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "Удалено."}))
    response = client.post("/api/v1/assistant/chat", json={"message": "Как удалить пользователя?"}, headers=admin_headers)
    assert "не предусмотрено" in response.json()["message"]
    assert requests == []

def test_off_topic_requests_never_reach_the_model(client: TestClient, manager_headers: dict[str, str], monkeypatch) -> None:
    requests = mock_ollama(monkeypatch, reply({"content": "4"}))

    for message in ("2 + 2", "Сколько будет 7*8?", "Напиши код на Python", "какая погода в Казани"):
        response = client.post("/api/v1/assistant/chat", json={"message": message}, headers=manager_headers)
        assert response.status_code == 200
        assert response.json()["message"] == assistant.OUT_OF_SCOPE

    assert requests == []
    assert not assistant.is_out_of_scope("Отчёт по КФУ за 2025 год в PDF")
