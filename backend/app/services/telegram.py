"""Telegram-бот CRM: сотрудники привязывают чаты и получают смены этапов.

Как это устроено:
* привязка — одноразовая ссылка ``t.me/<бот>?start=<код>`` из настроек профиля; бот получает
  ``/start <код>`` и записывает chat_id в карточку сотрудника (поле ``telegram``, его видит только сервер);
* уведомления — после сохранения ищем новые события смены этапа и отправляем
  менеджеру, его руководителю и администраторам. В Docker очередь хранится в БД;
* входящие сообщения — long polling (``getUpdates``) в фоновом потоке: публичный адрес не нужен.
"""

from __future__ import annotations

import copy
import html
import logging
import os
import re
import secrets
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.errors import APIError
from app.core.security import Principal
from app.domain.state import find_principal_user
from app.models.telegram_delivery import TelegramDeliveryModel
from app.services.state import get_state, mutate_state


logger = logging.getLogger(__name__)

LINK_TTL = timedelta(minutes=15)
POLL_TIMEOUT_SECONDS = 25
MAX_COMMENT_LENGTH = 500
# Серверы Telegram за рубежом: сообщение — трансграничная передача (152-ФЗ, ст. 12). Поэтому в него
# попадает минимум ПДн — имя и инициал фамилии сотрудника, а почты и телефоны в комментарии скрываются.
EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_PATTERN = re.compile(r"(?<![\w])\+?\d[\d\s()\-]{5,}\d")
NOTIFIED_EVENT_TYPES = {"transition", "completed"}
# Даты в сообщениях — по Москве: события хранятся в UTC, и около полуночи день иначе «съезжает».
DISPLAY_TZ = ZoneInfo("Europe/Moscow")
# Если Telegram не ответил на getMe, не спрашиваем снова минуту — иначе каждый запрос
# статуса из браузера ждал бы таймаутов подключения.
USERNAME_RETRY_SECONDS = 60
POLL_HEALTH_SECONDS = 90


class TelegramError(Exception):
    """Bot API вернул ошибку или недоступен."""


# ---------------------------------------------------------------------------
# Клиент Bot API
# ---------------------------------------------------------------------------


CONNECT_TIMEOUT_SECONDS = 5
PROXY_CONNECT_TIMEOUT_SECONDS = 20
CONNECT_ATTEMPTS = 3


class TelegramClient:
    """Клиент Bot API. Держит соединения открытыми и повторяет неудачное подключение:
    часть адресов Telegram из некоторых сетей отвечает не с первого раза."""

    def __init__(self, token: str, api_url: str, timeout: float, proxy: str | None = None) -> None:
        self._base = f"{api_url.rstrip('/')}/bot{token}"
        self._timeout = timeout
        self._connect_timeout = PROXY_CONNECT_TIMEOUT_SECONDS if proxy else CONNECT_TIMEOUT_SECONDS
        self._http = httpx.Client(proxy=proxy, timeout=httpx.Timeout(timeout, connect=self._connect_timeout))

    def _post(self, method: str, payload: dict[str, Any], timeout: float) -> httpx.Response:
        for attempt in range(CONNECT_ATTEMPTS):
            try:
                return self._http.post(
                    f"{self._base}/{method}",
                    json=payload,
                    timeout=httpx.Timeout(timeout, connect=self._connect_timeout),
                )
            except (httpx.ConnectError, httpx.ConnectTimeout):
                # Запрос не дошёл до Telegram — повтор безопасен даже для sendMessage.
                if attempt == CONNECT_ATTEMPTS - 1:
                    raise
        raise AssertionError("unreachable")

    def _call(self, method: str, payload: dict[str, Any] | None = None, *, timeout: float | None = None) -> Any:
        try:
            body = self._post(method, payload or {}, timeout or self._timeout).json()
        except (httpx.HTTPError, ValueError) as exc:
            # Текст исключения httpx содержит URL с токеном — в лог его не пишем.
            raise TelegramError(f"Telegram недоступен ({type(exc).__name__})") from None
        if not body.get("ok"):
            raise TelegramError(body.get("description") or f"Telegram отклонил {method}")
        return body.get("result")

    def get_me(self) -> dict[str, Any]:
        return self._call("getMe")

    def delete_webhook(self) -> None:
        self._call("deleteWebhook", {"drop_pending_updates": False})

    def set_profile(self, commands: list[tuple[str, str]], description: str, short_description: str) -> None:
        """Меню команд и тексты, которые Telegram показывает до нажатия «Старт»."""

        self._call("setMyCommands", {"commands": [{"command": name, "description": text} for name, text in commands]})
        self._call("setMyDescription", {"description": description})
        self._call("setMyShortDescription", {"short_description": short_description})

    def get_updates(self, offset: int | None) -> list[dict[str, Any]]:
        payload = {"timeout": POLL_TIMEOUT_SECONDS, "allowed_updates": ["message"]}
        if offset is not None:
            payload["offset"] = offset
        return self._call("getUpdates", payload, timeout=POLL_TIMEOUT_SECONDS + self._timeout)

    def send_message(self, chat_id: int, text: str, *, button: tuple[str, str] | None = None) -> None:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if button:
            payload["reply_markup"] = {"inline_keyboard": [[{"text": button[0], "url": button[1]}]]}
        self._call("sendMessage", payload)


