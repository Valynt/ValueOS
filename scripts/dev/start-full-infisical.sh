#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cleanup() {
  trap - INT TERM EXIT
  kill 0 >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

cd "$PROJECT_ROOT"

APP_ENV="${APP_ENV:-local}" pnpm run dev:backend:infisical &
APP_ENV="${APP_ENV:-local}" pnpm run dev:frontend &

wait
