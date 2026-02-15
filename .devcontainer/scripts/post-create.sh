#!/bin/bash
set -euo pipefail

# post-create.sh
# Runs after on-create, performs additional setup tasks

echo "🔧 Running post-create setup..."

# Load canonical port/env inputs
if [ -f .env.ports ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.ports | xargs)
elif [ -f .env.ports.example ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.ports.example | xargs)
fi

if [ -f .env.local ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env.local | xargs)
fi

# =============================================================================
# BUILD VERIFICATION
# =============================================================================

echo "🏗️  Verifying build configuration..."

# Check if TypeScript config is valid
if [ -f tsconfig.json ]; then
    echo "✅ TypeScript configuration found"
fi

# Check if package.json exists
if [ -f package.json ]; then
    echo "✅ Package configuration found"
fi


# Verify Corepack-managed pnpm availability
echo "📦 Verifying Corepack pnpm setup..."
if command -v corepack > /dev/null 2>&1; then
    if [ -x .devcontainer/scripts/read-version.sh ]; then
        PNPM_VERSION="$(.devcontainer/scripts/read-version.sh pnpm)"
    else
        PNPM_VERSION="9.15.0"
    fi
    corepack enable
    corepack prepare "pnpm@${PNPM_VERSION}" --activate
fi
if command -v pnpm > /dev/null 2>&1; then
    echo "✅ pnpm is available: $(pnpm --version)"
else
    echo "❌ pnpm is not available after post-create setup"
    exit 1
fi

# =============================================================================
# HEALTH CHECKS
# =============================================================================

echo "🏥 Running health checks..."

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

# Check PostgreSQL
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "⚠️  PostgreSQL health check failed"
fi

# Check Redis
if redis-cli -h localhost -p "${REDIS_PORT:-6379}" -a "${REDIS_PASSWORD:-valueos_dev}" ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "⚠️  Redis health check failed"
fi

# Check Kong
if curl -f http://localhost:8001/ > /dev/null 2>&1; then
    echo "✅ Kong is healthy"
else
    echo "⚠️  Kong health check failed"
fi

# =============================================================================
# SEED DATA (OPTIONAL)
# =============================================================================

if [ "${SEED_DATABASE:-false}" = "true" ]; then
    echo "🌱 Seeding database..."

    if [ -f scripts/seed.sh ]; then
        bash scripts/seed.sh
        echo "✅ Database seeded"
    else
        echo "⚠️  Seed script not found, skipping"
    fi
fi

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "✅ post-create setup completed!"
echo ""
