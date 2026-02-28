#!/usr/bin/env bash
set -euo pipefail

# Source shared environment setup (prefer env-setup.sh)
# shellcheck source=/dev/null
if [[ -f .devcontainer/scripts/env-setup.sh ]]; then
    source ".devcontainer/scripts/env-setup.sh"
elif [[ -f .devcontainer/scripts/env.sh ]]; then
    source ".devcontainer/scripts/env.sh"
fi

log()  { printf '[post-start] %s\n' "$*" >&2; }
die()  { printf '[post-start][ERROR] %s\n' "$*" >&2; exit 1; }

: "${WORKSPACE_FOLDER:?WORKSPACE_FOLDER is not set}"
[[ -d "$WORKSPACE_FOLDER" ]] || die "Workspace not found: $WORKSPACE_FOLDER"
cd "$WORKSPACE_FOLDER" || die "Failed to cd into workspace: $WORKSPACE_FOLDER"

# post-start.sh
# Runs every time the DevContainer starts
# Performs runtime checks and service monitoring

log "Running post-start checks..."

# Load environment variables
load_environment

# Run framework-level backing services health checks
if [ -f pragmatic-reproducibility/scripts/healthcheck-services.sh ]; then
    bash pragmatic-reproducibility/scripts/healthcheck-services.sh
fi

# =============================================================================
# SERVICE HEALTH MONITORING
# =============================================================================

# Check core services
database_health_check

if redis-cli -h localhost -p "${REDIS_PORT:-6379}" -a "${REDIS_PASSWORD:-valueos_dev}" ping > /dev/null 2>&1; then
    log "Redis is healthy"
else
    log "Redis health check failed"
fi

if curl -f http://localhost:8001/ > /dev/null 2>&1; then
    log "Kong is healthy"
else
    log "Kong health check failed"
fi

if curl -f http://localhost:9999/health > /dev/null 2>&1; then
    log "Supabase Auth is healthy"
else
    log "Supabase Auth health check failed"
fi

if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    log "PostgREST is healthy"
else
    log "PostgREST health check failed"
fi

# Check agent fabric if enabled
if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    if curl -f http://localhost:8222/healthz > /dev/null 2>&1; then
        log "NATS is healthy"
    else
        log "NATS health check failed"
    fi

    if curl -f http://localhost:8081/health > /dev/null 2>&1; then
        log "Opportunity Agent is healthy"
    else
        log "Opportunity Agent health check failed"
    fi

    if curl -f http://localhost:8082/health > /dev/null 2>&1; then
        log "Target Agent is healthy"
    else
        log "Target Agent health check failed"
    fi

    if curl -f http://localhost:8083/health > /dev/null 2>&1; then
        log "Realization Agent is healthy"
    else
        log "Realization Agent health check failed"
    fi

    if curl -f http://localhost:8084/health > /dev/null 2>&1; then
        log "Expansion Agent is healthy"
    else
        log "Expansion Agent health check failed"
    fi
fi

# =============================================================================
# DISPLAY SERVICE URLS
# =============================================================================

log ""
log "Service URLs:"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  Frontend:          http://localhost:3001"
log "  Supabase Studio:   http://localhost:54324"
log "  Kong Gateway:      http://localhost:8000"
log "  Kong Admin:        http://localhost:8001"
log "  PostgREST API:     http://localhost:3000"
log "  Supabase Auth:     http://localhost:9999"
log "  PostgreSQL:        localhost:${POSTGRES_PORT:-5432}"
log "  Redis:             localhost:6379"

if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    log ""
    log "  Agent Fabric:"
    log "  NATS Monitor:      http://localhost:8222"
    log "  Opportunity Agent: http://localhost:8081"
    log "  Target Agent:      http://localhost:8082"
    log "  Realization Agent: http://localhost:8083"
    log "  Expansion Agent:   http://localhost:8084"
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# =============================================================================
# DISPLAY USEFUL COMMANDS
# =============================================================================

log "Useful commands:"
log "  pnpm dev              - Start development server"
log "  pnpm build            - Build for production"
log "  pnpm test             - Run tests"
log "  pnpm lint             - Lint code"
log "  pnpm format           - Format code"
log ""
log "  Database:"
log "  bash infra/scripts/apply_migrations.sh  - Apply migrations"
log "  psql -h localhost -p ${POSTGRES_PORT:-5432} -U valueos -d valueos_dev  - Connect to DB"
log ""

# =============================================================================
# COMPLETION
# =============================================================================

log "All services are ready!"
log "Happy coding!"
log ""

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
check_service "PostgreSQL" "PGPASSWORD='${POSTGRES_PASSWORD:-valueos_dev}' psql -h localhost -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-valueos} -d ${POSTGRES_DB:-valueos_dev} -c 'SELECT 1'"
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
echo "  PostgreSQL:        localhost:${POSTGRES_PORT:-5432}"
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
echo "  psql -h localhost -p ${POSTGRES_PORT:-5432} -U valueos -d valueos_dev  - Connect to DB"
echo ""

# =============================================================================
# COMPLETION
# =============================================================================

echo "✅ All services are ready!"
echo "🎉 Happy coding!"
echo ""
