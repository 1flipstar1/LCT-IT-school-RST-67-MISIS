#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ ! -f deploy/.env ]]; then
  python3 deploy/init.py "http://158.160.222.79"
fi

docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --remove-orphans

if ! docker compose --env-file deploy/.env -f deploy/compose.yml exec -T ollama ollama list | grep -q '^qwen3:4b-instruct'; then
  docker compose --env-file deploy/.env -f deploy/compose.yml run --rm --no-deps \
    -e OLLAMA_HOST=http://ollama:11434 ollama pull qwen3:4b-instruct
fi

for attempt in $(seq 1 40); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1/api/v1/health >/dev/null 2>&1; then
    echo "Deployment healthy"
    exit 0
  fi
  sleep 3
done
docker compose --env-file deploy/.env -f deploy/compose.yml ps
echo "Deployment health check failed" >&2
exit 1