@lru_cache
def _client_for(token: str, api_url: str, timeout: float, proxy: str | None) -> TelegramClient:
    return TelegramClient(token, api_url, timeout, proxy)


def get_client() -> TelegramClient | None:
    """Клиент бота или None, если токен не задан (бот выключен)."""

    if not settings.telegram_bot_token:
        return None
    return _client_for(settings.telegram_bot_token, settings.telegram_api_url, settings.telegram_timeout_seconds, settings.telegram_proxy_url)


_bot_username: dict[str, str] = {}
_username_failed_at: dict[str, float] = {}


def bot_username() -> str | None:
    """Имя бота для ссылки t.me. Узнаём у Telegram один раз; неудачу помним минуту."""

    client = get_client()
    token = settings.telegram_bot_token
    if client is None or token is None:
        return None
    if token in _bot_username:
        return _bot_username[token]
    if time.monotonic() - _username_failed_at.get(token, float("-inf")) < USERNAME_RETRY_SECONDS:
        return None
    try:
        _bot_username[token] = client.get_me()["username"]
    except (TelegramError, KeyError) as exc:
        _username_failed_at[token] = time.monotonic()
        logger.warning("Telegram getMe failed: %s", exc)
        return None
    return _bot_username[token]


# ---------------------------------------------------------------------------
# Текст уведомлений
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StageNotification:
    event_id: str
    chat_id: int
    text: str
    url: str | None
    # Когда можно отправлять: время сохранения + пауза на «Отменить» (по time.monotonic()).
    due_at: float


def _by_id(state: dict[str, Any], key: str) -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in state.get(key, []) if isinstance(item, dict) and "id" in item}


def _interaction_url(interaction_id: str) -> str | None:
    base = settings.public_app_url
    if not base:
        return None
    # Telegram не принимает кнопки-ссылки на локальные адреса.
    if (urlsplit(base).hostname or "") in {"localhost", "127.0.0.1", "0.0.0.0"}:
        return None
    return f"{base.rstrip('/')}/#/interactions/{interaction_id}"


# Фазы базового процесса (logic/Этапы.md) — смайлик помогает с одного взгляда понять, где заявка.
PHASES = {
    "acquaintance": "🤝 Знакомство",
    "contract": "📝 Договор",
    "rollout": "⚙️ Внедрение",
    "teaching": "🎓 Обучение",
}


def _kind(event: dict[str, Any], stages: list[dict[str, Any]]) -> str:
    if event["type"] == "completed":
        return "completed"
    positions = {stage["id"]: index for index, stage in enumerate(stages)}
    source = positions.get(event.get("fromStageId"), 0)
    target = positions.get(event.get("toStageId"), 0)
    if target < source:
        return "back"
    if target > source + 1:
        return "skip"
    return "next"


