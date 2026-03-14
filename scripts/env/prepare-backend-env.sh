#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/require-env.sh"

MODE="${APP_ENV:-${1:-local}}"
load_mode_env "$MODE"

backend_env_file_for_mode() {
	local mode="${1:-local}"
	case "$mode" in
		local) echo "ops/env/.env.backend.local" ;;
		cloud-dev) echo "ops/env/.env.backend.cloud-dev" ;;
		test) echo "ops/env/.env.backend.test" ;;
		prod) echo "ops/env/.env.backend.prod" ;;
		*)
			echo "Unsupported APP_ENV '$mode'. Allowed: local, cloud-dev, test, prod" >&2
			return 1
			;;
	esac
}

backend_env_file_rel="$(backend_env_file_for_mode "$MODE")"
backend_env_file="$SCRIPT_DIR/../../$backend_env_file_rel"
if [[ -f "$backend_env_file" ]]; then
	# shellcheck disable=SC1090
	set -a; source "$backend_env_file"; set +a
fi

validate_mode_env "$MODE"

export BACKEND_PORT="${BACKEND_PORT:-8000}"
export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT}}"
export BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT}}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-$FRONTEND_ORIGIN}"
export PORT="${PORT:-$BACKEND_PORT}"
