#!/bin/bash
# Self-Healing Script for ValueOS DevContainer
# Checks port availability and restarts crashed services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${GREEN}[SELF-HEAL]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Port configuration from deploy/envs/.env.ports
PORTS=(
    "5173:frontend:Frontend (Vite)"
    "3001:backend:Backend API"
    "54321:supabase:Supabase API"
    "5432:postgres:PostgreSQL"
    "6379:redis:Redis"
    "3000:grafana:Grafana"
    "9090:prometheus:Prometheus"
    "3200:tempo:Tempo Tracing"
)

# Docker compose file
COMPOSE_FILE="infra/docker/docker-compose.dev.yml"
COMPOSE_ENV="deploy/envs/.env.ports"

# Check if port is in use
check_port() {
    local port=$1
    nc -z localhost "$port" 2>/dev/null
    return $?
}

# Get service name from port
get_service_from_port() {
    local port=$1
    for entry in "${PORTS[@]}"; do
        IFS=':' read -r p service desc <<< "$entry"
        if [[ "$p" == "$port" ]]; then
            echo "$service"
            return 0
        fi
    done
    return 1
}

# Check if Docker container is running
is_container_running() {
    local service=$1
    docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV" ps -q "$service" 2>/dev/null | grep -q .
}

# Restart service
restart_service() {
    local service=$1
    log "Restarting service: $service"

    if docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV" restart "$service" 2>/dev/null; then
        log "✅ Service $service restarted successfully"
        return 0
    else
        error "❌ Failed to restart service $service"
        return 1
    fi
}

# Start service if not running
start_service() {
    local service=$1
    log "Starting service: $service"

    if docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV" up -d "$service" 2>/dev/null; then
        log "✅ Service $service started successfully"
        return 0
    else
        error "❌ Failed to start service $service"
        return 1
    fi
}

# Check service health
check_service_health() {
    local service=$1
    local health_status

    health_status=$(docker inspect --format='{{.State.Health.Status}}' "valueos-${service}" 2>/dev/null || echo "unknown")

    case "$health_status" in
        "healthy")
            return 0
            ;;
        "unhealthy")
            warn "Service $service is unhealthy"
            return 1
            ;;
        "starting")
            log "Service $service is starting..."
            return 2
            ;;
        *)
            return 3
            ;;
    esac
}

# Main healing logic
heal_services() {
    log "Starting self-healing check..."
    local issues_found=0

    for entry in "${PORTS[@]}"; do
        IFS=':' read -r port service desc <<< "$entry"

        log "Checking $desc (port $port)..."

        # Check if port is available
        if ! check_port "$port"; then
            warn "Port $port not responding for $desc"

            # Check if container is running
            if is_container_running "$service"; then
                # Container running but port not responding - check health
                if ! check_service_health "$service"; then
                    warn "Service $service is unhealthy, restarting..."
                    restart_service "$service"
                    issues_found=$((issues_found + 1))
                fi
            else
                # Container not running - start it
                warn "Service $service is not running, starting..."
                start_service "$service"
                issues_found=$((issues_found + 1))
            fi
        else
            log "✅ $desc is healthy (port $port responding)"
        fi
    done

    if [[ $issues_found -eq 0 ]]; then
        log "✅ All services are healthy!"
    else
        log "🔧 Fixed $issues_found service(s)"
    fi

    return $issues_found
}

# Check migrations folder
check_migrations() {
    log "Checking migrations folder..."

    if [[ ! -d "infra/supabase/migrations" ]]; then
        error "❌ Migrations folder not found: infra/supabase/migrations"
        log "Creating migrations folder..."
        mkdir -p infra/supabase/migrations
        touch infra/supabase/migrations/.gitkeep
        log "✅ Created migrations folder"
    else
        log "✅ Migrations folder exists"
    fi
}

# Cleanup stale containers
cleanup_stale_containers() {
    log "Checking for stale containers..."

    local stale=$(docker ps -a -f "status=exited" -f "name=valueos-" -q)
    if [[ -n "$stale" ]]; then
        warn "Found stale containers, removing..."
        docker rm $stale 2>/dev/null || true
        log "✅ Cleaned up stale containers"
    else
        log "✅ No stale containers found"
    fi
}

# Main function
main() {
    log "ValueOS Self-Healing System v1.0"
    echo ""

    # Check if we're in the right directory
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Not in project root or compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    # Check migrations
    check_migrations

    # Cleanup stale containers
    cleanup_stale_containers

    # Heal services
    heal_services

    log "Self-healing check complete!"
}

# Run with watch mode if --watch flag is provided
if [[ "$1" == "--watch" ]]; then
    log "Running in watch mode (checking every 60 seconds)..."
    while true; do
        main
        log "Waiting 60 seconds before next check..."
        sleep 60
    done
else
    main
fi
