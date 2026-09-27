"""Telegram-бот: подключение руководителя и сводка для страницы «Интеграции»."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.core.errors import APIError
from app.schemas.common import ERROR_RESPONSES, APIModel
from app.services import telegram


router = APIRouter(tags=["telegram"])


class TelegramStatus(APIModel):
    configured: bool
    available: bool
    polling: bool
    scope: str | None = None
    bot_username: str | None = None
    connected: bool
    username: str | None = None
    chat_name: str | None = None
    linked_at: str | None = None


class TelegramLink(APIModel):
    url: str
    expires_at: str


class TelegramOverview(APIModel):
    configured: bool
    bot_username: str | None = None
    polling: bool
    recipients: int
    connected: int


@router.get("/me/telegram", response_model=TelegramStatus, responses=ERROR_RESPONSES, summary="Подключён ли Telegram у текущего сотрудника")
def read_status(db: DbSession, principal: CurrentPrincipal) -> TelegramStatus:
    return TelegramStatus(**telegram.principal_status(db, principal))


@router.post("/me/telegram/link", response_model=TelegramLink, responses=ERROR_RESPONSES, summary="Одноразовая ссылка для подключения чата")
def create_link(db: DbSession, principal: CurrentPrincipal) -> TelegramLink:
    return TelegramLink(**telegram.create_link(db, principal))


@router.post("/me/telegram/test", status_code=204, responses=ERROR_RESPONSES, summary="Отправить тестовое сообщение в подключённый чат")
def send_test(db: DbSession, principal: CurrentPrincipal) -> None:
    telegram.send_test(db, principal)


@router.delete("/me/telegram", response_model=TelegramStatus, responses=ERROR_RESPONSES, summary="Отключить уведомления в Telegram")
def disconnect(db: DbSession, principal: CurrentPrincipal) -> TelegramStatus:
    return TelegramStatus(**telegram.disconnect(db, principal))


@router.get("/telegram/status", response_model=TelegramOverview, responses=ERROR_RESPONSES, summary="Состояние бота для страницы «Интеграции»")
def read_overview(db: DbSession, principal: CurrentPrincipal) -> TelegramOverview:
    if principal.role not in {"lead", "admin"}:
        raise APIError(403, "forbidden", "Состояние интеграций видят руководитель и администратор.")
    return TelegramOverview(**telegram.overview(db))
