#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/require-env.sh"

MODE="${APP_ENV:-${1:-local}}"
load_mode_env "$MODE"
validate_mode_env "$MODE"

export BACKEND_PORT="${BACKEND_PORT:-8000}"
export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT}}"
export BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT}}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-$FRONTEND_ORIGIN}"
export PORT="${PORT:-$BACKEND_PORT}"