HEADLINES = {
    "next": "➡️ Переход на следующий этап",
    "skip": "⏭ Пропуск необязательного этапа",
    "back": "↩️ Возврат на доработку",
    "completed": "🏁 Взаимодействие завершено",
}
# Для возврата и пропуска комментарий обязателен (logic/Этапы.md) — называем его прямо.
COMMENT_LABELS = {"back": "⚠️ Причина", "skip": "💬 Почему пропустили"}


def _progress_bar(position: int, total: int) -> str:
    """Одна клетка — один этап процесса: пройденные и текущий закрашены."""
    return "▰" * position + "▱" * (total - position)


def _date(value: datetime) -> str:
    return value.astimezone(DISPLAY_TZ).strftime("%d.%m.%Y")


def _days(count: int) -> str:
    tail = count % 100
    if 11 <= tail <= 14:
        word = "дней"
    else:
        word = {1: "день", 2: "дня", 3: "дня", 4: "дня"}.get(count % 10, "дней")
    return f"{count} {word}"


def short_person_name(name: str | None) -> str:
    """«Алексей Козлов» → «Алексей К.»: руководителю понятно, кто это, а полное ФИО не уходит за рубеж."""

    parts = (name or "").split()
    if len(parts) < 2:
        return parts[0] if parts else ""
    return f"{parts[0]} {parts[-1][0]}."


def mask_contacts(text: str) -> str:
    """Почты и телефоны из свободного текста комментария в Telegram не передаются."""

    return PHONE_PATTERN.sub("[телефон скрыт]", EMAIL_PATTERN.sub("[почта скрыта]", text))


def format_stage_message(state: dict[str, Any], event: dict[str, Any], interaction: dict[str, Any]) -> str:
    """Уведомление в Telegram. Каждая строка начинается со смайлика-метки, чтобы сообщение
    читалось с одного взгляда: что случилось → какой вуз → куда перевели → срок → кто → комментарий."""

    escape = html.escape
    users = _by_id(state, "users")
    workflow = _by_id(state, "workflows").get(interaction.get("workflowId"), {})
    stages = workflow.get("stages", [])
    stage_by_id = {stage["id"]: stage for stage in stages}
    university = _by_id(state, "universities").get(interaction.get("universityId"), {})
    direction = _by_id(state, "directions").get(interaction.get("directionId"), {})
    product = _by_id(state, "products").get(interaction.get("productId"), {})
    kind = _kind(event, stages)

    short_name = university.get("shortName") or university.get("name") or "Вуз"
    full_name = university.get("name")
    university_line = f"🏛 <b>{escape(short_name)}</b>"
    if full_name and full_name != short_name:
        university_line += f" — {escape(full_name)}"
    lines = [f"<b>{HEADLINES[kind]}</b>", "", university_line]
    offer = " · ".join(
        part for part in (
            f"💻 {escape(direction['name'])}" if direction.get("name") else "",
            f"📦 {escape(product['name'])}" if product.get("name") else "",
        ) if part
    )
    if offer:
        lines.append(offer)
    lines.append("")

    to_stage = stage_by_id.get(event.get("toStageId"), {})
    from_stage = stage_by_id.get(event.get("fromStageId"), {})
    at = _parse(event["at"]) if event.get("at") else _now()
    if kind == "completed":
        lines.append(f"✅ Пройдены все {len(stages)} этапов")
        started = interaction.get("startedAt")
        if started:
            lines.append(f"🗓 В работе {_days(max(1, (at - _parse(started)).days))}: с {_date(_parse(started))} по {_date(at)}")
    else:
        lines.append(f"📍 «{escape(from_stage.get('name', '—'))}» → <b>«{escape(to_stage.get('name', '—'))}»</b>")
        positions = {stage["id"]: index for index, stage in enumerate(stages)}
        source = positions.get(event.get("fromStageId"))
        target = positions.get(event.get("toStageId"))
        if kind == "skip" and source is not None and target is not None:
            skipped = [stage["name"] for stage in stages[source + 1 : target]]
            lines.append(f"⏭ Пропущен: «{escape(', '.join(skipped))}»")
        position = target + 1 if target is not None else None
        if position:
            phase = PHASES.get(to_stage.get("phase"))
            lines.append(f"📊 Этап {position} из {len(stages)}  {_progress_bar(position, len(stages))}")
            if phase:
                lines.append(f"🧭 Фаза: {phase}")
        if to_stage.get("slaDays"):
            deadline = at + timedelta(days=to_stage["slaDays"])
            lines.append(f"⏳ Срок этапа: {_days(to_stage['slaDays'])}, до {_date(deadline)}")
    lines.append("")

    actor = users.get(event.get("userId"), {})
    manager = users.get(interaction.get("managerId"), {})
    lines.append(f"👤 Кто изменил: {escape(short_person_name(actor.get('name')) or 'Система')}")
    if manager and manager.get("id") != actor.get("id"):
        lines.append(f"🧑‍💼 Ответственный: {escape(short_person_name(manager.get('name')) or '—')}")

    comment = mask_contacts(str(event.get("comment") or "").strip())
    if comment:
        if len(comment) > MAX_COMMENT_LENGTH:
            comment = comment[: MAX_COMMENT_LENGTH - 1].rstrip() + "…"
        lines.append(f"{COMMENT_LABELS.get(kind, '💬 Комментарий')}: <i>{escape(comment)}</i>")
    files = event.get("files") or []
    if files:
        lines.append(f"📎 Файлов приложено: {len(files)}")
    return "\n".join(lines)


