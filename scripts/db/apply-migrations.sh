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

# For local mode only DATABASE_URL is required — Supabase cloud credentials are
# not needed to apply migrations via psql. Other modes retain full validation.
if [[ "$MODE" == "local" ]]; then
  if ! ensure_database_url; then
    print_missing_var_error "$MODE" DATABASE_URL
    echo "[env] You may alternatively set: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD" >&2
    exit 1
  fi
else
  validate_mode_env "$MODE"
fi

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

# Ensure the tracking table exists so migrations are idempotent across runs.
# Grants match infra/supabase/supabase/init-scripts/02-create-migrations-table.sh
# so the table is consistent whether created here or by the init script.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q -c "
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    TEXT
  );
  ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.schema_migrations TO anon, authenticated;
  GRANT ALL   ON public.schema_migrations TO service_role, supabase_admin;
" || { echo "[migrations] Failed to create schema_migrations tracking table" >&2; exit 1; }

# Collect files into a temp file to avoid subshell variable scoping issues with
# process substitution, and to keep the loop POSIX-compatible.
_tmplist="$(mktemp)"
trap 'rm -f "$_tmplist"' EXIT
find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort > "$_tmplist"
_migration_count="$(wc -l < "$_tmplist" | tr -d ' ')"

if [[ "$_migration_count" -eq 0 ]]; then
  echo "[migrations] No migrations found in $MIGRATIONS_DIR" >&2
  rm -f "$_tmplist"
  exit 5
fi

echo "[migrations] Checking $_migration_count migration files in $MIGRATIONS_DIR"

_applied=0
_skipped=0

while IFS= read -r file; do
  base="$(basename "$file")"

  _already="$(psql "$DATABASE_URL" -tAX --set=name="$base" -c \
    "SELECT 1 FROM public.schema_migrations WHERE name = :'name' LIMIT 1;" 2>/dev/null || true)"

  if [[ "$_already" == "1" ]]; then
    _skipped=$((_skipped + 1))
    continue
  fi

  echo "[migrations] -> $base"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$file"
  psql "$DATABASE_URL" -X -q --set=name="$base" -c \
    "INSERT INTO public.schema_migrations (name) VALUES (:'name') ON CONFLICT (name) DO NOTHING;" \
    || true
  _applied=$((_applied + 1))
done < "$_tmplist"

rm -f "$_tmplist"

echo "[migrations] Completed: $_applied applied, $_skipped already up-to-date."
