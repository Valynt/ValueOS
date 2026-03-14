#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/require-env.sh"

MODE="${APP_ENV:-${1:-local}}"

frontend_env_file_for_mode() {
	local mode="${1:-local}"
	case "$mode" in
		local) echo "ops/env/.env.frontend.local" ;;
		cloud-dev) echo "ops/env/.env.frontend.cloud-dev" ;;
		test) echo "ops/env/.env.frontend.test" ;;
		prod) echo "ops/env/.env.frontend.prod" ;;
		*)
			echo "Unsupported APP_ENV '$mode'. Allowed: local, cloud-dev, test, prod" >&2
			return 1
			;;
	esac
}

load_frontend_env() {
	local mode="${1:-local}"
	local env_file_rel
	env_file_rel="$(frontend_env_file_for_mode "$mode")"
	local env_file="$PROJECT_ROOT/$env_file_rel"

	if [[ -f "$env_file" ]]; then
		# shellcheck disable=SC1090
		set -a; source "$env_file"; set +a
	else
		# Transitional fallback: allow existing canonical mode env files.
		load_mode_env "$mode"
	fi

	export APP_ENV="${APP_ENV:-$mode}"
	export NODE_ENV="${NODE_ENV:-$([[ "$mode" == "prod" ]] && echo production || ([[ "$mode" == "test" ]] && echo test || echo development))}"
}

load_frontend_env "$MODE"

if [[ -z "${SUPABASE_URL:-}" ]]; then
	echo "[env] Missing required variable: SUPABASE_URL" >&2
	echo "[env] Expected file: $(frontend_env_file_for_mode "$MODE")" >&2
	exit 1
fi

if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
	echo "[env] Missing required variable: SUPABASE_ANON_KEY" >&2
	echo "[env] Expected file: $(frontend_env_file_for_mode "$MODE")" >&2
	exit 1
fi

export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export BACKEND_PORT="${BACKEND_PORT:-8000}"
export BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT}}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT}}"
export API_BASE_URL="${API_BASE_URL:-${BACKEND_ORIGIN}}"

# Frontend must never receive service role credentials.
unset SUPABASE_SERVICE_ROLE_KEY || true
if [[ -n "${VITE_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
	echo "[env] Refusing to start frontend: VITE_SUPABASE_SERVICE_ROLE_KEY must not be set" >&2
	exit 1
fi

unset DATABASE_URL || true
unset PGHOST || true
unset PGPORT || true
unset PGDATABASE || true
unset PGUSER || true
unset PGPASSWORD || true

# Framework-specific mapping (single bridge layer)
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-$API_BASE_URL}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}"
