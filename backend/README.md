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
- readiness (процесс + БД): <http://localhost:8000/api/v1/health>;
- liveness (только HTTP-процесс): <http://localhost:8000/api/v1/health/live>;
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

Полный список переменных находится в [.env.example](.env.example). В production
приложение запускается по fail-closed принципу: оно откажется стартовать с
демо-секретом, включённым демо-входом, wildcard в `CORS_ORIGINS` / `ALLOWED_HOSTS`
или без HTTPS issuer Keycloak.
Для внутреннего Docker healthcheck оставьте `localhost` в `ALLOWED_HOSTS` рядом
с публичным доменом.

## Файлы и интеграции

- `POST /api/v1/attachments` принимает `multipart/form-data`, проверяет расширение и лимит 25 МБ, сохраняет содержимое под непрозрачным именем; `GET /api/v1/attachments/{id}` скачивает файл с авторизацией.
- `POST /api/v1/integrations/{lms|site}/ingest` принимает согласованный JSON вручную или от шлюза.
- `POST /api/v1/integrations/{lms|site}/sync` забирает JSON с адресов `LMS_API_URL` / `WEBSITE_API_URL`. Поддерживается массив либо объект с массивом в `items`, `records` или `data`. Bearer-токены задаются отдельными переменными.
- `GET /api/v1/integrations/status` показывает безопасный runtime-статус коннекторов (`remote`, `mock`, `unconfigured`) без выдачи URL и токенов.
- `GET /api/v1/state/export` скачивает результирующий JSON.

Контракты заказчика для LMS и Laravel-сайта в исходном ТЗ не приложены, поэтому маппинг сохраняет исходный объект в `payload`, а известные поля (`title`, `id`/`externalId`) нормализует. После получения финального контракта этот адаптер расширяется в `app/services/integration.py`, не затрагивая UI.

Пока внешние URL не настроены, в `development`, `demo` и `test` используются
детерминированные заглушки из `app/services/integration_mock.py`. Они проходят
через тот же ingestion, журнал, аудит и защиту от дублей, что и реальные ответы.
`INTEGRATION_MOCK_ENABLED=false` отключает их; в production они отключены всегда.
Контейнер `integration-worker` синхронизирует сайт каждые 15 минут и LMS каждые
4 часа. Интервалы задаются через `WEBSITE_SYNC_INTERVAL_SECONDS` и
`LMS_SYNC_INTERVAL_SECONDS`. Запуск одного проверочного цикла:

```powershell
python -m app.integration_worker --once
```

## Импорт, объектное хранилище и фоновые задачи

Импорт `.xls`/`.xlsx` и генерация отчётов выполняются вне HTTP-процесса:

```text
API → MinIO/S3 (файл) → RabbitMQ (только jobId) → worker → PostgreSQL + MinIO/S3
```

- `POST /api/v1/imports` принимает файл и ставит разбор в очередь;
- `GET /api/v1/imports/{id}` возвращает `queued / processing / ready / completed / failed`;
- `POST /api/v1/imports/{id}/preview` проверяет сопоставление без записи;
- `POST /api/v1/imports/{id}/apply` применяет импорт через worker;
- `POST /api/v1/report-jobs` создаёт отчёт;
- `GET /api/v1/report-jobs/{id}/download` отдаёт готовый артефакт.

В обычном локальном запуске используются файловое хранилище `backend/.data/objects`
и синхронный inline-обработчик, поэтому дополнительные сервисы не нужны. В Compose
автоматически включаются MinIO и RabbitMQ, а обработка разделена между контейнерами
`import-worker` и `report-worker`; их можно масштабировать независимо. Плановая
синхронизация вынесена в единственный `integration-worker`.

## PostgreSQL и Docker

Полный demo-стенд (frontend build + API + три worker-процесса + PostgreSQL + MinIO + RabbitMQ):

```powershell
cd backend
docker compose up --build
```

Приложение откроется на <http://localhost:8000>. MinIO Console доступна на
<http://localhost:9001>, RabbitMQ Management — на <http://localhost:15672>.
Контейнер API перед стартом выполняет `alembic upgrade head`.

Для production скопируйте [.env.production.example](.env.production.example) во
внешний файл, замените все `CHANGE_ME`, затем запустите:

```powershell
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Перед публикацией поставьте перед API TLS reverse proxy / ingress, настройте
резервное копирование PostgreSQL и MinIO, не публикуйте management-порты наружу
и сохраните production env в менеджере секретов. По умолчанию консоли RabbitMQ
и MinIO привязаны только к `127.0.0.1`. Контейнер приложения работает от
непривилегированного пользователя `app`.

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
