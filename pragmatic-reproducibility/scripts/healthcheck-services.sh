#!/usr/bin/env bash
# scripts/healthcheck-services.sh
# Comprehensive service health monitoring with auto-recovery
#
# Usage:
#   ./healthcheck-services.sh check  # Check service health
#   ./healthcheck-services.sh fix    # Start unhealthy services
#   ./healthcheck-services.sh watch  # Continuous monitoring

set -euo pipefail

HEALTH_DIR="/tmp/valueos-health"
mkdir -p "$HEALTH_DIR"

# Service definitions: name|check_command|start_command|timeout
declare -a SERVICES=(
    "postgres|pg_isready -h localhost -p 5432|docker compose up -d postgres|30"
    "redis|redis-cli -p 6379 ping|docker compose up -d redis|10"
    "supabase|curl -sf http://localhost:54321/rest/v1/|supabase start|60"
    "vite|curl -sf http://localhost:5173/|pnpm dev --host|15"
    "api|curl -sf http://localhost:3001/health|pnpm api:dev|15"
)

log() {
    echo "[$(date '+%H:%M:%S')] $*"
}

check_service() {
    local name=$1
    local check_cmd=$2
    local timeout_val=${3:-5}

    timeout $timeout_val bash -c "$check_cmd" &>/dev/null
}

start_service() {
    local name=$1
    local start_cmd=$2
    local timeout_val=$3
    local check_cmd=$4

    log "🚀 Starting $name..."

    # Run start command in background
    nohup bash -c "$start_cmd" > "$HEALTH_DIR/${name}.log" 2>&1 &
    local pid=$!
    echo $pid > "$HEALTH_DIR/${name}.pid"

    # Wait for service to become healthy
    local elapsed=0
    while [[ $elapsed -lt $timeout_val ]]; do
        sleep 2
        elapsed=$((elapsed + 2))

        if check_service "$name" "$check_cmd" 2; then
            log "   ✓ $name is healthy (took ${elapsed}s)"
            return 0
        fi
    done

    log "   ✗ $name failed to start within ${timeout_val}s"
    return 1
}

run_health_check() {
    local mode="${1:-check}"
    local exit_code=0

    log "🏥 Service health check (mode: $mode)"
    echo ""

    for service_def in "${SERVICES[@]}"; do
        IFS='|' read -r name check_cmd start_cmd timeout_val <<< "$service_def"

        if check_service "$name" "$check_cmd" 5; then
            echo "   ✅ $name: healthy"
        else
            echo "   ❌ $name: unhealthy"

            if [[ "$mode" == "fix" ]]; then
                start_service "$name" "$start_cmd" "$timeout_val" "$check_cmd" || exit_code=1
            else
                exit_code=1
            fi
        fi
    done

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        log "✅ All services healthy"
    else
        log "⚠️  Some services need attention"
    fi

    return $exit_code
}

# Continuous monitoring mode
watch_services() {
    log "👁️  Starting continuous health monitoring (Ctrl+C to stop)"

    while true; do
        clear
        run_health_check check || true
        echo ""
        echo "Refreshing in 10 seconds..."
        sleep 10
    done
}

case "${1:-check}" in
    check)
        run_health_check check
        ;;
    fix)
        run_health_check fix
        ;;
    watch)
        watch_services
        ;;
    *)
        echo "Usage: $0 [check|fix|watch]"
        exit 1
        ;;
esac
