#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/require-env.sh"

MODE="${APP_ENV:-${1:-local}}"
load_mode_env "$MODE"
# Note: validate_mode_env requires backend secrets, skip for frontend
# validate_mode_env "$MODE"

export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export BACKEND_PORT="${BACKEND_PORT:-8000}"
export BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT}}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT}}"
export API_BASE_URL="${API_BASE_URL:-${BACKEND_ORIGIN}}"

# Framework-specific mapping (single bridge layer)
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-$API_BASE_URL}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}"
