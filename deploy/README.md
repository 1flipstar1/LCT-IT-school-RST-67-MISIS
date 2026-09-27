# Развёртывание на 158.160.222.79

`compose.yml` запускает Caddy, FastAPI с собранным React, PostgreSQL,
Keycloak и Ollama. Снаружи открыт только порт 80. Данные, вложения и модель
хранятся в постоянных Docker volumes.

Первый запуск от `admin67`:

```bash
cd ~/rtk-it-school
bash deploy/deploy.sh
```

Скрипт один раз создаёт `deploy/.env`, отдельный импорт realm с новыми
секретами и `deploy/generated/initial-credentials.json`. Эти файлы имеют
права `0600`, не попадают в Git и не заменяются при следующих обновлениях.
В файле credentials лежат временные пароли для начальных пользователей CRM
и пароль администратора Keycloak. После первого входа смените их.

Проверка:

```bash
curl -fsS http://127.0.0.1/api/v1/health
docker compose --env-file deploy/.env -f deploy/compose.yml ps
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T ollama ollama list
```

GitHub Actions проверяет фронтенд и backend, копирует файлы по отдельному
SSH-ключу и запускает тот же `deploy.sh` после push в `main`. Для него нужен
секрет репозитория `DEPLOY_SSH_KEY_V2` с приватной частью ключа, публичная часть
которого добавлена в `~admin67/.ssh/authorized_keys`. Ключ сервера закреплён
в `deploy/known_hosts`.

До появления домена сайт работает по HTTP. Логины и данные через HTTP
передаются без шифрования, поэтому для реальной работы с персональными
данными сначала нужен домен и HTTPS. При переезде следует сменить
`PUBLIC_URL`, включить HTTPS в Caddy и обновить hostname, redirect URI и
`sslRequired` в существующем realm Keycloak; повторный импорт realm не
меняет уже созданную базу.

Не запускайте `docker compose down -v`: это удалит базы, вложения и модель.
