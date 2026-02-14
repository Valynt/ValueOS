#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mode_to_env_file() {
  local mode="${1:-local}"
  case "$mode" in
    local) echo "ops/env/.env.local" ;;
    cloud-dev) echo "ops/env/.env.cloud-dev" ;;
    test) echo "ops/env/.env.test" ;;
    prod) echo "ops/env/.env.prod" ;;
    *)
      echo "Unsupported APP_ENV '$mode'. Allowed: local, cloud-dev, test, prod" >&2
      return 1
      ;;
  esac
}

load_mode_env() {
  local mode="${1:-local}"
  local env_file_rel
  env_file_rel="$(mode_to_env_file "$mode")"
  local env_file="$PROJECT_ROOT/$env_file_rel"

  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$env_file"; set +a
  fi

  local fallback="$PROJECT_ROOT/ops/env/.env.local"
  if [[ "$mode" != "local" && -f "$fallback" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$fallback"; set +a
  fi

  export APP_ENV="${APP_ENV:-$mode}"
  export NODE_ENV="${NODE_ENV:-$([[ "$mode" == "prod" ]] && echo production || ([[ "$mode" == "test" ]] && echo test || echo development))}"
}

is_missing() {
  local var_name="$1"
  [[ -z "${!var_name:-}" ]]
}

print_missing_var_error() {
  local mode="$1"
  local var_name="$2"
  local env_file_rel
  env_file_rel="$(mode_to_env_file "$mode")"

  cat >&2 <<ERR
[env] Missing required variable: $var_name
[env] Mode: $mode
[env] Expected file: $env_file_rel (shell vars override file values)
[env] Fix: cp ops/env/.env.local.example $env_file_rel && set $var_name
ERR
}

require_vars() {
  local mode="$1"
  shift
  local missing=0
  for var_name in "$@"; do
    if is_missing "$var_name"; then
      print_missing_var_error "$mode" "$var_name"
      missing=1
    fi
  done
  if [[ "$missing" -eq 1 ]]; then
    exit 1
  fi
}

ensure_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return 0
  fi

  local atomics=(PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD)
  local missing=0
  for key in "${atomics[@]}"; do
    if [[ -z "${!key:-}" ]]; then
      missing=1
    fi
  done

  if [[ "$missing" -eq 1 ]]; then
    return 1
  fi

  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
}

validate_mode_env() {
  local mode="${1:-local}"

  case "$mode" in
    local)
      require_vars "$mode" SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
      ;;
    cloud-dev)
      require_vars "$mode" SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_PROJECT_REF
      ;;
    test)
      require_vars "$mode" DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
      ;;
    prod)
      require_vars "$mode" DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
      ;;
  esac

  if ! ensure_database_url; then
    print_missing_var_error "$mode" DATABASE_URL
    echo "[env] You may alternatively set: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD" >&2
    exit 1
  fi
}
