#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-docker}"

cleanup() {
  "${ROOT_DIR}/dev" down >/dev/null 2>&1 || true
}

trap cleanup EXIT

"${ROOT_DIR}/dev" up --mode "${MODE}" --ci

set -a
if [[ -f "${ROOT_DIR}/.env.ports" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env.ports"
fi
set +a

wait_for() {
  local name="$1"
  local url="$2"
  local retries=30
  local delay=2

  echo "🔎 Waiting for ${name} (${url})..."
  for _ in $(seq 1 "${retries}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "✅ ${name} is healthy"
      return 0
    fi
    sleep "${delay}"
  done

  echo "❌ ${name} failed health check: ${url}"
  return 1
}

wait_for "Backend" "http://localhost:${API_PORT:-3001}/health/ready"
wait_for "Frontend" "http://localhost:${VITE_PORT:-5173}/"
wait_for "Caddy" "http://localhost:${CADDY_HTTP_PORT:-8080}/healthz"

echo "🏗️  Building frontend (valynt-app)..."
pnpm --filter valynt-app build
