#!/bin/sh
# Локальный стенд одной командой: собирает фронтенд и запускает API на http://localhost:8000.
# API отдаёт и саму CRM (frontend/dist), и Telegram-бота (токен — в backend/.env.local).
set -e
cd "$(dirname "$0")"
(cd ../frontend && npm run build)
# Дошифровать данные, записанные до включения шифрования ПДн (идемпотентно).
.venv-local/bin/python -m app.services.encryption
exec .venv-local/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
