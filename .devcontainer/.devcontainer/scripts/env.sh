#!/usr/bin/env bash
set -euo pipefail

# Shared environment setup for devcontainer scripts
# This script should be sourced by other scripts

log()  { printf '[env-setup] %s\n' "$*" >&2; }
die()  { printf '[env-setup][ERROR] %s\n' "$*" >&2; exit 1; }

# Load canonical port/env inputs
load_environment() {
    if [ -f .env.ports ]; then
        log "Loading port configuration from .env.ports..."
        # shellcheck disable=SC2046
        export $(grep -v '^#' .env.ports | xargs)
    elif [ -f .env.ports.example ]; then
        log "Loading fallback port configuration from .env.ports.example..."
        # shellcheck disable=SC2046
        export $(grep -v '^#' .env.ports.example | xargs)
    fi

    if [ -f .env.local ]; then
        log "Loading local secrets from .env.local..."
        # shellcheck disable=SC2046
        export $(grep -v '^#' .env.local | xargs)
    fi

    if [ -f .devcontainer/.env ]; then
        log "Loading devcontainer overrides from .devcontainer/.env..."
        # shellcheck disable=SC2046
        export $(grep -v '^#' .devcontainer/.env | xargs)
    fi
}

# Verify Corepack pnpm setup
verify_pnpm() {
    local pnpm_version="9.15.0"

    if [ -f .devcontainer/versions.json ]; then
        detected_pnpm_version=$(python3 - <<'PY'
import json
from pathlib import Path
versions = Path('.devcontainer/versions.json')
if versions.exists():
    data = json.loads(versions.read_text())
    print(data.get('pnpm', ''))
PY
)
        if [ -n "${detected_pnpm_version}" ]; then
            pnpm_version="${detected_pnpm_version}"
        fi
    fi

    if [ -x .devcontainer/scripts/read-version.sh ]; then
        pnpm_version="$(.devcontainer/scripts/read-version.sh pnpm)"
    fi

    corepack enable
    corepack prepare "pnpm@${pnpm_version}" --activate

    if command -v pnpm > /dev/null 2>&1; then
        log "pnpm is available: $(pnpm --version)"
    else
        die "pnpm is not available after setup"
    fi
}

# Database health check
database_health_check() {
    local max_attempts=30
    local attempt=0

    log "Waiting for database to be ready..."

    # Parse DATABASE_URL to get connection details
    parse_database_url() {
        local url="$1"
        # Remove postgresql://
        local without_proto="${url#postgresql://}"
        # Extract user:pass
        local user_pass="${without_proto%%@*}"
        DB_USER="${user_pass%%:*}"
        DB_PASS="${user_pass#*:}"
        # Extract host:port/db
        local host_port_db="${without_proto#*@}"
        DB_HOST="${host_port_db%%:*}"
        local port_db="${host_port_db#*:}"
        DB_PORT="${port_db%%/*}"
        DB_NAME="${port_db#*/}"
    }

    if [ -n "${DATABASE_URL:-}" ]; then
        parse_database_url "$DATABASE_URL"
        DB_HOST="${DB_HOST:-localhost}"
        DB_PORT="${DB_PORT:-5432}"
        DB_USER="${DB_USER:-postgres}"
        DB_PASS="${DB_PASS:-valueos_dev}"
        DB_NAME="${DB_NAME:-valueos_dev}"
    else
        DB_HOST="${POSTGRES_HOST:-localhost}"
        DB_PORT="${POSTGRES_PORT:-5432}"
        DB_USER="${POSTGRES_USER:-valueos}"
        DB_PASS="${POSTGRES_PASSWORD:-valueos_dev}"
        DB_NAME="${POSTGRES_DB:-valueos_dev}"
    fi

    until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            die "Database failed to start after $max_attempts attempts"
        fi
        log "Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 2
    done

    log "Database is ready"
}

# Service health check
service_health_check() {
    local service_name="$1"
    local check_command="$2"
    local max_attempts=${3:-10}
    local delay=${4:-3}

    log "Checking $service_name..."

    local attempt=0
    until eval "$check_command" > /dev/null 2>&1; do
            attempt=$((attempt + 1))
            if [ $attempt -ge $max_attempts ]; then
                log "$service_name is not responding after $max_attempts attempts"
                return 1
            fi
            log "Waiting for $service_name... (attempt $attempt/$max_attempts)"
            sleep $delay
        done

        # Only log success if it was a waiting attempt
        if [ $attempt -gt 0 ]; then
            log "$service_name is ready"
        fi
        return 0
}

# Make script executable
chmod +x "$0"
