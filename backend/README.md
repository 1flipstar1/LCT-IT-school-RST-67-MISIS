# Backend CRM «ИТ Школа Ростелекома»

FastAPI-сервис хранит всё состояние интерфейса как один JSON snapshot в SQLAlchemy. Это сохраняет текущую модель данных фронтенда и даёт серверную синхронизацию с optimistic locking по `revision`. По умолчанию используется SQLite; через `DATABASE_URL` подключается PostgreSQL.

## Быстрый запуск

Требуется Python 3.11+.

```powershell
cd backend
python -m venv .venv-local
.\.venv-local\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

После запуска:

- приложение: <http://localhost:8000/> (если собран `frontend/dist`);
- Swagger: <http://localhost:8000/docs>;
- health check: <http://localhost:8000/api/v1/health>;
- OpenAPI JSON: <http://localhost:8000/openapi.json>.

Если `frontend/dist` ещё нет, соберите его один раз:

```powershell
cd ..\frontend
npm ci
npm run build
cd ..\backend
```

FastAPI обнаруживает `frontend/dist` автоматически и раздаёт SPA и его assets с того же origin.

## Синхронизация состояния

Основной контракт:

```text
GET /api/v1/state
-> { "state": {...}, "revision": 1, "updatedAt": "..." }

PUT /api/v1/state
<- { "state": {...}, "expectedRevision": 1, "force": false }
-> { "state": {...}, "revision": 2, "updatedAt": "..." }
```

При устаревшей ревизии API отвечает `409`:

```json
{
  "error": {
    "code": "revision_conflict",
    "message": "Состояние уже было изменено другим клиентом.",
    "details": { "expectedRevision": 1, "currentRevision": 2 }
  }
}
```

`expectedRevision: null` выполняет безусловное обновление. `force: true` явно разрешает перезапись при известной устаревшей ревизии. `POST /api/v1/state/reset` восстанавливает `app/seed_state.json` и увеличивает ревизию. При первом старте эта же seed-копия записывается в БД.

Read-only façade для Swagger и интеграций:

- `GET /api/v1/catalogs`;
- `GET /api/v1/interactions` (доступны фильтры `managerId`, `universityId`, `directionId`, `productId`, `stageId`);
- `GET /api/v1/workflows`;
- `GET /api/v1/users`;
- `GET /api/v1/audit`;
- `GET /api/v1/integrations`;
- `GET /api/v1/reports`.

## Авторизация

В `development`, `demo` и `test` снимок можно прочитать до входа, чтобы локальный стенд сразу показывал форму авторизации. Любая запись, загрузка файла и ручная синхронизация требуют Bearer-токен. Демо-вход выдаёт JWT:

```http
POST /api/v1/auth/demo
Content-Type: application/json

{"role":"manager"}
```

Допустимые роли: `manager`, `lead`, `admin`. Ответ содержит `accessToken`, `tokenType`, `user`, `expiresIn`. Токен можно проверить через `GET /api/v1/auth/me` с заголовком `Authorization: Bearer ...`.

Frontend поддерживает Keycloak Authorization Code + PKCE без хранения client secret в браузере. Для сборки задайте `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`; в Docker Compose им соответствуют `KEYCLOAK_PUBLIC_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`. В Keycloak клиент должен быть public, Standard Flow — включён, а redirect URI — адрес приложения. Роли `KAM`, `MANAGER_LEAD`, `ADMIN` отображаются в `manager`, `lead`, `admin`.

В `APP_ENV=production` snapshot и façade всегда требуют Bearer-токен, а демо-вход по умолчанию отключён. Для Keycloak задайте как минимум `KEYCLOAK_ISSUER_URL`; при необходимости также `KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID` или явный `KEYCLOAK_JWKS_URL`. Роли `KAM`, `MANAGER_LEAD`, `ADMIN` автоматически отображаются в роли приложения.

Полный список переменных находится в [.env.example](.env.example). Для production обязательно замените `JWT_SECRET` и задайте точные `CORS_ORIGINS`.

## Файлы и интеграции

- `POST /api/v1/attachments` принимает `multipart/form-data`, проверяет расширение и лимит 25 МБ, сохраняет содержимое под непрозрачным именем; `GET /api/v1/attachments/{id}` скачивает файл с авторизацией.
- `POST /api/v1/integrations/{lms|site}/ingest` принимает согласованный JSON вручную или от шлюза.
- `POST /api/v1/integrations/{lms|site}/sync` забирает JSON с адресов `LMS_API_URL` / `WEBSITE_API_URL`. Поддерживается массив либо объект с массивом в `items`, `records` или `data`. Bearer-токены задаются отдельными переменными.
- Если адрес источника отсутствует и включён `INTEGRATION_DEMO_ENABLED`, эта же кнопка загружает одну помеченную тестовую запись из текущего каталога CRM. Повторная загрузка не создаёт дубль. `GET /api/v1/integrations/sources` сообщает интерфейсу режим каждого источника: `live`, `demo` или `unconfigured`. Настроенный реальный API всегда имеет приоритет над демо-режимом.
- `GET /api/v1/state/export` скачивает результирующий JSON.

Контракты заказчика для LMS и Laravel-сайта в исходном ТЗ не приложены, поэтому маппинг сохраняет исходный объект в `payload`, а известные поля (`title`, `id`/`externalId`) нормализует. После получения финального контракта этот адаптер расширяется в `app/services/integration.py`, не затрагивая UI.

## Keycloak

Готовый realm (роли, группы, клиенты, пользователи, политики безопасности) и запуск с Docker и без него — в [deploy/keycloak/README.md](deploy/keycloak/README.md).

## Импорт из Excel и CSV

Раздел «Импорт данных» (`#/import`, руководитель и администратор) загружает вузы, продукты, программы и данные договоров из XLSX или CSV. Браузер разбирает файл и строит план по тем же правилам, что показывает шаг «Проверка». Сервер отвечает за то, что должно быть надёжным: права, контроль ревизии, проверку итогового состояния, историю и откат.

