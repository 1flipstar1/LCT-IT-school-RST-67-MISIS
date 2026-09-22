"""Read-only resource views projected from the canonical snapshot."""

from __future__ import annotations

from typing import Any, Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import DbSession, StateAccess
from app.schemas.common import ERROR_RESPONSES
from app.schemas.state import CollectionResponse, DataResponse, StateSnapshotResponse
from app.services.state import get_state_for_principal


router = APIRouter(tags=["resources"])


def _collection(
    snapshot: StateSnapshotResponse,
    key: str,
    *,
    offset: int = 0,
    limit: int = 1000,
) -> CollectionResponse:
    value = snapshot.state.get(key, [])
    items = value if isinstance(value, list) else []
    return CollectionResponse(
        items=items[offset : offset + limit],
        total=len(items),
        revision=snapshot.revision,
        updated_at=snapshot.updated_at,
    )


def _page_params(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=5000)] = 1000,
) -> tuple[int, int]:
    return offset, limit


@router.get(
    "/catalogs",
    response_model=DataResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить справочники",
)
def catalogs(db: DbSession, _: StateAccess) -> DataResponse:
    snapshot = get_state_for_principal(db, _)
    keys = ("universities", "directions", "programs", "products")
    return DataResponse(
        data={key: snapshot.state.get(key, []) for key in keys},
        revision=snapshot.revision,
        updated_at=snapshot.updated_at,
    )


@router.get(
    "/interactions",
    response_model=CollectionResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить взаимодействия",
)
def interactions(
    db: DbSession,
    _: StateAccess,
    page: Annotated[tuple[int, int], Depends(_page_params)],
    manager_id: Annotated[str | None, Query(alias="managerId")] = None,
    university_id: Annotated[str | None, Query(alias="universityId")] = None,
    direction_id: Annotated[str | None, Query(alias="directionId")] = None,
    product_id: Annotated[str | None, Query(alias="productId")] = None,
    stage_id: Annotated[str | None, Query(alias="stageId")] = None,
) -> CollectionResponse:
    snapshot = get_state_for_principal(db, _)
    value = snapshot.state.get("interactions", [])
    items: list[Any] = value if isinstance(value, list) else []
    filters = {
        "managerId": manager_id,
        "universityId": university_id,
        "directionId": direction_id,
        "productId": product_id,
        "stageId": stage_id,
    }
    for field, expected in filters.items():
        if expected is not None:
            items = [item for item in items if isinstance(item, dict) and item.get(field) == expected]
    offset, limit = page
    return CollectionResponse(
        items=items[offset : offset + limit],
        total=len(items),
        revision=snapshot.revision,
        updated_at=snapshot.updated_at,
    )


@router.get("/workflows", response_model=CollectionResponse, summary="Получить процессы")
def workflows(db: DbSession, _: StateAccess, page: Annotated[tuple[int, int], Depends(_page_params)]) -> CollectionResponse:
    return _collection(get_state_for_principal(db, _), "workflows", offset=page[0], limit=page[1])


@router.get("/users", response_model=CollectionResponse, summary="Получить пользователей")
def users(db: DbSession, _: StateAccess, page: Annotated[tuple[int, int], Depends(_page_params)]) -> CollectionResponse:
    return _collection(get_state_for_principal(db, _), "users", offset=page[0], limit=page[1])


@router.get("/audit", response_model=CollectionResponse, summary="Получить журнал аудита")
def audit(db: DbSession, _: StateAccess, page: Annotated[tuple[int, int], Depends(_page_params)]) -> CollectionResponse:
    return _collection(get_state_for_principal(db, _), "audit", offset=page[0], limit=page[1])


@router.get("/reports", response_model=CollectionResponse, summary="Получить сохранённые отчёты")
def reports(db: DbSession, _: StateAccess, page: Annotated[tuple[int, int], Depends(_page_params)]) -> CollectionResponse:
    return _collection(get_state_for_principal(db, _), "reports", offset=page[0], limit=page[1])


@router.get(
    "/integrations",
    response_model=DataResponse,
    responses={401: ERROR_RESPONSES[401]},
    summary="Получить состояние интеграций",
)
def integrations(db: DbSession, _: StateAccess) -> DataResponse:
    snapshot = get_state_for_principal(db, _)
    value = snapshot.state.get("integrations", {})
    return DataResponse(
        data=value if isinstance(value, dict) else {},
        revision=snapshot.revision,
        updated_at=snapshot.updated_at,
    )
