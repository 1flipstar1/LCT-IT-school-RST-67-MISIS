#!/usr/bin/env bash
# Демо-вход из README (testuser / ItSchool-2026!) на уже работающем Keycloak.
# Realm из репозитория импортируется только в пустую базу, поэтому на сервере учётка
# администратора осталась i.smirnova со случайным паролем из deploy/init.py. Скрипт один раз
# переименовывает её и задаёт пароль; дальше ничего не трогает (иначе мешала бы passwordHistory).
# KCADM — команда kcadm.sh с уже заданными --server/--user/--password (для проверки вне Docker);
# по умолчанию kcadm запускается в контейнере keycloak с паролем администратора из его окружения.
set -euo pipefail

cd "$(dirname "$0")/.."
REALM=it-school
DEMO_USERNAME=testuser
DEMO_PASSWORD='ItSchool-2026!'
LEGACY_USERNAME=i.smirnova

if [[ -n "${KCADM:-}" ]]; then
  kc() { $KCADM "$@"; }
else
  kc() {
    docker compose --env-file deploy/.env -f deploy/compose.yml exec -T keycloak bash -c \
      '/opt/keycloak/bin/kcadm.sh "$@" --no-config --server http://localhost:8080/auth --realm master --user admin --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"' \
      kcadm "$@"
  }
fi
user_id() { kc get users -r "$REALM" -q username="$1" -q exact=true --fields id --format csv --noquotes; }

for attempt in $(seq 1 40); do
  if kc get "realms/$REALM" --fields realm >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 40 ]]; then
    echo "Keycloak admin API is unavailable; demo user not ensured" >&2
    exit 1
  fi
  sleep 3
done

if [[ -n "$(user_id "$DEMO_USERNAME")" ]]; then
  echo "Demo user $DEMO_USERNAME already exists"
  exit 0
fi

legacy_id="$(user_id "$LEGACY_USERNAME")"
if [[ -z "$legacy_id" ]]; then
  echo "Neither $DEMO_USERNAME nor $LEGACY_USERNAME found in realm $REALM" >&2
  exit 1
fi

# Realm запрещает менять логин (editUsernameAllowed=false) — разрешаем только на время переименования.
kc update "realms/$REALM" -s editUsernameAllowed=true
trap 'kc update "realms/$REALM" -s editUsernameAllowed=false' EXIT
kc update "users/$legacy_id" -r "$REALM" -s username="$DEMO_USERNAME" -s 'requiredActions=[]' -s enabled=true
kc set-password -r "$REALM" --userid "$legacy_id" --new-password "$DEMO_PASSWORD"
echo "Demo user $DEMO_USERNAME is ready"
