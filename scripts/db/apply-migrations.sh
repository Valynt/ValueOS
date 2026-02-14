#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/supabase/supabase/migrations}"

DRY_RUN=false
VERBOSE=false
FORCE=false

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
DB_NAME="${DB_NAME:-valueos_dev}"
DATABASE_URL="${DATABASE_URL:-}"

UNDERSTAND_RISK="${I_UNDERSTAND_THIS_MAY_TOUCH_PROD:-0}"

log() { echo "$*"; }
warn() { echo "⚠️  $*" >&2; }
err() { echo "❌ $*" >&2; }

usage() {
  cat <<USAGE
Usage: scripts/db/apply-migrations.sh [--dry-run] [--verbose] [--force]

Deterministically apply SQL migrations from:
  $MIGRATIONS_DIR

Flags:
  --dry-run   Print what would be applied without mutating DB
  --verbose   Enable shell trace output
  --force     Continue applying remaining migrations after a failure
  -h, --help  Show this message

Safety gate:
  If DATABASE_URL points to a non-local host OR sslmode=require,
  you must set I_UNDERSTAND_THIS_MAY_TOUCH_PROD=1.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --force) FORCE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ "$VERBOSE" == "true" ]]; then
  set -x
fi

if [[ -n "$DATABASE_URL" ]]; then
  DB_URL="$DATABASE_URL"
else
  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

host_from_url() {
  local url="$1"
  echo "$url" | sed -E 's#^[a-zA-Z0-9+.-]+://([^/@]+@)?([^:/?]+).*$#\2#'
}

is_local_host() {
  local h="${1,,}"
  [[ "$h" == "localhost" || "$h" == "127.0.0.1" || "$h" == "::1" || "$h" == "postgres" || "$h" == "db" ]]
}

enforce_safety_gate() {
  local h sslmode
  h="$(host_from_url "$DB_URL")"
  sslmode="$(echo "$DB_URL" | sed -nE 's#.*[?&]sslmode=([^&]+).*#\1#p' | head -n1)"

  if ! is_local_host "$h" || [[ "$sslmode" == "require" ]]; then
    if [[ "$UNDERSTAND_RISK" != "1" ]]; then
      err "Refusing to run migrations against potentially hosted DB."
      err "Resolved host: ${h:-unknown}; sslmode: ${sslmode:-unset}."
      err "If you intend this, rerun with: I_UNDERSTAND_THIS_MAY_TOUCH_PROD=1"
      err "Recommended hosted path: supabase link --project-ref <ref> && supabase db push"
      exit 1
    fi
    warn "Risk acknowledgement set; proceeding against host '$h'."
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 1; }
}

run_psql() {
  local sql="$1"
  PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "$sql"
}

ensure_tracking_tables() {
  run_psql "CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), execution_time_ms integer);"
  run_psql "CREATE TABLE IF NOT EXISTS public.migration_history (migration_name text NOT NULL, action text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error_message text, metadata jsonb DEFAULT '{}'::jsonb);"
}

list_migrations() {
  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print | sort
}

checksum_file() {
  sha256sum "$1" | awk '{print $1}'
}

already_applied_checksum() {
  local name="$1"
  PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -At -c "SELECT checksum FROM public.schema_migrations WHERE name='${name//\'/\'\'}' LIMIT 1;"
}

apply_one() {
  local file="$1"
  local name checksum started_ms ended_ms duration_ms
  name="$(basename "$file")"
  checksum="$(checksum_file "$file")"

  local existing
  existing="$(already_applied_checksum "$name")"
  if [[ -n "$existing" ]]; then
    if [[ "$existing" != "$checksum" ]]; then
      err "Checksum mismatch for already applied migration: $name"
      err "Applied checksum: $existing"
      err "Current checksum: $checksum"
      return 1
    fi
    log "↷ Skipping already applied migration: $name"
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] would apply $name"
    return 0
  fi

  log "→ Applying $name"
  run_psql "INSERT INTO public.migration_history (migration_name, action, status, started_at) VALUES ('${name//\'/\'\'}', 'apply', 'pending', now());"

  started_ms="$(date +%s%3N)"
  if PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"; then
    ended_ms="$(date +%s%3N)"
    duration_ms=$((ended_ms - started_ms))
    run_psql "INSERT INTO public.schema_migrations (name, checksum, applied_at, execution_time_ms) VALUES ('${name//\'/\'\'}', '$checksum', now(), $duration_ms);"
    run_psql "UPDATE public.migration_history SET status='success', completed_at=now(), metadata=jsonb_build_object('checksum','$checksum','execution_time_ms',$duration_ms) WHERE migration_name='${name//\'/\'\'}' AND status='pending';"
    log "✓ Applied $name (${duration_ms}ms)"
    return 0
  fi

  run_psql "UPDATE public.migration_history SET status='failure', completed_at=now(), error_message='psql failed while applying migration' WHERE migration_name='${name//\'/\'\'}' AND status='pending';" || true
  err "Failed migration: $name"
  return 1
}

main() {
  [[ -d "$MIGRATIONS_DIR" ]] || { err "Migrations dir not found: $MIGRATIONS_DIR"; exit 1; }

  enforce_safety_gate

  require_cmd psql
  require_cmd sha256sum

  log "Using DB URL host: $(host_from_url "$DB_URL")"
  log "Migrations dir: $MIGRATIONS_DIR"

  PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "SELECT 1" >/dev/null

  ensure_tracking_tables

  local failures=0 total=0
  while IFS= read -r migration; do
    [[ -n "$migration" ]] || continue
    total=$((total + 1))
    if ! apply_one "$migration"; then
      failures=$((failures + 1))
      if [[ "$FORCE" != "true" ]]; then
        err "Stopping on first failure (use --force to continue)."
        break
      fi
    fi
  done < <(list_migrations)

  log "Processed migrations: $total"
  if [[ $failures -gt 0 ]]; then
    err "Migration run completed with $failures failure(s)."
    exit 1
  fi

  log "✅ Migration run completed successfully."
}

main "$@"
