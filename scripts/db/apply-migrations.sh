#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/supabase/supabase/migrations}"

DRY_RUN=false
VERBOSE=false
FORCE=false

usage() {
  cat <<USAGE
Usage: $0 [--dry-run] [--verbose] [--force]

Applies top-level SQL migrations from infra/supabase/supabase/migrations in stable sorted order.

Environment:
  DATABASE_URL   Required PostgreSQL connection string.

Safety guard:
  For non-local hosts or DATABASE_URL containing sslmode=require, set:
  I_UNDERSTAND_THIS_MAY_TOUCH_PROD=1
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    --force|--extreme-force|--prompt-destructive) FORCE=true ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$VERBOSE" == "true" ]]; then
  set -x
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required." >&2
  exit 2
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 2
fi

url_without_scheme="${DATABASE_URL#*://}"
authority_and_path="${url_without_scheme##*@}"
host_port="${authority_and_path%%/*}"
database_with_params="${authority_and_path#*/}"
database_name="${database_with_params%%\?*}"
host_name="${host_port%%:*}"
params=""
if [[ "$DATABASE_URL" == *"?"* ]]; then
  params="${DATABASE_URL#*\?}"
fi

if [[ -z "$database_name" || "$database_name" == "$authority_and_path" ]]; then
  database_name="unknown"
fi
if [[ -z "$host_name" ]]; then
  host_name="unknown"
fi

is_local_host=false
case "$host_name" in
  localhost|127.0.0.1|0.0.0.0|::1|db|postgres|host.docker.internal)
    is_local_host=true
    ;;
esac

requires_ack=false
if [[ "$is_local_host" != "true" ]]; then
  requires_ack=true
fi
if [[ "$params" == *"sslmode=require"* ]]; then
  requires_ack=true
fi

if [[ "$requires_ack" == "true" && "${I_UNDERSTAND_THIS_MAY_TOUCH_PROD:-0}" != "1" ]]; then
  echo "ERROR: Refusing to run against non-local or ssl-required target without explicit acknowledgement." >&2
  echo "Set I_UNDERSTAND_THIS_MAY_TOUCH_PROD=1 to continue." >&2
  exit 4
fi

echo "Applying migrations to host=$host_name db=$database_name"

checksum_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    shasum -a 256 "$file" | awk '{print $1}'
  fi
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

psql_exec() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

declare -a migration_files=()
while IFS= read -r file; do
  migration_files+=("$file")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "ERROR: No migration files found in $MIGRATIONS_DIR" >&2
  exit 3
fi

if [[ "$DRY_RUN" != "true" ]]; then
  psql_exec -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), execution_time_ms int);"
  psql_exec -c "CREATE TABLE IF NOT EXISTS public.migration_history (id bigserial PRIMARY KEY, migration_name text NOT NULL, action text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error_message text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);"
fi

for file in "${migration_files[@]}"; do
  name="$(basename "$file")"
  checksum="$(checksum_file "$file")"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would apply: $name"
    continue
  fi

  escaped_name="$(sql_escape "$name")"
  existing_checksum="$(psql_exec -tAc "SELECT checksum FROM public.schema_migrations WHERE name = '$escaped_name'" | tr -d '[:space:]')"

  if [[ -n "$existing_checksum" ]]; then
    if [[ "$existing_checksum" == "$checksum" ]]; then
      echo "==> Skipping already-applied migration: $name"
      continue
    fi

    echo "ERROR: Checksum mismatch for already-applied migration $name" >&2
    if [[ "$FORCE" == "true" ]]; then
      echo "[FORCE] Continuing despite checksum mismatch for $name" >&2
      continue
    fi
    exit 5
  fi

  start_ms="$(date +%s%3N)"
  psql_exec -c "INSERT INTO public.migration_history (migration_name, action, status, started_at) VALUES ('$escaped_name', 'apply', 'pending', now());"

  echo "==> Applying: $name"
  if psql_exec -f "$file"; then
    end_ms="$(date +%s%3N)"
    elapsed_ms=$((end_ms - start_ms))
    psql_exec -c "INSERT INTO public.schema_migrations (name, checksum, applied_at, execution_time_ms) VALUES ('$escaped_name', '$checksum', now(), $elapsed_ms);"
    psql_exec -c "UPDATE public.migration_history SET status='success', completed_at=now(), metadata=jsonb_build_object('checksum', '$checksum', 'execution_time_ms', $elapsed_ms) WHERE migration_name='$escaped_name' AND action='apply' AND status='pending';"
    echo "==> Applied: $name (${elapsed_ms}ms)"
  else
    err="Migration failed: $name"
    psql_exec -c "UPDATE public.migration_history SET status='failure', completed_at=now(), error_message='$(sql_escape "$err")' WHERE migration_name='$escaped_name' AND action='apply' AND status='pending';" || true
    echo "ERROR: $err" >&2
    if [[ "$FORCE" == "true" ]]; then
      echo "[FORCE] Continuing after failure" >&2
      continue
    fi
    exit 6
  fi
done

echo "All migrations processed."
