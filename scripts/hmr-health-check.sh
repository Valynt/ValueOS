#!/bin/bash
# HMR Health Check and Auto-Restart Script for Docker Development Environment
# Monitors Vite HMR WebSocket and restarts dev server if unresponsive

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VITE_PORT="${VITE_PORT:-5173}"
HMR_PORT="${VITE_HMR_PORT:-24678}"
HEALTH_CHECK_INTERVAL="${HMR_HEALTH_INTERVAL:-30}"
MAX_FAILURES="${HMR_MAX_FAILURES:-3}"
LOG_FILE="${PROJECT_ROOT}/logs/hmr-health.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check if Vite dev server is running
check_vite_server() {
    if curl -f -s "http://localhost:${VITE_PORT}" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if HMR WebSocket is responsive
check_hmr_websocket() {
    # Use nc (netcat) to test WebSocket connectivity
    if echo "" | nc -w 3 localhost "$HMR_PORT" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check HMR with more detailed test
check_hmr_detailed() {
    # Test WebSocket handshake
    local handshake=$(printf "\\x83\\x00\\x00\\x00\\x00" | nc -w 5 localhost "$HMR_PORT" 2>/dev/null || echo "")
    
    if [[ -n "$handshake" ]]; then
        return 0
    else
        return 1
    fi
}

# Get Vite process information
get_vite_process() {
    pgrep -f "vite.*--port ${VITE_PORT}" || echo ""
}

# Restart Vite dev server
restart_vite() {
    log "🔄 Restarting Vite dev server..."
    
    # Kill existing Vite processes
    local vite_pid=$(get_vite_process)
    if [[ -n "$vite_pid" ]]; then
        log "🛑 Killing existing Vite process (PID: $vite_pid)"
        kill -TERM "$vite_pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        sleep 5
        
        # Force kill if still running
        if kill -0 "$vite_pid" 2>/dev/null; then
            log "💢 Force killing Vite process"
            kill -KILL "$vite_pid" 2>/dev/null || true
        fi
    fi
    
    # Clear any port conflicts
    lsof -ti ":${VITE_PORT}" | xargs kill -9 2>/dev/null || true
    lsof -ti ":${HMR_PORT}" | xargs kill -9 2>/dev/null || true
    
    # Wait a moment for ports to be released
    sleep 2
    
    # Start Vite dev server
    log "🚀 Starting Vite dev server..."
    cd "$PROJECT_ROOT"
    
    # Start in background with nohup for persistence
    nohup npm run dev > "$PROJECT_ROOT/logs/vite-dev.log" 2>&1 &
    local new_pid=$!
    
    log "📝 Vite started with PID: $new_pid"
    
    # Wait for server to start
    local startup_wait=0
    local max_startup_wait=30
    
    while [[ $startup_wait -lt $max_startup_wait ]]; do
        if check_vite_server && check_hmr_websocket; then
            log "✅ Vite dev server started successfully"
            return 0
        fi
        
        sleep 1
        startup_wait=$((startup_wait + 1))
    done
    
    log "❌ Vite dev server failed to start within ${max_startup_wait} seconds"
    return 1
}

# Main health check loop
main_health_check() {
    log "🔍 Starting HMR health check monitoring..."
    log "📊 Configuration: VITE_PORT=${VITE_PORT}, HMR_PORT=${HMR_PORT}, INTERVAL=${HEALTH_CHECK_INTERVAL}s"
    
    local failure_count=0
    
    while true; do
        local vite_ok=false
        local hmr_ok=false
        
        # Check Vite server
        if check_vite_server; then
            vite_ok=true
            log "✅ Vite server responsive"
        else
            log "❌ Vite server unresponsive"
        fi
        
        # Check HMR WebSocket
        if check_hmr_websocket; then
            hmr_ok=true
            log "✅ HMR WebSocket responsive"
        else
            log "❌ HMR WebSocket unresponsive"
        fi
        
        # Detailed HMR check if basic check fails
        if [[ "$hmr_ok" == false ]] && check_hmr_detailed; then
            hmr_ok=true
            log "✅ HMR WebSocket responsive (detailed check)"
        fi
        
        # Determine action based on health
        if [[ "$vite_ok" == true && "$hmr_ok" == true ]]; then
            # All systems healthy
            failure_count=0
            log "🟢 All systems healthy"
        else
            # Something is wrong
            failure_count=$((failure_count + 1))
            log "🔴 Health check failed ($failure_count/$MAX_FAILURES)"
            
            if [[ $failure_count -ge $MAX_FAILURES ]]; then
                log "🚨 Maximum failures reached, restarting Vite..."
                
                if restart_vite; then
                    log "✅ Vite restart successful"
                    failure_count=0
                else
                    log "❌ Vite restart failed"
                    # Send notification if webhook is configured
                    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
                        curl -X POST "$SLACK_WEBHOOK_URL" \
                            -H 'Content-type: application/json' \
                            --data "{\"text\":\"🚨 ValueOS HMR Health Check: Vite restart failed on $(hostname)\"}" \
                            2>/dev/null || true
                    fi
                fi
            fi
        fi
        
        # Wait for next check
        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# One-time health check
one_time_check() {
    log "🔍 Performing one-time HMR health check..."
    
    local vite_ok=false
    local hmr_ok=false
    
    if check_vite_server; then
        vite_ok=true
        echo "✅ Vite server responsive on port $VITE_PORT"
    else
        echo "❌ Vite server unresponsive on port $VITE_PORT"
    fi
    
    if check_hmr_websocket; then
        hmr_ok=true
        echo "✅ HMR WebSocket responsive on port $HMR_PORT"
    else
        echo "❌ HMR WebSocket unresponsive on port $HMR_PORT"
    fi
    
    if [[ "$vite_ok" == true && "$hmr_ok" == true ]]; then
        echo "🟢 All systems healthy"
        return 0
    else
        echo "🔴 Health check failed"
        return 1
    fi
}

# Status command
status_check() {
    echo "=== HMR Health Check Status ==="
    echo "VITE_PORT: $VITE_PORT"
    echo "HMR_PORT: $HMR_PORT"
    echo "HEALTH_CHECK_INTERVAL: ${HEALTH_CHECK_INTERVAL}s"
    echo "MAX_FAILURES: $MAX_FAILURES"
    echo "LOG_FILE: $LOG_FILE"
    echo ""
    
    local vite_pid=$(get_vite_process)
    if [[ -n "$vite_pid" ]]; then
        echo "Vite Process: Running (PID: $vite_pid)"
    else
        echo "Vite Process: Not running"
    fi
    
    echo ""
    one_time_check
}

# Cleanup function
cleanup() {
    log "🧹 Cleaning up HMR health check..."
    exit 0
}

# Signal handlers
trap cleanup SIGTERM SIGINT

# Command line interface
case "${1:-monitor}" in
    monitor)
        main_health_check
        ;;
    check)
        one_time_check
        ;;
    status)
        status_check
        ;;
    restart)
        restart_vite
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    *)
        echo "Usage: $0 {monitor|check|status|restart|logs}"
        echo "  monitor  - Continuous health monitoring (default)"
        echo "  check    - One-time health check"
        echo "  status   - Show current status"
        echo "  restart  - Restart Vite dev server"
        echo "  logs     - Tail health check logs"
        exit 1
        ;;
esac
