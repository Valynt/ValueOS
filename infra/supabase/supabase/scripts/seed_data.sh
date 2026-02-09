#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
SEEDS_DIR="${SEEDS_DIR:-$PROJECT_ROOT/infra/postgres/seeds}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: bash infra/scripts/seed_data.sh [--dry-run]

Runs all SQL seed files in infra/postgres/seeds in strict lexicographical order.
Seeds must be idempotent (INSERT ... ON CONFLICT DO NOTHING / UPSERT).
EOF
}

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

  if [[ -z "${PGHOST:-${POSTGRES_HOST:-}}" && -n "${DATABASE_URL:-}" ]]; then
    # shellcheck disable=SC2086
    psql $(psql_base_args) "$DATABASE_URL" "$@"
    return
  fi

  if ! is_resolvable_host "$host"; then
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

list_seed_files() {
  if [[ ! -d "$SEEDS_DIR" ]]; then
    note "INFO: Seeds directory not found: $SEEDS_DIR (skipping)"
    return 0
  fi
  find "$SEEDS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  load_env

  if ! psql_exec -qAt -c "SELECT 1;" >/dev/null 2>&1; then
    die "ERROR: Cannot reach Postgres at $(describe_target). Is Docker running?"
  fi

  mapfile -t seeds < <(list_seed_files)
  if [[ ${#seeds[@]} -eq 0 ]]; then
    ok "OK: No seed files found."
    exit 0
  fi

  local applied=0
  for f in "${seeds[@]}"; do
    local path="$SEEDS_DIR/$f"
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "Would apply seed: $f"
      continue
    fi

    note "Seeding: $f"
    if ! psql_exec -f "$path"; then
      die "FAILURE: Seed '$f' failed."
    fi
    applied=$((applied + 1))
  done

  ok "OK: Applied $applied seed file(s)."
}

main "$@"