- `POST /api/v1/imports` — применить проверенный план: `{fileName, attachmentId, expectedRevision, summary, options, stats, issues, changes: {universities|programs|products|interactions|events: [...]}}`. Изменения и запись в историю идут одной транзакцией; если данные изменились после проверки — `409 revision_conflict`. Исходный файл сохраняется как вложение (`POST /api/v1/attachments`).
- `GET /api/v1/imports` — история: кто, когда, что загрузил, можно ли отменить без потерь (`canRollback`).
- `GET /api/v1/imports/{id}` — импорт с замечаниями по строкам.
- `POST /api/v1/imports/{id}/rollback` — отменить импорт целиком. Если после него данные меняли — `409 import_changed_since`; `{"force": true}` откатывает всё равно.

Таблица `import_jobs` создаётся миграцией `20260926_01` (и автоматически при старте в режиме разработки).

## Помощник-агент

Помощник объясняет, как что-то сделать, или делает это сам: формирует и скачивает отчёты, ищет взаимодействия, показывает статистику, открывает разделы, переводит этапы и добавляет комментарии. Всё бесплатно: работает без платных API.

Как устроено:

- **Встроенный движок** (`frontend/src/features/assistant/engine/`) разбирает команды прямо в браузере, без ИИ и без сети: вузы, направления, продукты и ответственных по справочникам в любом падеже, периоды («за март», «с 01.03 по 15.05», «в прошлом квартале»), «кроме КФУ», «мои», «по ним». Вопросы «как…» закрывает встроенная справка и правила из `logic/Этапы.md`.
- **Локальная модель** (Ollama + Qwen3) получает только то, что движок не понял. Модель не видит записи вузов и ничего не выполняет: она отвечает текстом или выбирает одно действие (`tools`). Действие выполняет браузер, с правами текущего пользователя. Названия от модели принимаются, только если пользователь действительно их упомянул.
- Если модель недоступна, помощник продолжает работать на встроенном движке. Изменение данных по умолчанию выполняется только после подтверждения в карточке, и его можно отменить.

Установка модели на машине с FastAPI:

```bash
brew install ollama          # Windows: winget install Ollama.Ollama
ollama pull qwen3:4b-instruct
```

API:

- `POST /api/v1/assistant/chat`, Bearer-токен. Тело: `{"message":"Отчёт по КФУ за март в PDF","history":[],"page":"reports","mode":"agent","detail":"short"}`. Ответ: `{"type":"message","message":"…"}` или `{"type":"action","message":"","action":{"name":"create_report","arguments":{…}}}`. `mode: "guide"` отключает инструменты: модель только объясняет.
- `GET /api/v1/assistant/status` — включён ли помощник и загружена ли модель (зелёная точка в шапке чата).

Настройки: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `ASSISTANT_ENABLED`, `ASSISTANT_TIMEOUT_SECONDS`. По умолчанию используется `http://127.0.0.1:11434` и `qwen3:4b`; для локального стенда в `.env` задана `qwen3:4b-instruct`. Порт Ollama должен быть доступен только локально или из внутренней сети API.

