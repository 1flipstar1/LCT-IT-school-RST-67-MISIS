"""Shared Pydantic conventions and documented error schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class ErrorBody(APIModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(APIModel):
    error: ErrorBody


ERROR_RESPONSES = {
    401: {"model": ErrorResponse, "description": "Authorization is required or invalid."},
    409: {"model": ErrorResponse, "description": "The supplied revision is stale."},
    422: {"model": ErrorResponse, "description": "Request validation failed."},
    500: {"model": ErrorResponse, "description": "Unexpected server error."},
}