def stage_notifications(before: dict[str, Any], after: dict[str, Any]) -> list[StageNotification]:
    """Новые смены этапа между двумя версиями состояния и кому о них сообщить.

    Получатели с привязанным Telegram: ответственный менеджер — о своей заявке,
    его руководитель — о команде, администраторы — обо всех заявках.
    """

    known = {item.get("id") for item in before.get("events", []) if isinstance(item, dict)}
    users = _by_id(after, "users")
    interactions = _by_id(after, "interactions")
    admins = [item for item in users.values() if item.get("role") == "admin"]
    result: list[StageNotification] = []
    for event in after.get("events", []):
        if not isinstance(event, dict) or event.get("id") in known or event.get("type") not in NOTIFIED_EVENT_TYPES:
            continue
        interaction = interactions.get(event.get("interactionId"))
        if not interaction:
            continue
        manager = users.get(interaction.get("managerId"))
        lead = users.get(manager.get("leadId")) if manager else None
        chats: list[int] = []
        for recipient in ([manager] if manager else []) + ([lead] if lead else []) + admins:
            telegram = recipient.get("telegram") if isinstance(recipient.get("telegram"), dict) else {}
            chat_id = telegram.get("chatId")
            if chat_id and recipient.get("active") is not False and chat_id not in chats:
                chats.append(chat_id)
        if not chats:
            continue
        text = format_stage_message(after, event, interaction)
        url = _interaction_url(interaction["id"])
        due_at = time.monotonic() + settings.telegram_notify_delay_seconds
        result.extend(
            StageNotification(event_id=event["id"], chat_id=chat_id, text=text, url=url, due_at=due_at)
            for chat_id in chats
        )
    return result


# ---------------------------------------------------------------------------
# Отложенная отправка
# ---------------------------------------------------------------------------


class StageNotifier:
    """Отправляет уведомления в фоне, не задерживая сохранение состояния."""

    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="telegram-notify")
        self._futures: set[Future] = set()
        self._lock = threading.Lock()

    def on_state_saved(self, before: dict[str, Any], after: dict[str, Any]) -> None:
        if get_client() is None:
            return
        for notification in stage_notifications(before, after):
            future = self._executor.submit(self._deliver, notification)
            with self._lock:
                self._futures.add(future)
            future.add_done_callback(self._forget)

    def _forget(self, future: Future) -> None:
        with self._lock:
            self._futures.discard(future)

    def wait(self, timeout: float = 10) -> None:
        """Дождаться отправки всех уведомлений — для тестов и корректной остановки."""

        with self._lock:
            pending = list(self._futures)
        wait(pending, timeout=timeout)

    def _deliver(self, notification: StageNotification) -> None:
        # Ждём не «паузу целиком», а до due_at: если потоки были заняты, уведомления
        # не должны задерживаться ещё на 15 секунд каждое.
        remaining = notification.due_at - time.monotonic()
        if remaining > 0:
            time.sleep(remaining)
        # Пока шла пауза, менеджер мог нажать «Отменить» — тогда события в состоянии уже нет.
        if not _event_still_exists(notification.event_id):
            return
        client = get_client()
        if client is None:
            return
        button = ("Открыть карточку", notification.url) if notification.url else None
        try:
            client.send_message(notification.chat_id, notification.text, button=button)
        except TelegramError as exc:
            logger.warning("Telegram notification %s was not sent: %s", notification.event_id, exc)


