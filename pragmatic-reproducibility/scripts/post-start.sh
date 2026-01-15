#!/usr/bin/env bash
# scripts/post-start.sh
# Lightweight startup - observability is opt-in
#
# Environment variables:
#   VALUEOS_ENABLE_OBSERVABILITY=true  # Enable full observability stack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
    echo "[post-start] $*"
}

# ─────────────────────────────────────────────────────────────────────────────
# Core services (always started)
# ─────────────────────────────────────────────────────────────────────────────
start_core_services() {
    log "Starting core services..."

    # Check and fix ports first
    if [[ -f "$SCRIPT_DIR/fix-ports.sh" ]]; then
        bash "$SCRIPT_DIR/fix-ports.sh" check || \
            bash "$SCRIPT_DIR/fix-ports.sh" fix
    fi

    # Start Supabase (includes Postgres)
    if command -v supabase &>/dev/null; then
        if ! supabase status &>/dev/null; then
            log "Starting Supabase..."
            supabase start --ignore-health-check &
        fi
    fi

    log "Core services started"
}

# ─────────────────────────────────────────────────────────────────────────────
# Observability (opt-in via environment variable or command)
# ─────────────────────────────────────────────────────────────────────────────
start_observability() {
    log "Starting observability stack..."

    local compose_file="$PROJECT_ROOT/docker-compose.observability.yml"

    if [[ -f "$compose_file" ]]; then
        docker compose -f "$compose_file" up -d

        log "Observability available at:"
        log "  - Grafana:    http://localhost:3000"
        log "  - Prometheus: http://localhost:9090"
        log "  - Jaeger:     http://localhost:16686"
    else
        log "⚠️  docker-compose.observability.yml not found"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Quick health check
# ─────────────────────────────────────────────────────────────────────────────
quick_health_check() {
    local issues=0

    # Check disk space
    local disk_usage=$(df "$PROJECT_ROOT" 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo "0")
    if [[ "$disk_usage" =~ ^[0-9]+$ ]] && [[ "$disk_usage" -ge 90 ]]; then
        log "⚠️  Disk space low: ${disk_usage}%"
        issues=$((issues + 1))
    fi

    # Check node_modules
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        log "⚠️  node_modules missing - run 'pnpm install'"
        issues=$((issues + 1))
    fi

    # Check .env
    if [[ ! -f "$PROJECT_ROOT/.env" ]] && [[ ! -f "$PROJECT_ROOT/.env.local" ]]; then
        log "⚠️  .env missing - run 'cp .env.example .env'"
        issues=$((issues + 1))
    fi

    return $issues
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "========================================"
    echo "  ValueOS Dev Container - Starting"
    echo "========================================"
    echo ""

    cd "$PROJECT_ROOT"

    start_core_services

    # Observability opt-in check
    if [[ "${VALUEOS_ENABLE_OBSERVABILITY:-false}" == "true" ]]; then
        start_observability
    else
        log ""
        log "💡 Observability is disabled by default"
        log "   To enable: export VALUEOS_ENABLE_OBSERVABILITY=true"
        log "   Or run:    task obs:up"
    fi

    # Run quick health check
    echo ""
    quick_health_check || log "Run 'task health' for full diagnostics"

    echo ""
    echo "========================================"
    echo "  ✅ Development environment ready!"
    echo "========================================"
    echo ""
    echo "Quick commands:"
    echo "  pnpm dev       - Start frontend dev server"
    echo "  pnpm api:dev   - Start backend dev server"
    echo "  task dev       - Start everything"
    echo "  task obs:up    - Enable observability"
    echo ""
}

main "$@"
