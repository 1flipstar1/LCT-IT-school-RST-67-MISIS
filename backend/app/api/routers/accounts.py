"""Employee accounts: CRM card + Keycloak identity, managed from «Пользователи и доступ»."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentPrincipal, DbSession
from app.schemas.accounts import AccountCreateRequest, AccountResult, AccountRoleRequest, AccountsStatus, AccountStatusRequest
from app.schemas.common import ERROR_RESPONSES
from app.services import accounts


router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/status", response_model=AccountsStatus, responses=ERROR_RESPONSES, summary="Подключён ли Keycloak для управления учётными записями")
def read_status(principal: CurrentPrincipal) -> AccountsStatus:
    return accounts.accounts_status()


@router.post("", response_model=AccountResult, responses=ERROR_RESPONSES, summary="Создать сотрудника: учётная запись Keycloak + карточка CRM")
def create_account(payload: AccountCreateRequest, db: DbSession, principal: CurrentPrincipal) -> AccountResult:
    return accounts.create_account(db, payload, principal)


@router.put("/{user_id}/role", response_model=AccountResult, responses=ERROR_RESPONSES, summary="Изменить роль (группа в Keycloak и роль в CRM)")
def change_role(user_id: str, payload: AccountRoleRequest, db: DbSession, principal: CurrentPrincipal) -> AccountResult:
    return accounts.change_role(db, user_id, payload.role, principal)


@router.put("/{user_id}/status", response_model=AccountResult, responses=ERROR_RESPONSES, summary="Заблокировать или разблокировать сотрудника")
def set_status(user_id: str, payload: AccountStatusRequest, db: DbSession, principal: CurrentPrincipal) -> AccountResult:
    return accounts.set_active(db, user_id, payload.active, principal)


@router.post("/{user_id}/password", response_model=AccountResult, responses=ERROR_RESPONSES, summary="Выдать новый временный пароль")
def reset_password(user_id: str, db: DbSession, principal: CurrentPrincipal) -> AccountResult:
    return accounts.reset_password(db, user_id, principal)
