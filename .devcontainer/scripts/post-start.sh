#!/bin/bash
set -euo pipefail

# post-start.sh
# Runs every time the DevContainer starts
# Performs runtime checks and service monitoring

echo "🚀 Running post-start checks..."

# Run framework-level backing services health checks
if [ -f pragmatic-reproducibility/scripts/healthcheck-services.sh ]; then
    bash pragmatic-reproducibility/scripts/healthcheck-services.sh
fi

# =============================================================================
# SERVICE HEALTH MONITORING
# =============================================================================

check_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=${3:-10}
    local delay=${4:-3}
    
    echo "🔍 Checking $service_name..."
    
    local attempt=0
    until eval "$check_command" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "⚠️  $service_name is not responding after $max_attempts attempts"
            return 1
        fi
        echo "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep $delay
    done
    
    echo "✅ $service_name is ready"
    return 0
}

# Check core services
check_service "PostgreSQL" "PGPASSWORD='${POSTGRES_PASSWORD:-valueos_dev}' psql -h localhost -p ${POSTGRES_PORT:-54323} -U ${POSTGRES_USER:-valueos} -d ${POSTGRES_DB:-valueos_dev} -c 'SELECT 1'"
check_service "Redis" "redis-cli -h localhost -p ${REDIS_PORT:-6379} -a '${REDIS_PASSWORD:-valueos_dev}' ping"
check_service "Kong" "curl -f http://localhost:8001/"
check_service "Supabase Auth" "curl -f http://localhost:9999/health"
check_service "PostgREST" "curl -f http://localhost:3000/"

# Check agent fabric if enabled
if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    check_service "NATS" "curl -f http://localhost:8222/healthz"
    check_service "Opportunity Agent" "curl -f http://localhost:8081/health" 15 5
    check_service "Target Agent" "curl -f http://localhost:8082/health" 15 5
    check_service "Realization Agent" "curl -f http://localhost:8083/health" 15 5
    check_service "Expansion Agent" "curl -f http://localhost:8084/health" 15 5
fi

# =============================================================================
# DISPLAY SERVICE URLS
# =============================================================================

echo ""
echo "🌐 Service URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Frontend:          http://localhost:3001"
echo "  Supabase Studio:   http://localhost:54324"
echo "  Kong Gateway:      http://localhost:8000"
echo "  Kong Admin:        http://localhost:8001"
echo "  PostgREST API:     http://localhost:3000"
echo "  Supabase Auth:     http://localhost:9999"
echo "  PostgreSQL:        localhost:54323"
echo "  Redis:             localhost:6379"

if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    echo ""
    echo "  🤖 Agent Fabric:"
    echo "  NATS Monitor:      http://localhost:8222"
    echo "  Opportunity Agent: http://localhost:8081"
    echo "  Target Agent:      http://localhost:8082"
    echo "  Realization Agent: http://localhost:8083"
    echo "  Expansion Agent:   http://localhost:8084"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# DISPLAY USEFUL COMMANDS
# =============================================================================

echo "📝 Useful commands:"
echo "  pnpm dev              - Start development server"
echo "  pnpm build            - Build for production"
echo "  pnpm test             - Run tests"
echo "  pnpm lint             - Lint code"
echo "  pnpm format           - Format code"
echo ""
echo "  Database:"
echo "  bash infra/scripts/apply_migrations.sh  - Apply migrations"
echo "  psql -h localhost -p 54323 -U valueos -d valueos_dev  - Connect to DB"
echo ""

# =============================================================================
# COMPLETION
# =============================================================================

echo "✅ All services are ready!"
echo "🎉 Happy coding!"
echo ""
