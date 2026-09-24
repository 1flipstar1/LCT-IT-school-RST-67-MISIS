"""Authenticated assistant endpoints: chat with the local model and its availability."""

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
    find_principal_user(state, principal)
    return await assistant.chat(payload, state)


@router.get(
    "/status",
    response_model=AssistantStatus,
    responses=ERROR_RESPONSES,
    summary="Доступна ли локальная модель помощника",
)
async def assistant_status(principal: CurrentPrincipal) -> AssistantStatus:
    return await assistant.status()
