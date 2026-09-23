"""Versioned API router assembly."""

from fastapi import APIRouter

from app.api.routers import attachments, auth, facades, health, imports, integrations, reports, state


api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(state.router)
api_router.include_router(attachments.router)
api_router.include_router(integrations.router)
api_router.include_router(facades.router)
api_router.include_router(imports.router)
api_router.include_router(reports.router)
