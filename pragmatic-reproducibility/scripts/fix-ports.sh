#!/usr/bin/env bash
# scripts/fix-ports.sh
# Self-healing port allocation with intelligent conflict resolution
#
# Usage:
#   ./fix-ports.sh check  # Check port availability
#   ./fix-ports.sh fix    # Free conflicting ports
#   ./fix-ports.sh        # Default: fix

set -euo pipefail

# Port configuration with priorities
declare -A PORTS=(
    [5173]="vite:frontend"
    [3001]="api:backend"
    [5432]="postgres:database"
    [6379]="redis:cache"
    [54321]="supabase-api:supabase"
    [54323]="supabase-studio:supabase"
    [9090]="prometheus:observability"
    [3000]="grafana:observability"
)

# Priority levels (lower = more important)
declare -A PRIORITY=(
    [frontend]=1
    [backend]=1
    [database]=2
    [cache]=2
    [supabase]=3
    [observability]=4
)

log() {
    echo "[$(date '+%H:%M:%S')] $*"
}

check_port() {
    local port=$1
    if lsof -i :$port -sTCP:LISTEN -t &>/dev/null; then
        return 1  # Port in use
    fi
    return 0  # Port available
}

get_process_on_port() {
    local port=$1
    lsof -i :$port -sTCP:LISTEN -t 2>/dev/null | head -1
}

kill_process_on_port() {
    local port=$1
    local pid=$(get_process_on_port $port)

    if [[ -n "$pid" ]]; then
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        log "⚠️  Killing process $pid ($process_name) on port $port"
        kill -TERM $pid 2>/dev/null || true
        sleep 1

        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            log "   Force killing $pid..."
            kill -9 $pid 2>/dev/null || true
        fi
    fi
}

fix_all_ports() {
    log "🔍 Checking port availability..."

    local conflicts=()

    for port in "${!PORTS[@]}"; do
        if ! check_port $port; then
            conflicts+=($port)
        fi
    done

    if [[ ${#conflicts[@]} -eq 0 ]]; then
        log "✅ All ports available"
        return 0
    fi

    log "⚠️  Found ${#conflicts[@]} port conflicts: ${conflicts[*]}"

    # Sort conflicts by priority (free lower-priority ports first)
    for port in "${conflicts[@]}"; do
        local service_info="${PORTS[$port]}"
        local service_name="${service_info%%:*}"
        local category="${service_info##*:}"
        local priority="${PRIORITY[$category]:-99}"

        log "   Port $port ($service_name, priority $priority)"
    done

    # Interactive mode check
    if [[ -t 0 ]]; then
        echo ""
        read -p "Free all conflicting ports? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Aborted by user"
            return 1
        fi
    fi

    # Free ports
    for port in "${conflicts[@]}"; do
        kill_process_on_port $port
    done

    # Verify
    sleep 1
    local still_blocked=()
    for port in "${conflicts[@]}"; do
        if ! check_port $port; then
            still_blocked+=($port)
        fi
    done

    if [[ ${#still_blocked[@]} -gt 0 ]]; then
        log "❌ Failed to free ports: ${still_blocked[*]}"
        return 1
    fi

    log "✅ All ports freed successfully"
}

# Run health check
health_check() {
    log "🏥 Running port health check..."

    local status=0
    for port in "${!PORTS[@]}"; do
        local service_info="${PORTS[$port]}"
        local service_name="${service_info%%:*}"

        if check_port $port; then
            echo "   ✓ Port $port ($service_name): available"
        else
            local pid=$(get_process_on_port $port)
            local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            echo "   ✗ Port $port ($service_name): in use by $process (PID $pid)"
            status=1
        fi
    done

    return $status
}

# Main
case "${1:-fix}" in
    check)
        health_check
        ;;
    fix)
        fix_all_ports
        ;;
    *)
        echo "Usage: $0 [check|fix]"
        exit 1
        ;;
esac
