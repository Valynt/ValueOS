#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [local|docker]

Modes:
  local   Vite runs on your laptop; backend + caddy run via Docker
  docker  Everything (backend, frontend, caddy) runs in Docker

This script validates env, runs migrations, starts required services, and
for local mode launches the Vite dev server.
EOF
  exit 1
}

MODE="${1:-local}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure env files exist
if [ ! -f "$ROOT/.env" ]; then
  echo "ERROR: missing $ROOT/.env" >&2
  exit 2
fi
if [ ! -f "$ROOT/.env.ports" ]; then
  echo "ERROR: missing $ROOT/.env.ports" >&2
  exit 2
fi

# Staleness warning: if config/ports.json is newer than .env.ports, warn
if [ -f "$ROOT/config/ports.json" ] && [ "$ROOT/config/ports.json" -nt "$ROOT/.env.ports" ]; then
  echo "WARNING: $ROOT/config/ports.json is newer than $ROOT/.env.ports — consider regenerating .env.ports with 'pnpm run dx:env'"
fi

# Load envs
set -a; source "$ROOT/.env"; source "$ROOT/.env.ports"; set +a

echo "Mode: $MODE"

echo "1) Running migrations"
"$ROOT/scripts/migrate.sh"

COMPOSE_FILE="$ROOT/infra/docker/docker-compose.dev.yml"

case "$MODE" in
  local)
    echo "2) Starting backend, worker and edge proxy in Docker (detached)"
    docker compose -f "$COMPOSE_FILE" up -d backend worker caddy

    echo "3) Starting Vite locally for ValyntApp"
    # Ensure API proxy target points to local backend
    export VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET:-http://127.0.0.1:${API_PORT:-8000}}
    pushd "$ROOT/apps/ValyntApp" >/dev/null
    pnpm --filter ValyntApp dev
    popd >/dev/null
    ;;

  docker)
    echo "2) Starting backend, worker, frontend and edge proxy in Docker (detached)"
    docker compose -f "$COMPOSE_FILE" up -d --build backend worker frontend caddy
    echo "All containers started."
    ;;

  *)
    usage
    ;;
esac

# Basic health checks (best-effort)
echo "Running health checks..."
set +e
API_URL="${API_UPSTREAM:-http://backend:${API_PORT:-8000}}"
echo "Pinging API at $API_URL"
curl -fsS --max-time 5 "$API_URL/health" || curl -fsS --max-time 5 "$API_URL/api/health/ready" || echo "API health check failed or returned non-2xx"

CADDY_URL="http://${DEV_DOMAIN:-localhost}:${FRONTEND_CADDY_PORT:-3001}"
echo "Pinging edge proxy at $CADDY_URL"
curl -fsS --max-time 5 "$CADDY_URL/health" || echo "Edge proxy health check failed or returned non-2xx"
set -e

echo "dx completed."
