"""Эндпоинты ИИ-помощника (только с токеном): диалог с локальной моделью и её доступность."""

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.domain.state import find_principal_user
from app.schemas.assistant import AssistantStatus, ChatRequest, ChatResponse
from app.schemas.common import ERROR_RESPONSES
from app.services import assistant
from app.services.state import get_state


router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses=ERROR_RESPONSES,
    summary="Ответ локального помощника: текст или действие для выполнения в браузере",
)
async def assistant_chat(payload: ChatRequest, db: DbSession, principal: CurrentPrincipal) -> ChatResponse:
    state = get_state(db).state
    user = find_principal_user(state, principal)
    # Устаревший токен не должен давать помощнику больше прав, чем текущая роль в CRM.
    role = user.get("role") if user.get("role") == principal.role else "manager"
    return await assistant.chat(payload, state, role)


@router.get(
    "/status",
    response_model=AssistantStatus,
    responses=ERROR_RESPONSES,
    summary="Доступна ли локальная модель помощника",
)
async def assistant_status(principal: CurrentPrincipal) -> AssistantStatus:
    return await assistant.status()
