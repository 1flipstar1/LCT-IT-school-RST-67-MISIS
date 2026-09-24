# Один сервер в Yandex Cloud

Эта конфигурация запускает на одной GPU-виртуальной машине четыре внутренних
сервиса: FastAPI с собранным frontend, PostgreSQL, Ollama и Qwen3. Наружу
выведены только порты `80` и `443` Caddy. Порты PostgreSQL (`5432`), API
(`8000`) и Ollama (`11434`) не публикуются.

## ВМ

Для первой версии используйте `standard-v3-t4`: 1 × T4, 4 vCPU, 16 ГБ RAM,
80 ГБ SSD. Модель `qwen3:8b` занимает около 5.2 ГБ и оставляет достаточно
видеопамяти 16-гигабайтной T4 для диалога. Выберите GPU-образ Yandex Cloud,
в котором уже есть Docker и NVIDIA-драйвер. В security group разрешите входящий TCP `80` и `443` всем,
а TCP `22` — только IP-адресам команды. Не открывайте `5432`, `8000` или
`11434`.

Для нормального HTTPS создайте DNS-запись `A` выбранного домена на публичный
IP ВМ до запуска. Если домена пока нет, временно задайте
`SITE_ADDRESS=http://<PUBLIC_IP>` — сайт будет доступен по HTTP, без
доверенного сертификата.

## Запуск

На ВМ склонируйте репозиторий, затем:

```bash
cd backend/deploy
cp .env.example .env
nano .env
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml logs -f ollama-init
```

Первое скачивание `qwen3:14b` занимает несколько минут. После строки об
успешной загрузке проверьте контейнеры и сайт:

```bash
docker compose --env-file .env -f compose.yml ps
curl -fsS http://127.0.0.1/api/v1/health
```

Откройте `https://<ваш-домен>` в браузере. В demo-режиме вход через роли
предназначен только для показа. Перед загрузкой реальных данных необходимо
перевести приложение на `APP_ENV=production` и подключить Keycloak либо иной
поставщик идентификации.

## Обновление и резервное копирование

```bash
git pull
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > lct-backup.sql
```

`postgres_data`, `attachment_data` и `ollama_data` — постоянные Docker volumes.
Не запускайте `docker compose down -v`, иначе удалятся данные и модель.