def _event_still_exists(event_id: str) -> bool:
    with SessionLocal() as db:
        state = get_state(db).state
    return any(isinstance(item, dict) and item.get("id") == event_id for item in state.get("events", []))


notifier = StageNotifier()


def deliver_outbox_once() -> bool:
    """Отправляет одно подошедшее уведомление; при сбое оставляет его в базе для повтора."""

    client = get_client()
    if client is None:
        return False
    now = _now()
    with SessionLocal() as db:
        item = db.scalar(
            select(TelegramDeliveryModel)
            .where(TelegramDeliveryModel.delivered_at.is_(None), TelegramDeliveryModel.next_attempt_at <= now)
            .order_by(TelegramDeliveryModel.next_attempt_at, TelegramDeliveryModel.id)
            .limit(1)
        )
        if item is None:
            return False
        state = get_state(db).state
        event_exists = any(isinstance(event, dict) and event.get("id") == item.event_id for event in state.get("events", []))
        chat_connected = any(
            isinstance(user.get("telegram"), dict) and user["telegram"].get("chatId") == item.chat_id
            for user in state.get("users", [])
        )
        if not event_exists or not chat_connected:
            item.delivered_at = now
            db.commit()
            return True
        button = ("Открыть карточку", item.url) if item.url else None
        try:
            client.send_message(item.chat_id, item.text, button=button)
        except TelegramError as exc:
            item.attempts += 1
            delay = min(60, 2 ** min(item.attempts, 6))
            item.next_attempt_at = _now() + timedelta(seconds=delay)
            db.commit()
            logger.warning("Telegram delivery %s failed (%s); retry in %s s", item.id, exc, delay)
            return True
        item.delivered_at = _now()
        db.commit()
        return True


# ---------------------------------------------------------------------------
# Привязка чата к сотруднику
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# Кто может получать уведомления: руководитель — о своей команде, администратор — обо всех заявках.
RECIPIENT_SCOPE = {"manager": "own", "lead": "team", "admin": "all"}


def _require_recipient(user: dict[str, Any]) -> None:
    if user.get("role") not in RECIPIENT_SCOPE:
        raise APIError(403, "telegram_role_not_supported", "Уведомления в Telegram недоступны для этой роли.")


def status_for(user: dict[str, Any]) -> dict[str, Any]:
    telegram = user.get("telegram") if isinstance(user.get("telegram"), dict) else {}
    return {
        "configured": get_client() is not None,
        "available": user.get("role") in RECIPIENT_SCOPE,
        "polling": polling_healthy(),
        "scope": RECIPIENT_SCOPE.get(user.get("role")),
        "bot_username": bot_username(),
        "connected": bool(telegram.get("chatId")),
        "username": telegram.get("username"),
        "chat_name": telegram.get("name"),
        "linked_at": telegram.get("linkedAt"),
    }


def principal_status(db: Session, principal: Principal) -> dict[str, Any]:
    return status_for(find_principal_user(get_state(db).state, principal))


def create_link(db: Session, principal: Principal) -> dict[str, Any]:
    user = find_principal_user(get_state(db).state, principal)
    _require_recipient(user)
    if get_client() is None:
        raise APIError(503, "telegram_not_configured", "Telegram-бот не настроен: администратору нужно задать TELEGRAM_BOT_TOKEN.")
    username = bot_username()
    if username is None:
        raise APIError(502, "telegram_unavailable", "Не удалось связаться с Telegram. Попробуйте позже.")

    code = secrets.token_urlsafe(16)
    expires_at = _now() + LINK_TTL

    def remember(state: dict[str, Any]) -> None:
        target = next(item for item in state["users"] if item["id"] == user["id"])
        telegram = copy.deepcopy(target.get("telegram") or {})
        telegram.update({"linkCode": code, "linkExpiresAt": _iso(expires_at)})
        target["telegram"] = telegram

    mutate_state(db, remember)
    return {"url": f"https://t.me/{username}?start={code}", "expires_at": _iso(expires_at)}


