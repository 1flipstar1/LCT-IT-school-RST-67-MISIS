"""Versioned API router assembly."""

from fastapi import APIRouter

from app.api.routers import accounts, assistant, attachments, auth, facades, health, imports, integrations, me, state


api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(me.router)
api_router.include_router(assistant.router)
api_router.include_router(state.router)
api_router.include_router(attachments.router)
api_router.include_router(integrations.router)
api_router.include_router(imports.router)
api_router.include_router(facades.router)
