#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/lib/require-env.sh"

MODE="${APP_ENV:-${1:-local}}"
if [[ "$#" -gt 0 && "$1" =~ ^(local|cloud-dev|test|prod)$ ]]; then
  shift
fi

load_mode_env "$MODE"
validate_mode_env "$MODE"

MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/supabase/supabase/migrations}"
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[migrations] Missing migrations directory: $MIGRATIONS_DIR" >&2
  exit 2
fi

if [[ "$DATABASE_URL" =~ (localhost|127\.0\.0\.1|@postgres:|@db:) ]]; then
  :
else
  if [[ "${ALLOW_REMOTE_DB_MIGRATIONS:-}" != "true" ]]; then
    cat >&2 <<ERR
[migrations] Refusing to run against non-local DATABASE_URL in mode '$MODE'.
[migrations] DATABASE_URL=$DATABASE_URL
[migrations] Set ALLOW_REMOTE_DB_MIGRATIONS=true to acknowledge remote target.
ERR
    exit 3
  fi
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[migrations] psql is required but not installed." >&2
  exit 4
fi

mapfile -t migration_files < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ "${#migration_files[@]}" -eq 0 ]]; then
  echo "[migrations] No migrations found in $MIGRATIONS_DIR" >&2
  exit 5
fi

echo "[migrations] Applying ${#migration_files[@]} SQL migrations from $MIGRATIONS_DIR"

for file in "${migration_files[@]}"; do
  base="$(basename "$file")"
  echo "[migrations] -> $base"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$file"
done

echo "[migrations] Completed successfully."
