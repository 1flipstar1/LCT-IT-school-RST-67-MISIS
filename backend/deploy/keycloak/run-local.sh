#!/usr/bin/env bash
# Локальный Keycloak без Docker: скачивает дистрибутив, импортирует realm «it-school» и запускает на :8080.
# Нужна Java 21 (macOS: brew install openjdk@21). Данные dev-режима лежат в .local/keycloak-*/data.
set -euo pipefail

KC_VERSION="${KC_VERSION:-26.7.4}"
DIR="$(cd "$(dirname "$0")" && pwd)"
KC_HOME="$DIR/.local/keycloak-$KC_VERSION"
ARCHIVE="$DIR/.local/keycloak-$KC_VERSION.tar.gz"

if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 /usr/lib/jvm/java-21-openjdk*; do
    if [ -x "$candidate/bin/java" ]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
if [ -n "${JAVA_HOME:-}" ]; then export PATH="$JAVA_HOME/bin:$PATH"; fi

if [ ! -x "$KC_HOME/bin/kc.sh" ]; then
  mkdir -p "$DIR/.local"
  if [ ! -f "$ARCHIVE" ]; then
    echo "Скачиваем Keycloak $KC_VERSION…"
    curl -fL -o "$ARCHIVE" "https://github.com/keycloak/keycloak/releases/download/$KC_VERSION/keycloak-$KC_VERSION.tar.gz"
  fi
  tar -xzf "$ARCHIVE" -C "$DIR/.local"
fi

# Realm импортируется при первом старте; повторный запуск его не перезаписывает.
mkdir -p "$KC_HOME/data/import"
cp "$DIR/realm-it-school.json" "$KC_HOME/data/import/realm-it-school.json"

export KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
export KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"

exec "$KC_HOME/bin/kc.sh" start-dev --http-port "${KC_HTTP_PORT:-8080}" --import-realm --hostname "${KC_HOSTNAME:-http://localhost:8080}"
