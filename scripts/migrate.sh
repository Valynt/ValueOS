#!/bin/bash
set -euo pipefail

# Migrate script: applies SQL files from MIGRATIONS_DIR to DIRECT_DATABASE_URL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1090
  set -a; source "$PROJECT_ROOT/.env"; set +a
fi

MIGRATIONS_DIR="${MIGRATIONS_DIR:-}"
DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-}"

if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "ERROR: DIRECT_DATABASE_URL is not set. Set it in .env or environment." >&2
  exit 2
fi

if [ -z "$MIGRATIONS_DIR" ]; then
  echo "ERROR: MIGRATIONS_DIR is not set. Set it in .env or environment." >&2
  exit 2
fi

if [ ! -d "$PROJECT_ROOT/$MIGRATIONS_DIR" ]; then
  echo "ERROR: Migrations directory not found: $PROJECT_ROOT/$MIGRATIONS_DIR" >&2
  exit 2
fi

echo "Applying migrations from $PROJECT_ROOT/$MIGRATIONS_DIR to $DIRECT_DATABASE_URL"

shopt -s nullglob
files=("$PROJECT_ROOT/$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migration files found in $PROJECT_ROOT/$MIGRATIONS_DIR"
  exit 0
fi

for f in $(ls -1 "$PROJECT_ROOT/$MIGRATIONS_DIR"/*.sql | sort); do
  # Skip rollback files
  case "$f" in
    *.rollback.sql) echo "Skipping rollback file $f"; continue ;;
  esac

  echo "==> Applying: $(basename "$f")"
  psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  echo "==> Applied: $(basename "$f")"
done

echo "All migrations applied successfully."
