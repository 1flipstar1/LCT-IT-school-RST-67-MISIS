"""Small, bounded text-only chat contract."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints


ChatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: ChatText


class ChatRequest(BaseModel):
    message: ChatText
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)
    page: Literal["dashboard", "interactions", "reports", "help", "other"] = "other"


class ChatResponse(BaseModel):
    type: Literal["message"] = "message"
    message: str
