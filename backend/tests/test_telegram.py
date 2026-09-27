from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.services import telegram


LEAD_CHAT = 5001


class FakeTelegram:
    def __init__(self) -> None:
        self.sent: list[tuple[int, str]] = []

    def get_me(self) -> dict:
        return {"username": "crm_test_bot"}

    def send_message(self, chat_id: int, text: str, *, button=None) -> None:
        self.sent.append((chat_id, text))


@pytest.fixture()
def bot(monkeypatch) -> FakeTelegram:
    fake = FakeTelegram()
    monkeypatch.setattr(telegram, "get_client", lambda: fake)
    monkeypatch.setattr(settings, "telegram_notify_delay_seconds", 0)
    telegram._bot_username.clear()
    monkeypatch.setattr(settings, "telegram_bot_token", "test-token")
    return fake


def _headers(client: TestClient, role: str) -> dict[str, str]:
    token = client.post("/api/v1/auth/demo", json={"role": role}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _connect_lead(client: TestClient) -> dict[str, str]:
    """Демо-руководитель usr-6 (Алина Воронова — его менеджер) подключает Telegram через ссылку."""

    lead = _headers(client, "lead")
    link = client.post("/api/v1/me/telegram/link", headers=lead)
    assert link.status_code == 200, link.text
    code = link.json()["url"].split("start=")[1]
    assert link.json()["url"].startswith("https://t.me/crm_test_bot?start=")
    with SessionLocal() as db:
        reply = telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "from": {"username": "lead_tg"}, "text": f"/start {code}"}})
    assert reply and "Готово, чат подключён" in reply
    return lead


def _transition(state: dict, interaction_id: str, event_id: str) -> dict:
    interaction = next(item for item in state["interactions"] if item["id"] == interaction_id)
    stages = next(item for item in state["workflows"] if item["id"] == interaction["workflowId"])["stages"]
    index = next(position for position, stage in enumerate(stages) if stage["id"] == interaction["stageId"])
    target = stages[index + 1]["id"]
    state["events"].append({
        "id": event_id, "interactionId": interaction_id, "type": "transition", "userId": interaction["managerId"],
        "at": "2026-09-27T10:00:00.000Z", "fromStageId": interaction["stageId"], "toStageId": target,
        "stageId": interaction["stageId"], "comment": "Договорились <о встрече>", "files": [],
    })
    interaction["stageId"] = target
    return state


def test_lead_connects_and_gets_notified_about_team_transitions(client: TestClient, bot: FakeTelegram) -> None:
    lead = _connect_lead(client)
    status = client.get("/api/v1/me/telegram", headers=lead).json()
    assert status["connected"] and status["username"] == "lead_tg" and status["botUsername"] == "crm_test_bot"

    manager = _headers(client, "manager")
    snapshot = client.get("/api/v1/state", headers=manager).json()
    assert all("telegram" not in user for user in snapshot["state"]["users"]), "chat_id не уходит в браузер"
    interaction_id = next(item["id"] for item in snapshot["state"]["interactions"] if not item.get("completedAt"))
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-telegram-1")
    saved = client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=manager)
    assert saved.status_code == 200, saved.text
    telegram.notifier.wait()

    messages = [text for chat, text in bot.sent if chat == LEAD_CHAT]
    assert len(messages) == 1
    assert "Переход на следующий этап" in messages[0] and "Алина Воронова" in messages[0]
    assert "&lt;о встрече&gt;" in messages[0], "комментарий экранируется"
    assert "📊 Этап" in messages[0] and "⏳ Срок этапа" in messages[0] and "🏛 <b>" in messages[0]

    assert client.delete("/api/v1/me/telegram", headers=lead).json()["connected"] is False


def test_undone_transition_is_not_sent(client: TestClient, bot: FakeTelegram, monkeypatch) -> None:
    _connect_lead(client)
    manager = _headers(client, "manager")
    snapshot = client.get("/api/v1/state", headers=manager).json()
    interaction_id = next(item["id"] for item in snapshot["state"]["interactions"] if not item.get("completedAt"))
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-telegram-undo")

    # Пока уведомление ждёт паузу, менеджер нажимает «Отменить» — событие исчезает из состояния.
    monkeypatch.setattr(telegram, "_event_still_exists", lambda event_id: False)
    client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=manager)
    telegram.notifier.wait()
    assert not [text for chat, text in bot.sent if chat == LEAD_CHAT and "Переход" in text]


def test_only_leads_connect_and_admin_saves_keep_the_binding(client: TestClient, bot: FakeTelegram) -> None:
    assert client.post("/api/v1/me/telegram/link", headers=_headers(client, "manager")).status_code == 403
    _connect_lead(client)

    admin = _headers(client, "admin")
    snapshot = client.get("/api/v1/state", headers=admin).json()
    saved = client.put("/api/v1/state", json={"state": snapshot["state"], "expectedRevision": snapshot["revision"]}, headers=admin)
    assert saved.status_code == 200, saved.text
    assert client.get("/api/v1/me/telegram", headers=_headers(client, "lead")).json()["connected"], "сохранение админа не стирает привязку"

    overview = client.get("/api/v1/telegram/status", headers=admin).json()
    assert overview["configured"] and overview["connected"] >= 1

    with SessionLocal() as db:
        expired = telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/start expired-code"}})
        assert "Ссылка устарела" in expired
        assert "Алексей Козлов" in telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/status"}})
        assert telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/stop"}}).startswith("🔕 <b>Уведомления отключены")
        assert telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/status"}}).startswith("🔌 <b>Чат не подключён")


def test_admin_gets_every_transition_but_not_own(client: TestClient, bot: FakeTelegram) -> None:
    admin = _headers(client, "admin")
    link = client.post("/api/v1/me/telegram/link", headers=admin).json()["url"]
    assert client.get("/api/v1/me/telegram", headers=admin).json()["scope"] == "all"
    with SessionLocal() as db:
        telegram.handle_update(db, {"message": {"chat": {"id": 6001, "type": "private"}, "text": f"/start {link.split('start=')[1]}"}})

    manager = _headers(client, "manager")
    snapshot = client.get("/api/v1/state", headers=manager).json()
    interaction_id = next(item["id"] for item in snapshot["state"]["interactions"] if not item.get("completedAt"))
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-telegram-admin")
    client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=manager)
    telegram.notifier.wait()
    assert [chat for chat, text in bot.sent if "Переход" in text and chat == 6001], "администратор получает переходы всех менеджеров"
