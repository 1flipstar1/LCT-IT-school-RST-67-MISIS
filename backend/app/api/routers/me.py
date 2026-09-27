"""Settings of the signed-in employee that live on the server, not in the browser."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import Field

from app.api.dependencies import CurrentPrincipal, DbSession
from app.domain.state import find_principal_user, project_state_for_principal
from app.schemas.common import APIModel, ERROR_RESPONSES
from app.schemas.state import StateSnapshotResponse
from app.services.state import get_state, mutate_state


router = APIRouter(prefix="/me", tags=["me"])


class OnboardingRequest(APIModel):
    # completed — прошёл курс до конца, skipped — пропустил, reset — показать снова при следующем входе.
    status: Literal["completed", "skipped", "reset"]


@router.put(
    "/onboarding",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Отметить, что сотрудник прошёл или пропустил вводный курс",
)
def update_onboarding(payload: OnboardingRequest, db: DbSession, principal: CurrentPrincipal) -> StateSnapshotResponse:
    user_id = find_principal_user(get_state(db).state, principal)["id"]

    def mark(state: dict[str, Any]) -> None:
        user = next(item for item in state["users"] if item["id"] == user_id)
        if payload.status == "reset":
            user.pop("onboarding", None)
        else:
            user["onboarding"] = {"status": payload.status, "at": datetime.now(UTC).isoformat().replace("+00:00", "Z")}

    snapshot, _ = mutate_state(db, mark)
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    return snapshot


class PreferencesRequest(APIModel):
    """Личные настройки интерфейса. Значения — закрытые списки: чужое значение сервер отклонит с 422."""

    avatar: str | None = Field(default=None, max_length=40)
    ui_scale: Literal[100, 110, 120, 130] = 110
    reduce_motion: bool = False
    show_badges: bool = True
    show_hints: bool = True
    shortcuts: bool = True
    start_page: Literal["/", "/interactions", "/analytics", "/reports"] = "/"
    interaction_view: Literal["board", "table"] = "board"
    interaction_sort: Literal["urgency", "updated", "university", "progress"] = "urgency"
    toast_duration: Literal[4000, 6000, 10000] = 6000


@router.put(
    "/preferences",
    response_model=StateSnapshotResponse,
    responses=ERROR_RESPONSES,
    summary="Сохранить личные настройки интерфейса сотрудника",
)
def update_preferences(payload: PreferencesRequest, db: DbSession, principal: CurrentPrincipal) -> StateSnapshotResponse:
    user_id = find_principal_user(get_state(db).state, principal)["id"]

    def save(state: dict[str, Any]) -> None:
        user = next(item for item in state["users"] if item["id"] == user_id)
        user["preferences"] = payload.model_dump(by_alias=True)

    snapshot, _ = mutate_state(db, save)
    snapshot.state = project_state_for_principal(snapshot.state, principal)
    return snapshot
