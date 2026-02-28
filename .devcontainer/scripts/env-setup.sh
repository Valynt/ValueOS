#!/usr/bin/env bash
set -euo pipefail

# Shared environment setup for devcontainer scripts
# Intended to be sourced:  source ".devcontainer/scripts/env-setup.sh"

log() { printf '[env-setup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }
die() { printf '[env-setup][ERROR] %s\n' "$(date '+%Y-%m-%d %H:%M:%S') $*" >&2; exit 1; }

# If you want strict "must be sourced" behavior:
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  die "This file must be sourced, not executed. Use: source .devcontainer/scripts/env-setup.sh"
fi

# Safer env loader for simple KEY=VALUE files (no shell code)
# - ignores comments/blank lines
# - supports quoted values
# - preserves spaces
load_kv_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  log "Loading env from $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    # trim leading "export " if present
    line="${line#export }"

    # only accept KEY=VALUE
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      local key="${line%%=*}"
      local val="${line#*=}"

      # strip surrounding quotes if present
      if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:-1}"; fi
      if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:-1}"; fi

      export "$key=$val"
    else
      log "Skipping non KEY=VALUE line in $file"
    fi
  done < "$file"
}

load_environment() {
  # Ports first
  if [[ -f .env.ports ]]; then
    load_kv_file ".env.ports"
  elif [[ -f .env.ports.example ]]; then
    load_kv_file ".env.ports.example"
  fi

  # Secrets/locals next
  [[ -f .env.local ]] && load_kv_file ".env.local"

  # Devcontainer overrides last
validate_env
  [[ -f .devcontainer/.env ]] && load_kv_file ".devcontainer/.env"
}

verify_pnpm() {
  local pnpm_version="9.15.0"
  local detected=""

  if [[ -x .devcontainer/scripts/read-version.sh ]]; then
    detected="$(.devcontainer/scripts/read-version.sh pnpm 2>/dev/null || true)"
  elif [[ -f .devcontainer/versions.json ]] && command -v python3 >/dev/null 2>&1; then
    detected="$(python3 - <<'PY'
import json
from pathlib import Path
p = Path('.devcontainer/versions.json')
if p.exists():
  try:
    data = json.loads(p.read_text())
    print(data.get('pnpm',''))
  except json.JSONDecodeError:
    print('')
  except Exception:
    print('')
PY
)"
  fi

  [[ -n "$detected" ]] && pnpm_version="$detected"

  command -v corepack >/dev/null 2>&1 || die "corepack not found (Node install is missing corepack)"
  corepack enable >/dev/null 2>&1 || die "corepack enable failed"
  corepack prepare "pnpm@${pnpm_version}" --activate >/dev/null 2>&1 || die "corepack prepare pnpm@${pnpm_version} failed"

  command -v pnpm >/dev/null 2>&1 || die "pnpm not available after corepack activation"
  log "pnpm ready: $(pnpm --version)"
}

# Robust DB URL parsing using python (handles ?params, encoding, etc.)
database_health_check() {
  local max_attempts=30
  local attempt=0

  log "Waiting for database to be ready..."

  local host port user pass dbname
  if [[ -n "${DATABASE_URL:-}" ]]; then
    command -v python3 >/dev/null 2>&1 || die "python3 required to parse DATABASE_URL safely"
    read -r host port user pass dbname < <(python3 - <<'PY'
import os
from urllib.parse import urlparse, unquote
u = urlparse(os.environ["DATABASE_URL"])
host = u.hostname or "localhost"
port = u.port or 5432
user = unquote(u.username or "postgres")
pw   = unquote(u.password or "")
db   = (u.path or "").lstrip("/") or "postgres"
print(host, port, user, pw, db)
PY
)
  else
    host="${POSTGRES_HOST:-localhost}"
    port="${POSTGRES_PORT:-5432}"
    user="${POSTGRES_USER:-valueos}"
    pass="${POSTGRES_PASSWORD:-valueos_dev}"
    dbname="${POSTGRES_DB:-valueos_dev}"
  fi

  # If password is empty (common with some setups), avoid exporting a literal blank incorrectly
  until PGPASSWORD="${pass:-}" psql -h "$host" -p "$port" -U "$user" -d "$dbname" -c "SELECT 1" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
      die "Database not ready after $max_attempts attempts (host=$host port=$port db=$dbname user=$user)"
    fi
    log "Waiting for database... ($attempt/$max_attempts)"
    sleep 2
  done

  log "Database is ready"
}

# Prefer passing a function name instead of eval
service_health_check() {
  local service_name="$1"
  local check_fn="$2"
  local max_attempts="${3:-10}"
  local delay="${4:-3}"

  log "Checking $service_name..."

  local attempt=0
  until "$check_fn" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
      log "$service_name is not responding after $max_attempts attempts"
      return 1
    fi
    log "Waiting for $service_name... ($attempt/$max_attempts)"
    sleep "$delay"
  done

  [[ $attempt -gt 0 ]] && log "$service_name is ready"
  return 0
}

# Validate critical environment variables
validate_env() {
  local required_vars=("POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_USER" "POSTGRES_DB")
  local missing_vars=()

  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      missing_vars+=("$var")
    fi
  done

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    die "Missing required environment variables: ${missing_vars[*]}"
  fi
}

# Enhanced error logging with context
log_error() {
  local message="$1"
  local context="${2:-}"
  if [[ -n "$context" ]]; then
    die "${message} (context: $context)"
  else
    die "$message"
  fi
}
