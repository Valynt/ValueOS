#!/bin/bash
set -euo pipefail

# on-create.sh
# Runs once when the DevContainer is created
# Performs initial setup and configuration

echo "🔧 Running on-create setup..."

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

# Load environment variables
# Ports come from root .env.ports. Secrets belong in .env.local only.
if [ -f .env.ports ]; then
    echo "📋 Loading port configuration from .env.ports..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.ports | xargs)
elif [ -f .env.ports.example ]; then
    echo "📋 Loading fallback port configuration from .env.ports.example..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.ports.example | xargs)
fi

if [ -f .env.local ]; then
    echo "🔐 Loading local secrets from .env.local..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.local | xargs)
fi

if [ -f .devcontainer/.env ]; then
    echo "📋 Loading devcontainer overrides from .devcontainer/.env..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' .devcontainer/.env | xargs)
elif [ -f .devcontainer/.env.template ] && [ ! -f .devcontainer/.env ]; then
    cp .devcontainer/.env.template .devcontainer/.env
    echo "✅ Created .env from template"
elif [ ! -f .devcontainer/.env ]; then
    echo "⚠️  No .env or .env.template found, skipping .env creation"
else
    echo "Skipping .env creation"
fi

# =============================================================================
# DEPENDENCY INSTALLATION
# =============================================================================

echo "📦 Installing dependencies..."

# Display pinned tool versions
bash .devcontainer/scripts/toolchain-versions.sh

# Enable pnpm
PNPM_VERSION="9.15.0"
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
        PNPM_VERSION="${detected_pnpm_version}"
    fi
fi

corepack enable
# Prefer the script-based resolver if present; fall back to versions.json/default.
if [ -x .devcontainer/scripts/read-version.sh ]; then
    PNPM_VERSION="$(.devcontainer/scripts/read-version.sh pnpm)"
fi
corepack prepare "pnpm@${PNPM_VERSION}" --activate

# Install workspace dependencies
if [ -f pnpm-lock.yaml ]; then
    echo "📥 Installing pnpm dependencies..."
    pnpm install --frozen-lockfile || echo "⚠️ pnpm install failed (will retry manually)"
else
    echo "📥 Installing pnpm dependencies (no lockfile)..."
    pnpm install
fi

# =============================================================================
# DATABASE INITIALIZATION
# =============================================================================

echo "🗄️  Waiting for database to be ready..."

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

# Wait for PostgreSQL to be ready
max_attempts=30
attempt=0
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Database failed to start after $max_attempts attempts"
        exit 1
    fi
    echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 2
done

echo "✅ Database is ready"

# =============================================================================
# MIGRATION APPLICATION
# =============================================================================

echo "🚀 Applying database migrations..."

if [ -f infra/scripts/apply_migrations.sh ]; then
    bash infra/scripts/apply_migrations.sh
    echo "✅ Migrations applied successfully"
else
    echo "⚠️  Migration script not found, skipping"
fi

# =============================================================================
# AGENT FABRIC SETUP
# =============================================================================

if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    echo "🤖 Setting up agent fabric..."

    # Wait for NATS to be ready
    max_attempts=30
    attempt=0
    until curl -f http://localhost:8222/healthz > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "⚠️  NATS failed to start, continuing anyway"
            break
        fi
        echo "⏳ Waiting for NATS... (attempt $attempt/$max_attempts)"
        sleep 2
    done

    echo "✅ Agent fabric ready"
fi

# =============================================================================
# DEVELOPMENT TOOLS
# =============================================================================

echo "🛠️  Setting up development tools..."

# Ensure build-essential is available in the dev environment. It is intentionally
# installed at create time so the Dockerfile can keep final stage minimal.
if ! dpkg -s build-essential >/dev/null 2>&1; then
    echo "🔧 Installing build-essential for dev environment..."
    sudo apt-get update && sudo apt-get install -y --no-install-recommends build-essential
fi

# Install global tools if needed
if ! command -v tsx &> /dev/null; then
    pnpm add -g tsx
fi

# Setup git hooks if using husky
if [ -d .husky ]; then
    echo "🪝 Setting up git hooks..."
    pnpm exec husky install
fi

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "✅ on-create setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "  1. Review .devcontainer/.env and update as needed"
echo "  2. Run 'pnpm dev' to start the development server"
echo "  3. Open http://localhost:3001 for the frontend"
echo "  4. Open http://localhost:54324 for Supabase Studio"
echo ""

# Ensure required directories exist
mkdir -p /home/vscode/.devcontainer

# Create placeholder marker files
touch /home/vscode/.devcontainer/.onCreateCommandMarker

# Set environment variables
export NODE_ENV=development
export PNPM_HOME=/home/vscode/.local/share/pnpm
export COREPACK_HOME=/home/vscode/.cache/corepack
