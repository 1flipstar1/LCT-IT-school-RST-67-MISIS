"""Application configuration.

All settings can be supplied through environment variables. A checked-in
``.env`` is used for the local demo, while containers and production should
inject their own values.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings with safe local-development defaults."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ИТ Школа Ростелекома API"
    app_version: str = "1.0.0"
    app_env: Literal["development", "demo", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # SQLite requires no external services. PostgreSQL is enabled by setting,
    # for example, postgresql+psycopg://user:password@host:5432/database.
    database_url: str = "sqlite:///./lct_state.db"
    database_echo: bool = False

    cors_origins: str = (
        "http://localhost:3000,http://localhost:4173,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:4173,http://127.0.0.1:5173"
    )
    allowed_hosts: str = "*"

    jwt_secret: str = "local-demo-secret-change-me-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "rtk-it-school-api"
    jwt_audience: str = "rtk-it-school-web"
    jwt_expires_seconds: int = 8 * 60 * 60
    demo_auth_enabled: bool | None = None

    # If configured, bearer tokens issued by this Keycloak realm are verified
    # against its JWKS endpoint. The demo remains fully local by default.
    keycloak_issuer_url: str | None = None
    keycloak_jwks_url: str | None = None
    keycloak_audience: str | None = None
    keycloak_client_id: str | None = None

    seed_state_path: Path = BACKEND_DIR / "app" / "seed_state.json"
    frontend_dist_path: Path = PROJECT_DIR / "frontend" / "dist"
    max_state_bytes: int = 20 * 1024 * 1024
    attachment_storage_path: Path = BACKEND_DIR / "data" / "attachments"
    max_attachment_bytes: int = 25 * 1024 * 1024

    # The external contracts were not supplied with the task. These optional
    # URLs let an installation connect the two agreed sources without changing
    # application code. Empty values intentionally mean "not configured".
    lms_api_url: str | None = None
    lms_api_token: str | None = None
    website_api_url: str | None = None
    website_api_token: str | None = None
    integration_timeout_seconds: int = Field(default=20, ge=1, le=120)
    # Missing upstream URLs use deterministic records in non-production modes.
    # Production always disables these built-in mocks.
    integration_mock_enabled: bool | None = None
    integration_scheduler_enabled: bool = False
    lms_sync_interval_seconds: int = Field(default=4 * 60 * 60, ge=60)
    website_sync_interval_seconds: int = Field(default=15 * 60, ge=60)
    integration_system_user_id: str = "usr-8"

    # Binary artifacts never live in the database. Local backends make a fresh
    # checkout testable without infrastructure; Compose switches both values.
    job_storage_backend: Literal["local", "s3"] = "local"
    job_queue_backend: Literal["inline", "rabbitmq"] = "inline"
    local_storage_path: Path = BACKEND_DIR / ".data" / "objects"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "lct-artifacts"
    s3_region: str = "us-east-1"
    s3_secure: bool = False
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/%2F"
    rabbitmq_import_queue: str = "lct.imports"
    rabbitmq_report_queue: str = "lct.reports"
    worker_queues: str = ""
    max_upload_bytes: int = 25 * 1024 * 1024
    max_import_rows: int = 20_000
    max_import_columns: int = 200

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Accept hosting-provider ``postgres://`` URLs as well as SQLAlchemy URLs."""

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
        "lms_api_url",
        "lms_api_token",
        "website_api_url",
        "website_api_token",
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
        """The demo is frictionless; production always requires a bearer token."""

        return not self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        values = [origin.strip() for origin in self.cors_origins.split(",")]
        return [origin for origin in values if origin]

    @property
    def allowed_host_list(self) -> list[str]:
        values = [host.strip() for host in self.allowed_hosts.split(",")]
        return [host for host in values if host] or ["*"]

    @property
    def effective_integration_mock_enabled(self) -> bool:
        if self.is_production:
            return False
        if self.integration_mock_enabled is not None:
            return self.integration_mock_enabled
        return True

    @property
    def resolved_keycloak_jwks_url(self) -> str | None:
        if self.keycloak_jwks_url:
            return self.keycloak_jwks_url
        if self.keycloak_issuer_url:
            return f"{self.keycloak_issuer_url.rstrip('/')}/protocol/openid-connect/certs"
        return None

    def integration_url(self, source_id: str) -> str | None:
        return {"lms": self.lms_api_url, "site": self.website_api_url}.get(source_id)

    def integration_token(self, source_id: str) -> str | None:
        return {"lms": self.lms_api_token, "site": self.website_api_token}.get(source_id)

    def integration_mode(self, source_id: str) -> Literal["remote", "mock", "unconfigured"]:
        if self.integration_url(source_id):
            return "remote"
        if self.effective_integration_mock_enabled:
            return "mock"
        return "unconfigured"

    def integration_interval_seconds(self, source_id: str) -> int:
        return {
            "lms": self.lms_sync_interval_seconds,
            "site": self.website_sync_interval_seconds,
        }[source_id]

    def production_validation_errors(self) -> list[str]:
        """Return actionable configuration errors for a production process."""

        if not self.is_production:
            return []

        errors: list[str] = []
        insecure_secrets = {
            "local-demo-secret-change-me-at-least-32-bytes",
            "local-compose-secret-change-me-at-least-32-bytes",
            "replace-with-a-long-random-secret",
            "change-me",
        }
        secret_lower = self.jwt_secret.casefold()
        has_placeholder = any(
            marker in secret_lower
            for marker in ("change-me", "change_me", "replace", "local-demo", "local-compose")
        )
        if len(self.jwt_secret) < 32 or self.jwt_secret in insecure_secrets or has_placeholder:
            errors.append("JWT_SECRET must be a unique secret of at least 32 characters")
        if self.jwt_algorithm not in {"HS256", "HS384", "HS512"}:
            errors.append("JWT_ALGORITHM must be HS256, HS384 or HS512")
        if self.effective_demo_auth_enabled:
            errors.append("DEMO_AUTH_ENABLED must be false")
        if self.database_url.startswith("sqlite"):
            errors.append("DATABASE_URL must use PostgreSQL in production")
        if not self.keycloak_issuer_url:
            errors.append("KEYCLOAK_ISSUER_URL is required")
        else:
            issuer = urlparse(self.keycloak_issuer_url)
            if issuer.scheme != "https" or not issuer.netloc:
                errors.append("KEYCLOAK_ISSUER_URL must be an absolute HTTPS URL")
        if "*" in self.cors_origin_list:
            errors.append("CORS_ORIGINS must not contain '*' in production")
        insecure_origins = [
            origin
            for origin in self.cors_origin_list
            if urlparse(origin).scheme != "https"
        ]
        if insecure_origins:
            errors.append("CORS_ORIGINS must contain only HTTPS origins in production")
        if "*" in self.allowed_host_list:
            errors.append("ALLOWED_HOSTS must list the public application host")
        if self.job_queue_backend == "rabbitmq" and self.job_storage_backend != "s3":
            errors.append("JOB_STORAGE_BACKEND must be 's3' when RabbitMQ workers are enabled")
        if self.job_storage_backend == "s3" and (
            not self.s3_access_key
            or not self.s3_secret_key
            or (self.s3_access_key == "minioadmin" and self.s3_secret_key == "minioadmin")
        ):
            errors.append("S3 credentials must be configured and must not use MinIO defaults")
        if self.integration_scheduler_enabled:
            missing_sources = [
                source_id
                for source_id in ("lms", "site")
                if self.integration_url(source_id) is None
            ]
            if missing_sources:
                errors.append(
                    "Integration scheduler requires external URLs for: "
                    + ", ".join(missing_sources)
                )
            insecure_sources = [
                source_id
                for source_id in ("lms", "site")
                if self.integration_url(source_id)
                and urlparse(str(self.integration_url(source_id))).scheme != "https"
            ]
            if insecure_sources:
                errors.append(
                    "Integration URLs must use HTTPS for: "
                    + ", ".join(insecure_sources)
                )
        return errors

    def validate_runtime(self) -> None:
        errors = self.production_validation_errors()
        if errors:
            raise RuntimeError("Invalid production configuration: " + "; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Kept as a convenience for Alembic and modules that are loaded once at startup.
settings = get_settings()
