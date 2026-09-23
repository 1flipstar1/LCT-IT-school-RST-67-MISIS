"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.database import SessionLocal, create_database_schema
from app.core.errors import install_error_handlers
from app.services.state import initialize_state


OPENAPI_TAGS = [
    {"name": "health", "description": "Проверка готовности приложения и базы данных."},
    {"name": "auth", "description": "Демо-JWT и проверка текущего пользователя."},
    {"name": "state", "description": "Версионная синхронизация всего состояния CRM."},
    {"name": "attachments", "description": "Загрузка и скачивание файлов этапов."},
    {"name": "integrations", "description": "Получение JSON из LMS и сайта."},
    {"name": "resources", "description": "Read-only представления данных из snapshot."},
    {"name": "imports", "description": "Асинхронный импорт XLS/XLSX через объектное хранилище и очередь."},
    {"name": "reports", "description": "Асинхронное формирование и скачивание отчётов."},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_database_schema()
    with SessionLocal() as db:
        initialize_state(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Backend CRM ИТ Школы Ростелекома. Каноническое состояние синхронизируется "
            "через optimistic locking по полю revision."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
    )

    allow_origins = settings.cors_origin_list
    allow_credentials = "*" not in allow_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["ETag"],
    )
    install_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    if settings.frontend_dist_path.is_dir():
        # Registered after API routes so /api/v1/* always keeps API semantics.
        app.mount(
            "/",
            StaticFiles(directory=settings.frontend_dist_path, html=True),
            name="frontend",
        )
    else:
        @app.get("/", include_in_schema=False)
        def api_index() -> JSONResponse:
            return JSONResponse(
                {
                    "name": settings.app_name,
                    "version": settings.app_version,
                    "docs": "/docs",
                    "health": f"{settings.api_v1_prefix}/health",
                }
            )

    return app


app = create_app()
