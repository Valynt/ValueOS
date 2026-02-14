#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MODE="${APP_ENV:-${1:-local}}"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env/prepare-backend-env.sh" "$MODE"

cd "$PROJECT_ROOT"
exec pnpm --filter @valueos/backend dev
