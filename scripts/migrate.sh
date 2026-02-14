#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$PROJECT_ROOT/.env"; set +a
fi

if [[ -n "${DIRECT_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$DIRECT_DATABASE_URL"
fi

echo "[DEPRECATED] scripts/migrate.sh delegates to scripts/db/apply-migrations.sh" >&2
exec bash "$PROJECT_ROOT/scripts/db/apply-migrations.sh" "$@"
