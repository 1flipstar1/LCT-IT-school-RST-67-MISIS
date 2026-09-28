"""HTTP-заголовки защиты (приказ ФСТЭК № 117, меры защиты веб-интерфейса; OWASP Secure Headers).

* CSP разрешает только свои скрипты и запросы к своему API и к Keycloak — внедрённый скрипт не сможет
  ни загрузиться с чужого адреса, ни отправить персональные данные наружу.
* Страницы CRM нельзя встроить в чужой сайт (clickjacking), ответы API с ПДн не кэшируются.
* HSTS — браузер ходит только по HTTPS, если запрос пришёл через HTTPS-прокси.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.config import settings


# Swagger UI и ReDoc FastAPI грузят скрипты с CDN — строгая политика их бы сломала.
DOCS_PATHS = ("/docs", "/redoc")


def _origin(url: str | None) -> str | None:
    if not url:
        return None
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None


def content_security_policy() -> str:
    # Keycloak на своём адресе (локальный стенд: localhost:8080): браузер меняет у него код на токен.
    keycloak = " ".join(origin for origin in {_origin(settings.keycloak_issuer_url)} if origin)
    return "; ".join([
        "default-src 'self'",
        "script-src 'self'",
        # styled-components и анимации пишут стили в атрибуты и <style>.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        f"connect-src 'self' {keycloak}".rstrip(),
        f"form-action 'self' {keycloak}".rstrip(),
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
    ])


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.csp = content_security_policy()

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "same-origin")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # Микрофон — для голосового ввода в ИИ-помощнике; остальное не нужно.
        headers.setdefault("Permissions-Policy", "microphone=(self), camera=(), geolocation=(), payment=(), usb=()")
        path = request.url.path
        if not path.startswith(DOCS_PATHS):
            headers.setdefault("Content-Security-Policy", self.csp)
        if path.startswith(settings.api_v1_prefix):
            headers.setdefault("Cache-Control", "no-store")
        if request.headers.get("x-forwarded-proto", request.url.scheme) == "https":
            headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
