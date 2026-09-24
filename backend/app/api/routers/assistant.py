"""Authenticated, text-only assistant endpoint."""

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.domain.state import find_principal_user
from app.schemas.assistant import ChatRequest, ChatResponse
from app.schemas.common import ERROR_RESPONSES
from app.services.assistant import chat
from app.services.state import get_state


router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses=ERROR_RESPONSES,
    summary="Получить текстовый ответ локального помощника",
)
async def assistant_chat(payload: ChatRequest, db: DbSession, principal: CurrentPrincipal) -> ChatResponse:
    state = get_state(db).state
    find_principal_user(state, principal)
    return ChatResponse(message=await chat(payload, state))
