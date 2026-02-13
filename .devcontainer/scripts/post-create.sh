#!/bin/bash
set -euo pipefail

# post-create.sh
# Runs after on-create, performs additional setup tasks

echo "🔧 Running post-create setup..."

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

# =============================================================================
# HEALTH CHECKS
# =============================================================================

echo "🏥 Running health checks..."

# Check PostgreSQL
if PGPASSWORD="${POSTGRES_PASSWORD:-valueos_dev}" psql -h localhost -p "${POSTGRES_PORT:-54323}" -U "${POSTGRES_USER:-valueos}" -d "${POSTGRES_DB:-valueos_dev}" -c "SELECT version();" > /dev/null 2>&1; then
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
