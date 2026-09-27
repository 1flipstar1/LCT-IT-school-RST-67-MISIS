#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ ! -f deploy/.env ]]; then
  python3 deploy/init.py "http://158.160.222.79"
fi
python3 deploy/render_caddy.py

docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --remove-orphans

ollama_model="$(sed -n 's/^OLLAMA_MODEL=//p' deploy/.env | head -n 1)"
if [[ -z "$ollama_model" ]]; then
  echo "OLLAMA_MODEL is missing from deploy/.env" >&2
  exit 1
fi
if ! docker compose --env-file deploy/.env -f deploy/compose.yml exec -T ollama ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "$ollama_model"; then
  docker compose --env-file deploy/.env -f deploy/compose.yml run --rm --no-deps \
    -e OLLAMA_HOST=http://ollama:11434 ollama pull "$ollama_model"
fi

for attempt in $(seq 1 40); do
  if grep -qx 'PUBLIC_URL=https://rtk-itschool.ru' deploy/.env; then
    health_url=https://rtk-itschool.ru/api/v1/health
    health_resolve=(--resolve rtk-itschool.ru:443:127.0.0.1)
  else
    health_url=http://127.0.0.1/api/v1/health
    health_resolve=(-H 'Host: 158.160.222.79')
  fi
  if curl --fail --silent --show-error --max-time 5 "${health_resolve[@]}" "$health_url" >/dev/null 2>&1; then
    echo "Deployment healthy"
    exit 0
  fi
  sleep 3
done
docker compose --env-file deploy/.env -f deploy/compose.yml ps
echo "Deployment health check failed" >&2
exit 1
