#!/bin/bash
set -euo pipefail

# Deterministic migration runner for the initial-release baseline.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1090
  set -a; source "$PROJECT_ROOT/.env"; set +a
fi

DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-infra/supabase/supabase/migrations}"

if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "ERROR: DIRECT_DATABASE_URL is not set. Set it in .env or environment." >&2
  exit 2
fi

MIGRATION_ROOT="$PROJECT_ROOT/$MIGRATIONS_DIR"
if [ ! -d "$MIGRATION_ROOT" ]; then
  echo "ERROR: Migrations directory not found: $MIGRATION_ROOT" >&2
  exit 2
fi

MIGRATION_FILES=(
  "00000000000000_initial_release_baseline.sql"
  "00000000000001_initial_seed_minimal.sql"
)

echo "Applying deterministic migration plan in $MIGRATION_ROOT"

for migration in "${MIGRATION_FILES[@]}"; do
  file="$MIGRATION_ROOT/$migration"
  if [ ! -f "$file" ]; then
    echo "ERROR: Expected migration file missing: $file" >&2
    exit 3
  fi

  echo "==> Applying: $migration"
  psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$file"
  echo "==> Applied: $migration"
done

echo "All migrations applied successfully."