## Telegram-бот

Бот пишет руководителю, когда менеджер его команды (а администратору — когда любой менеджер) переводит заявку на следующий этап, возвращает на доработку, пропускает необязательный этап или завершает взаимодействие. В сообщении — вуз, направление и продукт, откуда и куда перевели, кто изменил, комментарий и число файлов.

Подключение:

1. В Telegram откройте [@BotFather](https://t.me/BotFather), отправьте `/newbot`, задайте имя и адрес бота — BotFather пришлёт токен.
2. Укажите токен в `backend/.env.local` (файл не в git; в Docker — в `deploy/.env`) и перезапустите API:
   ```
   TELEGRAM_BOT_TOKEN=123456789:AA...
   # Необязательно: адрес CRM для кнопки «Открыть карточку» (не localhost — Telegram такие ссылки не принимает).
   PUBLIC_APP_URL=https://crm.example.ru
   ```
3. Руководитель или администратор входит в CRM → «Настройки профиля» → «Уведомления в Telegram» → «Подключить Telegram» → «Открыть Telegram» → «Старт». Страница сама отметит подключение. Проверка — кнопка «Отправить проверку».
4. Состояние бота и число подключённых руководителей видно на странице «Интеграции».

Как устроено (`app/services/telegram.py`):

- Входящие сообщения бот получает long polling'ом (`getUpdates`) без публичного webhook. В Docker этим занимается отдельный контейнер `telegram-bot`: обновления интерфейса не останавливают его, а процесс с зависшим poller перезапускается. API читает отметку последнего успешного обмена из `telegram_runtime`. При нескольких экземплярах вне Docker оставьте `TELEGRAM_POLLING_ENABLED=true` только в одном.
- Привязка — одноразовая ссылка `t.me/<бот>?start=<код>`, действует 15 минут. Chat ID хранится в карточке сотрудника в поле `telegram`: его пишет только сервер, в браузер он не уходит, а сохранение состояния клиентом не может его ни подменить, ни стереть.
- Уведомление уходит через `TELEGRAM_NOTIFY_DELAY_SECONDS` (15 с по умолчанию) после сохранения. Если за это время менеджер нажал «Отменить», событие пропадает из состояния и сообщение не отправляется. О собственных действиях руководителю не пишем.
- Получатели — руководитель ответственного менеджера (`leadId`, только его команда) и администраторы (все заявки). Менеджерам уведомления не нужны — они сами меняют этапы.
- Команды бота (меню и описание бот выставляет сам при запуске): `/start` — справка, `/status` — к какой учётной записи подключён чат, `/stop` — отключить уведомления.

API (Bearer-токен): `GET /api/v1/me/telegram` — состояние; `POST /api/v1/me/telegram/link` — ссылка для подключения; `POST /api/v1/me/telegram/test` — проверочное сообщение; `DELETE /api/v1/me/telegram` — отключить; `GET /api/v1/telegram/status` — сводка для руководителей и администраторов.

Если Telegram из сети сервера отвечает через раз, клиент повторяет подключение трижды; при постоянных сбоях задайте прокси `TELEGRAM_PROXY_URL` (`http://host:port` или `socks5://host:port`). Docker-развёртывание по умолчанию использует внутренний SOCKS шлюз `telegram-egress`; пакет `httpx[socks]` уже установлен.

Настройки: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_PROXY_URL`, `TELEGRAM_API_URL` (по умолчанию `https://api.telegram.org`), `TELEGRAM_POLLING_ENABLED`, `TELEGRAM_HEARTBEAT_PATH`, `TELEGRAM_NOTIFY_DELAY_SECONDS`, `TELEGRAM_TIMEOUT_SECONDS`, `PUBLIC_APP_URL`. Без токена бот выключен, CRM работает как обычно.

## PostgreSQL и Docker

Полный стенд (frontend build + API + PostgreSQL):

```powershell
cd backend
docker compose up --build
```

Приложение откроется на <http://localhost:8000>. Контейнер перед стартом выполняет `alembic upgrade head`.

Без Docker достаточно переопределить строку подключения:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/lct_db
```

## Тесты и seed

```powershell
cd backend
python -m pytest -q
```

Seed генерируется из канонических demo-данных frontend:

```powershell
node scripts/export_seed.mjs
```

После изменения frontend seed запустите эту команду и перезапустите API/вызовите `/api/v1/state/reset`.