def bind_chat(db: Session, code: str, chat: dict[str, Any], sender: dict[str, Any]) -> dict[str, Any] | None:
    """Привязать чат по коду из ссылки. Возвращает сотрудника или None, если код неизвестен или устарел."""

    now = _now()

    def bind(state: dict[str, Any]) -> dict[str, Any] | None:
        owner = None
        for item in state["users"]:
            telegram = item.get("telegram") if isinstance(item.get("telegram"), dict) else {}
            expires = telegram.get("linkExpiresAt")
            if telegram.get("linkCode") == code and expires and _parse(expires) > now:
                owner = item
                break
        if owner is None:
            return None
        # Один чат — один сотрудник: снимаем чат с прежнего владельца.
        for item in state["users"]:
            if item is not owner and isinstance(item.get("telegram"), dict) and item["telegram"].get("chatId") == chat["id"]:
                item.pop("telegram")
        owner["telegram"] = {
            "chatId": chat["id"],
            # username есть не у всех — тогда показываем имя из профиля Telegram.
            "username": sender.get("username"),
            "name": " ".join(part for part in (sender.get("first_name"), sender.get("last_name")) if part) or None,
            "linkedAt": _iso(now),
        }
        return copy.deepcopy(owner)

    _, owner = mutate_state(db, bind)
    return owner


def unlink(db: Session, *, user_id: str | None = None, chat_id: int | None = None) -> dict[str, Any] | None:
    """Отвязать чат по сотруднику или по самому чату. Возвращает прежнюю привязку."""

    def drop(state: dict[str, Any]) -> dict[str, Any] | None:
        for item in state["users"]:
            telegram = item.get("telegram") if isinstance(item.get("telegram"), dict) else None
            if telegram and (item["id"] == user_id or (chat_id is not None and telegram.get("chatId") == chat_id)):
                return item.pop("telegram")
        return None

    _, previous = mutate_state(db, drop)
    return previous


def disconnect(db: Session, principal: Principal) -> dict[str, Any]:
    user = find_principal_user(get_state(db).state, principal)
    previous = unlink(db, user_id=user["id"])
    client = get_client()
    if client and previous and previous.get("chatId"):
        try:
            client.send_message(previous["chatId"], f"🔕 <b>Уведомления отключены</b> в настройках профиля CRM.\n\nВернуть их можно там же:\n{CONNECT_HINT}")
        except TelegramError as exc:
            logger.info("Telegram goodbye message failed: %s", exc)
    return principal_status(db, principal)


def send_test(db: Session, principal: Principal) -> None:
    user = find_principal_user(get_state(db).state, principal)
    telegram = user.get("telegram") if isinstance(user.get("telegram"), dict) else {}
    client = get_client()
    if client is None:
        raise APIError(503, "telegram_not_configured", "Telegram-бот не настроен: администратору нужно задать TELEGRAM_BOT_TOKEN.")
    if not telegram.get("chatId"):
        raise APIError(409, "telegram_not_connected", "Сначала подключите Telegram.")
    try:
        client.send_message(
            telegram["chatId"],
            "🔔 <b>Проверка связи — всё работает!</b>\n\n"
            f"✅ Уведомления {SCOPE_TEXT.get(user.get('role'), 'о переходах заявок')} приходят в этот чат.\n\n"
            f"{LEGEND}",
        )
    except TelegramError as exc:
        raise APIError(502, "telegram_unavailable", f"Telegram не принял сообщение: {exc}") from None


