#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/postgres/migrations}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

die() {
  echo -e "${RED}$*${NC}" >&2
  exit 1
}

note() { echo -e "${YELLOW}$*${NC}"; }
ok() { echo -e "${GREEN}$*${NC}"; }

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

is_resolvable_host() {
  local host="$1"
  [[ -z "$host" ]] && return 1
  [[ "$host" == "localhost" ]] && return 0
  [[ "$host" == "127.0.0.1" ]] && return 0
  getent hosts "$host" >/dev/null 2>&1
}

describe_target() {
  if [[ -z "${PGHOST:-${POSTGRES_HOST:-}}" && -n "${DATABASE_URL:-}" ]]; then
    # Best-effort: redact password if present.
    local redacted="$DATABASE_URL"
    redacted="$(echo "$redacted" | sed -E 's#(postgres(ql)?://[^:/@]+):[^@]+@#\\1:*****@#')"
    echo "$redacted"
    return
  fi

  local host="${PGHOST:-${POSTGRES_HOST:-localhost}}"
  local port="${PGPORT:-${POSTGRES_PORT:-5432}}"
  local db="${PGDATABASE:-${POSTGRES_DB:-postgres}}"

  if ! is_resolvable_host "$host"; then
    if [[ -n "${POSTGRES_HOST_PORT:-}" ]]; then
      host="localhost"
      port="$POSTGRES_HOST_PORT"
    elif [[ -n "${SUPABASE_DB_PORT:-}" ]]; then
      host="localhost"
      port="$SUPABASE_DB_PORT"
    fi
  fi

  echo "${host}:${port}/${db}"
}

psql_base_args() {
  echo "-X -v ON_ERROR_STOP=1"
}

psql_exec() {
  local host="${PGHOST:-${POSTGRES_HOST:-localhost}}"
  local port="${PGPORT:-${POSTGRES_PORT:-5432}}"
  local user="${PGUSER:-${POSTGRES_USER:-postgres}}"
  local db="${PGDATABASE:-${POSTGRES_DB:-postgres}}"

  # Prefer explicit PG/POSTGRES vars (more portable across host vs container).
  if [[ -z "${PGHOST:-${POSTGRES_HOST:-}}" && -n "${DATABASE_URL:-}" ]]; then
    # shellcheck disable=SC2086
    psql $(psql_base_args) "$DATABASE_URL" "$@"
    return
  fi

  if ! is_resolvable_host "$host"; then
    # Common case: scripts run on host but .env uses Docker DNS "db".
    if [[ -n "${POSTGRES_HOST_PORT:-}" ]]; then
      host="localhost"
      port="$POSTGRES_HOST_PORT"
    elif [[ -n "${SUPABASE_DB_PORT:-}" ]]; then
      host="localhost"
      port="$SUPABASE_DB_PORT"
    fi
  fi

  export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"
  export PGSSLMODE="${PGSSLMODE:-disable}"

  # shellcheck disable=SC2086
  psql $(psql_base_args) -h "$host" -p "$port" -U "$user" -d "$db" "$@"
}

ensure_schema_migrations() {
  # Ensure table exists with the expected columns. We intentionally keep this
  # idempotent and non-destructive.
  psql_exec -qAt -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL;" | grep -qx "t" || {
    psql_exec -q -c "
      CREATE TABLE public.schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        checksum TEXT NOT NULL
      );
    " >/dev/null
    return 0
  }

  local cols
  cols="$(psql_exec -qAt -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='schema_migrations' ORDER BY ordinal_position;")"

  if printf '%s\n' "$cols" | grep -qx "version"; then
    note "INFO: Detected legacy Supabase schema_migrations (version only). Converting to ValueOS format..."
    psql_exec -q -c "ALTER TABLE public.schema_migrations RENAME TO schema_migrations_legacy_supabase;" >/dev/null
    psql_exec -q -c "
      CREATE TABLE public.schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        checksum TEXT NOT NULL
      );
    " >/dev/null

    # Best-effort backfill: map legacy versions to filenames in MIGRATIONS_DIR.
    local version
    while IFS= read -r version; do
      [[ -z "$version" ]] && continue
      local match
      match=$(ls -1 "$MIGRATIONS_DIR"/${version}_*.sql 2>/dev/null | head -n 1 || true)
      if [[ -z "$match" ]]; then
        die "ALARM: Legacy migration version '$version' has no matching file in $MIGRATIONS_DIR. Restore the file or reset the DB."
      fi
      local filename checksum
      filename=$(basename "$match")
      checksum=$(sha256sum "$match" | awk '{print $1}')
      psql_exec -q -c "INSERT INTO public.schema_migrations (name, checksum) VALUES ('${filename}', '${checksum}') ON CONFLICT (name) DO NOTHING;" >/dev/null
    done < <(psql_exec -qAt -c "SELECT version FROM public.schema_migrations_legacy_supabase ORDER BY version;")

    return 0
  fi

  if printf '%s\n' "$cols" | grep -qx "filename"; then
    note "INFO: Detected legacy schema_migrations (filename). Upgrading to ValueOS format..."
    psql_exec -q -c "ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS name TEXT;" >/dev/null
    psql_exec -q -c "UPDATE public.schema_migrations SET name = filename WHERE name IS NULL;" >/dev/null
    psql_exec -q -c "ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;" >/dev/null
    if printf '%s\n' "$cols" | grep -qx "executed_at"; then
      psql_exec -q -c "UPDATE public.schema_migrations SET applied_at = COALESCE(executed_at, now()) WHERE applied_at IS NULL;" >/dev/null
    else
      psql_exec -q -c "UPDATE public.schema_migrations SET applied_at = now() WHERE applied_at IS NULL;" >/dev/null
    fi
    psql_exec -q -c "ALTER TABLE public.schema_migrations ALTER COLUMN applied_at SET DEFAULT now();" >/dev/null
    psql_exec -q -c "ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;" >/dev/null

    # Backfill missing checksums from the current migration files to establish a baseline.
    local missing_name
    while IFS= read -r missing_name; do
      [[ -z "$missing_name" ]] && continue
      if [[ ! -f "$MIGRATIONS_DIR/$missing_name" ]]; then
        die "ALARM: schema_migrations references '$missing_name' but no such file exists in $MIGRATIONS_DIR."
      fi
      local computed
      computed="$(sha256sum "$MIGRATIONS_DIR/$missing_name" | awk '{print $1}')"
      psql_exec -q -c "UPDATE public.schema_migrations SET checksum = '${computed}' WHERE name = '${missing_name}' AND (checksum IS NULL OR checksum = '');" >/dev/null
    done < <(psql_exec -qAt -c "SELECT name FROM public.schema_migrations WHERE checksum IS NULL OR checksum = '' ORDER BY name;")

    return 0
  fi

  if ! printf '%s\n' "$cols" | grep -qx "name"; then
    die "ALARM: public.schema_migrations exists but is not compatible (missing column 'name')."
  fi
}

