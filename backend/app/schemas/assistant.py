"""Контракт чата с помощником: модель отвечает текстом или выбирает одно действие, которое выполнит браузер."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints


ChatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

AssistantPage = Literal[
    "dashboard",
    "profile",
    "interactions",
    "analytics",
    "reports",
    "catalogs",
    "workflows",
    "integrations",
    "users",
    "audit",
    "help",
    "other",
]

# Зеркало frontend/src/features/assistant/engine/tools.js — действия выполняет браузер с правами пользователя.
ActionName = Literal[
    "create_report",
    "repeat_last_report",
    "find_interactions",
    "show_stats",
    "open_page",
    "open_interaction",
    "change_stage",
    "add_comment",
    "interaction_details",
    "university_contacts",
    "manager_workload",
    "daily_plan",
]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: ChatText


class ChatRequest(BaseModel):
    message: ChatText
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)
    page: AssistantPage = "other"
    # «agent» — модель может выбрать действие; «guide» — только объясняет, как сделать это в интерфейсе.
    mode: Literal["agent", "guide"] = "agent"
    detail: Literal["short", "detailed"] = "short"


class AssistantAction(BaseModel):
    name: ActionName
    arguments: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    type: Literal["message", "action"] = "message"
    message: str = ""
    action: AssistantAction | None = None


class AssistantStatus(BaseModel):
    enabled: bool
    available: bool
    model: str