def overview(db: Session) -> dict[str, Any]:
    """Сводка для страницы «Интеграции»: настроен ли бот и сколько руководителей подключено."""

    recipients = [
        item for item in get_state(db).state.get("users", [])
        if item.get("role") in RECIPIENT_SCOPE and item.get("active") is not False
    ]
    connected = sum(1 for item in recipients if isinstance(item.get("telegram"), dict) and item["telegram"].get("chatId"))
    return {
        "configured": get_client() is not None,
        "bot_username": bot_username(),
        "polling": polling_healthy(),
        "recipients": len(recipients),
        "connected": connected,
    }


# ---------------------------------------------------------------------------
# Входящие сообщения
# ---------------------------------------------------------------------------

BOT_COMMANDS = [
    ("start", "Как подключить уведомления"),
    ("status", "К какой учётной записи подключён чат"),
    ("stop", "Отключить уведомления"),
]
BOT_DESCRIPTION = (
    "Бот CRM ИТ Школы Ростелекома. Пишет руководителю (о его команде) и администратору (обо всех), когда менеджер переводит заявку "
    "на следующий этап, возвращает на доработку или завершает работу с вузом.\n\n"
    "Подключение: CRM → «Настройки профиля» → «Подключить Telegram»."
)
BOT_SHORT_DESCRIPTION = "Уведомления CRM ИТ Школы о смене этапа заявок."

CONNECT_HINT = "⚙️ CRM → «Настройки профиля» → «Подключить Telegram»"

HELP_TEXT = (
    "👋 <b>Бот CRM ИТ Школы Ростелекома</b>\n\n"
    "Сообщаю, когда менеджеры переводят заявки вузов на другой этап:\n"
    "👔 руководителю — о заявках его команды\n"
    "🛡 администратору — обо всех заявках\n\n"
    f"🔗 <b>Как подключиться</b>\n{CONNECT_HINT}\n\n"
    "📋 <b>Команды</b>\n"
    "/status — 🔎 к какой учётной записи подключён чат\n"
    "/stop — 🔕 отключить уведомления"
)

LEGEND = (
    "📖 <b>Как читать уведомления</b>\n"
    "➡️ следующий этап · ⏭ пропуск · ↩️ возврат на доработку · 🏁 завершено\n"
    "🏛 вуз · 💻 направление · 📦 продукт\n"
    "📍 куда перевели · 📊 прогресс · ⏳ срок этапа\n"
    "👤 кто изменил · 💬 комментарий · 📎 файлы"
)

SCOPE_TEXT = {"manager": "о ваших заявках", "lead": "о заявках вашей команды", "admin": "обо всех заявках"}


def _owner_of_chat(db: Session, chat_id: int) -> dict[str, Any] | None:
    return next(
        (
            item for item in get_state(db).state.get("users", [])
            if isinstance(item.get("telegram"), dict) and item["telegram"].get("chatId") == chat_id
        ),
        None,
    )


def handle_update(db: Session, update: dict[str, Any]) -> str | None:
    """Обработать входящее сообщение и вернуть ответ бота (или None)."""

    message = update.get("message") if isinstance(update.get("message"), dict) else None
    if not message or not isinstance(message.get("chat"), dict):
        return None
    chat = message["chat"]
    if chat.get("type") != "private":
        return None
    text = str(message.get("text") or "").strip()
    command, _, argument = text.partition(" ")
    command = command.split("@")[0].lower()

    if command == "/start" and argument.strip():
        owner = bind_chat(db, argument.strip(), chat, message.get("from") or {})
        if owner is None:
            connected = _owner_of_chat(db, chat["id"])
            if connected:
                return f"✅ <b>Чат уже подключён к CRM</b>\n\n👤 Учётная запись: <b>{html.escape(connected.get('name', ''))}</b>"
            return f"⌛ <b>Ссылка устарела или уже использована</b>\n\nПолучите новую:\n{CONNECT_HINT}"
        name = html.escape(owner.get("name", ""))
        scope = SCOPE_TEXT.get(owner.get("role"), "о переходах заявок")
        return (
            f"✅ <b>Готово, чат подключён!</b>\n\n"
            f"👤 Учётная запись: <b>{name}</b>\n"
            f"🔔 Буду писать {scope}: переходы этапов, возвраты на доработку и завершения.\n\n"
            f"{LEGEND}\n\n"
            "🔕 Отключить — /stop"
        )
    if command == "/status":
        owner = _owner_of_chat(db, chat["id"])
        if owner is None:
            return f"🔌 <b>Чат не подключён к CRM</b>\n\nЧтобы получать уведомления:\n{CONNECT_HINT}"
        linked = owner["telegram"].get("linkedAt")
        since = f" с {_date(_parse(linked))}" if linked else ""
        return (
            "🟢 <b>Уведомления включены</b>\n\n"
            f"👤 Учётная запись: <b>{html.escape(owner.get('name', ''))}</b>{since}\n"
            f"🔔 Приходят сообщения {SCOPE_TEXT.get(owner.get('role'), 'о переходах заявок')}\n\n"
            "🔕 Отключить — /stop"
        )
    if command == "/stop":
        previous = unlink(db, chat_id=chat["id"])
        if not previous:
            return f"🔌 <b>Чат и так не подключён к CRM</b>\n\nПодключить:\n{CONNECT_HINT}"
        return f"🔕 <b>Уведомления отключены</b>\n\nВернуть их можно в любой момент:\n{CONNECT_HINT}"
    return HELP_TEXT


