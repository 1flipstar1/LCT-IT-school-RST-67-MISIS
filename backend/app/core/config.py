"""Настройки приложения.

Любую настройку можно задать переменной окружения. Файл ``.env`` из репозитория — для
локального демо; контейнеры и production передают свои значения.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Настройки времени выполнения; значения по умолчанию безопасны для локальной разработки."""

    model_config = SettingsConfigDict(
        # .env.local (не в git) — для секретов конкретной машины, например токена Telegram-бота; перекрывает .env.
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ИТ Школа Ростелекома API"
    app_version: str = "1.0.0"
    app_env: Literal["development", "demo", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # SQLite не требует внешних сервисов. PostgreSQL включается строкой подключения,
    # например postgresql+psycopg://user:password@host:5432/database.
    database_url: str = "sqlite:///./lct_state.db"
    database_echo: bool = False
    # Пул соединений должен быть не меньше пула потоков FastAPI (40): иначе под нагрузкой запросы,
    # уже взявшие соединение, ждут поток, а потоки ждут соединение — сервер встаёт до тайм-аута.
    # 20 + 30 = 50 соединений; у PostgreSQL по умолчанию max_connections = 100 (остальное — бот и Keycloak).
    database_pool_size: int = 20
    database_max_overflow: int = 30

    cors_origins: str = (
        "http://localhost:3000,http://localhost:4173,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:4173,http://127.0.0.1:5173"
    )

    jwt_secret: str = "local-demo-secret-change-me-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "rtk-it-school-api"
    jwt_audience: str = "rtk-it-school-web"
    jwt_expires_seconds: int = 8 * 60 * 60
    demo_auth_enabled: bool | None = None

    # Если задано, токены этого realm Keycloak проверяются по его ключам (JWKS).
    # По умолчанию демо работает полностью локально.
    keycloak_issuer_url: str | None = None
    keycloak_jwks_url: str | None = None
    keycloak_audience: str | None = None
    keycloak_client_id: str | None = None
    # Служебный клиент для управления учётными записями из CRM (client credentials).
    # KEYCLOAK_ADMIN_URL — базовый адрес Keycloak для API, если он отличается от публичного (Docker).
    keycloak_admin_url: str | None = None
    keycloak_admin_client_id: str | None = None
    keycloak_admin_client_secret: str | None = None

    seed_state_path: Path = BACKEND_DIR / "app" / "seed_state.json"
    frontend_dist_path: Path = PROJECT_DIR / "frontend" / "dist"
    max_state_bytes: int = 20 * 1024 * 1024
    attachment_storage_path: Path = BACKEND_DIR / "data" / "attachments"
    max_attachment_bytes: int = 25 * 1024 * 1024

    # 152-ФЗ (ст. 19) и приказ ФСТЭК № 117: персональные данные хранятся зашифрованными (AES-256-GCM):
    # снимок данных CRM, история импортов, очередь Telegram и вложения. Формат: «id:ключ-base64url»
    # через запятую; первым ключом шифруются новые записи, остальные нужны, чтобы читать старые (ротация).
    # Без переменной ключ создаётся в data_encryption_key_path — только вне production.
    data_encryption_keys: str | None = None
    data_encryption_key_path: Path = BACKEND_DIR / "data" / "encryption.key"

    # Контракты внешних систем к заданию не приложены. Эти необязательные адреса позволяют
    # подключить оба источника без изменения кода. Пустое значение — «не настроено».
    lms_api_url: str | None = None
    lms_api_token: str | None = None
    website_api_url: str | None = None
    website_api_token: str | None = None
    integration_timeout_seconds: int = 20
    integration_demo_enabled: bool = False

    # Помощник обращается только к локальной модели: данные не уходят во внешние сервисы.
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:1.5b-instruct"
    assistant_enabled: bool = True
    assistant_timeout_seconds: int = 60
    assistant_context_tokens: int = 2048

    # Telegram-бот уведомляет руководителя, когда его менеджер переводит заявку на другой этап.
    # Токен выдаёт @BotFather; без него бот выключен, а CRM работает как обычно.
    telegram_bot_token: str | None = None
    telegram_api_url: str = "https://api.telegram.org"
    # Long polling не требует публичного адреса. В нескольких экземплярах API включайте его только в одном.
    telegram_polling_enabled: bool = True
    telegram_heartbeat_path: Path | None = None
    # Пауза перед отправкой: если менеджер нажмёт «Отменить», уведомление не уйдёт.
    telegram_notify_delay_seconds: float = 1.0
    telegram_outbox_enabled: bool = False
    telegram_timeout_seconds: int = 10
    # Прокси до api.telegram.org, если прямой доступ из сети сервера нестабилен: http://host:port или socks5://host:port.
    telegram_proxy_url: str | None = None
    # Адрес CRM для кнопки «Открыть карточку» в сообщении, например https://crm.example.ru.
    public_app_url: str | None = None

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Принимает и адреса хостингов вида ``postgres://``, и адреса в формате SQLAlchemy."""

        if isinstance(value, str) and value.startswith("postgres://"):
            return "postgresql+psycopg://" + value.removeprefix("postgres://")
        if isinstance(value, str) and value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @field_validator("api_v1_prefix")
    @classmethod
    def normalize_prefix(cls, value: str) -> str:
        value = "/" + value.strip("/")
        return value if value != "/" else "/api/v1"

    @field_validator(
        "keycloak_issuer_url",
        "keycloak_jwks_url",
        "keycloak_admin_url",
        "keycloak_admin_client_id",
        "keycloak_admin_client_secret",
        "lms_api_url",
        "lms_api_token",
        "website_api_url",
        "website_api_token",
        "telegram_bot_token",
        "telegram_proxy_url",
        "public_app_url",
        "data_encryption_keys",
        mode="before",
    )
    @classmethod
    def empty_url_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def effective_demo_auth_enabled(self) -> bool:
        if self.demo_auth_enabled is not None:
            return self.demo_auth_enabled
        return not self.is_production

    @property
    def anonymous_state_access(self) -> bool:
        """В демо снимок можно прочитать без входа; в production всегда нужен Bearer-токен."""

        return not self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        values = [origin.strip() for origin in self.cors_origins.split(",")]
        return [origin for origin in values if origin]

    @property
    def resolved_keycloak_jwks_url(self) -> str | None:
        if self.keycloak_jwks_url:
            return self.keycloak_jwks_url
        if self.keycloak_issuer_url:
            return f"{self.keycloak_issuer_url.rstrip('/')}/protocol/openid-connect/certs"
        return None

    @property
    def keycloak_realm(self) -> str | None:
        if not self.keycloak_issuer_url or "/realms/" not in self.keycloak_issuer_url:
            return None
        return self.keycloak_issuer_url.rstrip("/").split("/realms/", 1)[1]

    @property
    def keycloak_admin_base_url(self) -> str | None:
        if self.keycloak_admin_url:
            return self.keycloak_admin_url.rstrip("/")
        if not self.keycloak_issuer_url or "/realms/" not in self.keycloak_issuer_url:
            return None
        return self.keycloak_issuer_url.split("/realms/", 1)[0].rstrip("/")

    @property
    def keycloak_admin_configured(self) -> bool:
        return bool(self.keycloak_admin_base_url and self.keycloak_realm and self.keycloak_admin_client_id and self.keycloak_admin_client_secret)

    def integration_url(self, source_id: str) -> str | None:
        return {"lms": self.lms_api_url, "site": self.website_api_url}.get(source_id)

    def integration_token(self, source_id: str) -> str | None:
        return {"lms": self.lms_api_token, "site": self.website_api_token}.get(source_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Готовый экземпляр — для Alembic и модулей, которые загружаются один раз при старте.
settings = get_settings()
