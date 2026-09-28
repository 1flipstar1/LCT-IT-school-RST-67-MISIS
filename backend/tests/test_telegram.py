from __future__ import annotations

import copy
import time
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.telegram_delivery import TelegramDeliveryModel
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
    telegram._username_failed_at.clear()
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
    # За рубеж уходит минимум ПДн: имя и инициал фамилии, без полного ФИО.
    assert "Переход на следующий этап" in messages[0] and "Алина В." in messages[0] and "Воронова" not in messages[0]
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


def test_admin_saves_keep_the_binding(client: TestClient, bot: FakeTelegram) -> None:
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
        assert "Чат уже подключён" in expired
        assert "Алексей Козлов" in telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/status"}})
        assert telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/stop"}}).startswith("🔕 <b>Уведомления отключены")
        assert telegram.handle_update(db, {"message": {"chat": {"id": LEAD_CHAT, "type": "private"}, "text": "/status"}}).startswith("🔌 <b>Чат не подключён")


def test_admin_gets_every_transition_including_own(client: TestClient, bot: FakeTelegram) -> None:
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

    snapshot = client.get("/api/v1/state", headers=admin).json()
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-telegram-own-admin")
    state["events"][-1]["userId"] = "usr-8"
    saved = client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=admin)
    assert saved.status_code == 200, saved.text
    telegram.notifier.wait()
    assert len([chat for chat, text in bot.sent if "Переход" in text and chat == 6001]) == 2


def test_manager_can_connect_and_receive_own_transition(client: TestClient, bot: FakeTelegram) -> None:
    manager = _headers(client, "manager")
    link = client.post("/api/v1/me/telegram/link", headers=manager)
    assert link.status_code == 200, link.text
    code = link.json()["url"].split("start=")[1]
    with SessionLocal() as db:
        telegram.handle_update(db, {"message": {"chat": {"id": 8001, "type": "private"}, "text": f"/start {code}"}})
    status = client.get("/api/v1/me/telegram", headers=manager).json()
    assert status["connected"] and status["scope"] == "own"

    snapshot = client.get("/api/v1/state", headers=manager).json()
    interaction_id = next(item["id"] for item in snapshot["state"]["interactions"] if item["managerId"] == "usr-1" and not item.get("completedAt"))
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-telegram-own-manager")
    saved = client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=manager)
    assert saved.status_code == 200, saved.text
    telegram.notifier.wait()
    assert [chat for chat, text in bot.sent if chat == 8001 and "Переход" in text]


def test_outbox_survives_send_failure_and_retries(client: TestClient, bot: FakeTelegram, monkeypatch) -> None:
    monkeypatch.setattr(settings, "telegram_outbox_enabled", True)
    manager = _headers(client, "manager")
    link = client.post("/api/v1/me/telegram/link", headers=manager).json()["url"]
    with SessionLocal() as db:
        telegram.handle_update(db, {"message": {"chat": {"id": 8002, "type": "private"}, "text": f"/start {link.split('start=')[1]}"}})

    snapshot = client.get("/api/v1/state", headers=manager).json()
    interaction_id = next(item["id"] for item in snapshot["state"]["interactions"] if item["managerId"] == "usr-1" and not item.get("completedAt"))
    state = _transition(copy.deepcopy(snapshot["state"]), interaction_id, "ev-outbox-retry")
    saved = client.put("/api/v1/state", json={"state": state, "expectedRevision": snapshot["revision"]}, headers=manager)
    assert saved.status_code == 200, saved.text
    with SessionLocal() as db:
        for other in db.scalars(select(TelegramDeliveryModel).where(TelegramDeliveryModel.chat_id != 8002)):
            other.delivered_at = datetime.now(UTC)
        db.commit()
        queued = db.scalar(select(TelegramDeliveryModel).where(TelegramDeliveryModel.event_id == "ev-outbox-retry", TelegramDeliveryModel.chat_id == 8002))
        assert queued and queued.delivered_at is None

    original_send = bot.send_message
    failed = False

    def send_once_with_failure(chat_id, text, *, button=None):
        nonlocal failed
        if not failed:
            failed = True
            raise telegram.TelegramError("temporary outage")
        original_send(chat_id, text, button=button)

    monkeypatch.setattr(bot, "send_message", send_once_with_failure)
    assert telegram.deliver_outbox_once()
    with SessionLocal() as db:
        queued = db.scalar(select(TelegramDeliveryModel).where(TelegramDeliveryModel.event_id == "ev-outbox-retry", TelegramDeliveryModel.chat_id == 8002))
        assert queued.attempts == 1 and queued.delivered_at is None
        queued.next_attempt_at = datetime.now(UTC)
        db.commit()
    assert telegram.deliver_outbox_once()
    with SessionLocal() as db:
        queued = db.scalar(select(TelegramDeliveryModel).where(TelegramDeliveryModel.event_id == "ev-outbox-retry", TelegramDeliveryModel.chat_id == 8002))
        assert queued.delivered_at is not None
    assert len([message for chat, message in bot.sent if chat == 8002 and "Переход" in message]) == 1


def test_chat_without_username_keeps_the_name_separately(client: TestClient, bot: FakeTelegram) -> None:
    lead = _headers(client, "lead")
    code = client.post("/api/v1/me/telegram/link", headers=lead).json()["url"].split("start=")[1]
    with SessionLocal() as db:
        telegram.handle_update(db, {"message": {"chat": {"id": 7001, "type": "private"}, "from": {"first_name": "Алексей", "last_name": "Козлов"}, "text": f"/start {code}"}})
    status = client.get("/api/v1/me/telegram", headers=lead).json()
    assert status["username"] is None and status["chatName"] == "Алексей Козлов"


def test_failed_getme_is_not_repeated_on_every_status_request(monkeypatch) -> None:
    calls = []

    class Offline(FakeTelegram):
        def get_me(self) -> dict:
            calls.append(1)
            raise telegram.TelegramError("нет связи")

    monkeypatch.setattr(telegram, "get_client", lambda: Offline())
    monkeypatch.setattr(settings, "telegram_bot_token", "offline-token")
    telegram._bot_username.clear()
    telegram._username_failed_at.clear()
    assert telegram.bot_username() is None and telegram.bot_username() is None
    assert len(calls) == 1, "повторный запрос ждёт минуту, а не таймаутов подключения"


def test_worker_heartbeat_expires(monkeypatch, tmp_path) -> None:
    path = tmp_path / "heartbeat"
    monkeypatch.setattr(settings, "telegram_heartbeat_path", path)
    monkeypatch.setattr(telegram, "poller", None)
    assert telegram.polling_healthy() is False
    path.write_text(str(time.time()))
    assert telegram.polling_healthy() is True
    path.write_text(str(time.time() - telegram.POLL_HEALTH_SECONDS - 1))
    assert telegram.polling_healthy() is False


def test_contacts_are_masked_before_leaving_for_telegram() -> None:
    from app.services.telegram import mask_contacts

    masked = mask_contacts("Ирина: +7 (912) 345-67-89, i.ivanova@kpfu.ru; договор № 12/2026 от 01.10.2026")
    assert "912" not in masked and "kpfu" not in masked
    assert "[телефон скрыт]" in masked and "[почта скрыта]" in masked and "12/2026 от 01.10.2026" in masked