class TelegramPoller(threading.Thread):
    """Получает сообщения бота через long polling и отвечает на них."""

    def __init__(self, client: TelegramClient) -> None:
        super().__init__(name="telegram-poller", daemon=True)
        self._client = client
        self._stopped = threading.Event()
        self._last_success: float | None = None

    @property
    def healthy(self) -> bool:
        """Поток жив и недавно получил ответ от Telegram (а не просто крутится с ошибками)."""

        if not self.is_alive() or self._last_success is None:
            return False
        return time.monotonic() - self._last_success < POLL_HEALTH_SECONDS

    def _record_success(self) -> None:
        self._last_success = time.monotonic()
        path = settings.telegram_heartbeat_path
        if path:
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(".tmp")
                temporary.write_text(str(time.time()))
                os.replace(temporary, path)
            except OSError as exc:
                logger.warning("Telegram heartbeat write failed: %s", type(exc).__name__)

    def stop(self) -> None:
        self._stopped.set()

    def run(self) -> None:
        offset: int | None = None
        ready = False
        while not self._stopped.is_set():
            try:
                if not ready:
                    # getUpdates не работает, пока у бота задан webhook; меню команд — заодно.
                    self._client.delete_webhook()
                    self._client.set_profile(BOT_COMMANDS, BOT_DESCRIPTION, BOT_SHORT_DESCRIPTION)
                    ready = True
                    logger.info("Telegram bot is ready")
                updates = self._client.get_updates(offset)
                self._record_success()
            except TelegramError as exc:
                logger.warning("Telegram polling failed: %s", exc)
                self._stopped.wait(5)
                continue
            for update in updates:
                try:
                    with SessionLocal() as db:
                        reply = handle_update(db, update)
                    if reply:
                        while not self._stopped.is_set():
                            try:
                                self._client.send_message(update["message"]["chat"]["id"], reply)
                                break
                            except TelegramError as exc:
                                logger.warning("Telegram reply failed: %s", exc)
                                self._stopped.wait(5)
                except Exception:  # noqa: BLE001 — одно сломанное сообщение не должно останавливать бота.
                    logger.exception("Telegram update %s failed", update.get("update_id"))
                # Подтверждаем update только после ответа: при кратком сетевом сбое
                # бот продолжит отправку, а не потеряет команду пользователя.
                offset = update["update_id"] + 1


poller: TelegramPoller | None = None


def polling_healthy() -> bool:
    if poller and poller.healthy:
        return True
    path = settings.telegram_heartbeat_path
    if not path:
        return False
    try:
        return time.time() - float(path.read_text()) < POLL_HEALTH_SECONDS
    except (OSError, ValueError):
        return False


def start_bot() -> None:
    global poller
    client = get_client()
    if client is None or not settings.telegram_polling_enabled or (poller and poller.is_alive()):
        return
    poller = TelegramPoller(client)
    poller.start()
    logger.info("Telegram bot polling started")


def stop_bot() -> None:
    if poller:
        poller.stop()
    notifier.wait(timeout=1)