list_migration_files() {
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    die "CRITICAL: Golden copy migrations directory missing: $MIGRATIONS_DIR"
  fi

  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort
}

main() {
  load_env

  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    die "CRITICAL: Golden copy migrations directory missing: $MIGRATIONS_DIR"
  fi

  # Verify DB connectivity up front.
  if ! psql_exec -qAt -c "SELECT 1;" >/dev/null 2>&1; then
    die "ERROR: Cannot reach Postgres at $(describe_target). Is Docker running?"
  fi

  ensure_schema_migrations

  mapfile -t files < <(list_migration_files)
  if [[ ${#files[@]} -eq 0 ]]; then
    note "WARN: No migration files found in $MIGRATIONS_DIR"
  fi

  declare -A fs_checksum=()
  for f in "${files[@]}"; do
    fs_checksum["$f"]="$(sha256sum "$MIGRATIONS_DIR/$f" | awk '{print $1}')"
  done

  declare -A db_checksum=()
  while IFS='|' read -r name checksum; do
    [[ -z "$name" ]] && continue
    db_checksum["$name"]="$checksum"
  done < <(psql_exec -qAt -F '|' -c "SELECT name, checksum FROM public.schema_migrations ORDER BY name;")

  pending=()
  for f in "${files[@]}"; do
    if [[ -z "${db_checksum[$f]+x}" ]]; then
      pending+=("$f")
    fi
  done

  extra=()
  for name in "${!db_checksum[@]}"; do
    if [[ -z "${fs_checksum[$name]+x}" ]]; then
      extra+=("$name")
    fi
  done

  mismatches=()
  for f in "${files[@]}"; do
    if [[ -n "${db_checksum[$f]+x}" ]]; then
      if [[ "${db_checksum[$f]}" != "${fs_checksum[$f]}" ]]; then
        mismatches+=("$f")
      fi
    fi
  done

  if [[ ${#mismatches[@]} -gt 0 ]]; then
    for f in $(printf '%s\n' "${mismatches[@]}" | sort); do
      echo -e "${RED}ALARM: Migration '$f' has been modified after application.${NC}"
    done
    echo "Action required: revert file changes or manually resolve the hash collision."
    exit 1
  fi

  if [[ ${#pending[@]} -gt 0 || ${#extra[@]} -gt 0 ]]; then
    if [[ ${#pending[@]} -gt 0 ]]; then
      echo -e "${RED}CRITICAL: Database schema drift detected. [${#pending[@]}] migrations pending.${NC}"
      printf '%s\n' "${pending[@]}" | sort | sed 's/^/  - /'
    fi
    if [[ ${#extra[@]} -gt 0 ]]; then
      echo -e "${RED}CRITICAL: Database has applied migrations missing from repo. [${#extra[@]}] unexpected entries.${NC}"
      printf '%s\n' "${extra[@]}" | sort | sed 's/^/  - /'
    fi
    echo "Action required: run 'pnpm db:sync' (or reset your local DB if history is corrupted)."
    exit 1
  fi

  ok "OK: Database schema is aligned ($((${#files[@]})) migrations)."
}

main "$@"
