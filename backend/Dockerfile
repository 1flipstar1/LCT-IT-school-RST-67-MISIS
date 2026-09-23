# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS frontend-build
ARG VITE_KEYCLOAK_URL=""
ARG VITE_KEYCLOAK_REALM=""
ARG VITE_KEYCLOAK_CLIENT_ID=""
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
WORKDIR /source/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST_PATH=/frontend/dist \
    ATTACHMENT_STORAGE_PATH=/app/data/attachments

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 10001 app && \
    useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app && \
    mkdir -p /app/data/attachments /app/.data/objects /app/app/assets /frontend && \
    chown -R app:app /app /frontend

COPY --chown=app:app backend/ ./
COPY --chown=app:app frontend/design/font/RostelecomBasis-Regular.otf /app/app/assets/RostelecomBasis-Regular.otf
COPY --chown=app:app frontend/design/font/RostelecomBasis-Bold.otf /app/app/assets/RostelecomBasis-Bold.otf
COPY --chown=app:app --from=frontend-build /source/frontend/dist /frontend/dist

EXPOSE 8000
STOPSIGNAL SIGTERM
USER app
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-1} --proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS:-127.0.0.1}"]
