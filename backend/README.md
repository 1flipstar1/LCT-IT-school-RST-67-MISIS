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
- `GET /api/v1/state/export` скачивает результирующий JSON.

Контракты заказчика для LMS и Laravel-сайта в исходном ТЗ не приложены, поэтому маппинг сохраняет исходный объект в `payload`, а известные поля (`title`, `id`/`externalId`) нормализует. После получения финального контракта этот адаптер расширяется в `app/services/integration.py`, не затрагивая UI.

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
