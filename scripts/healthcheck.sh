#!/bin/sh
# scripts/healthcheck.sh

set -e

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/health}"
TIMEOUT="${HEALTH_TIMEOUT:-5}"

# Check for zombie processes
check_zombies() {
    ZOMBIE_COUNT=$(ps aux | grep -c 'Z' || true)
    if [ "$ZOMBIE_COUNT" -gt 5 ]; then
        echo "ERROR: Too many zombie processes: $ZOMBIE_COUNT"
        return 1
    fi
    return 0
}

# Check memory usage
check_memory() {
    # Get memory usage percentage
    # Note: free might not be available in all alpine versions, fallback to /proc/meminfo
    if command -v free > /dev/null; then
        MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    else
        MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEM_FREE=$(grep MemFree /proc/meminfo | awk '{print $2}')
        MEM_USED=$((MEM_TOTAL - MEM_FREE))
        MEM_USAGE=$((MEM_USED * 100 / MEM_TOTAL))
    fi

    if [ "$MEM_USAGE" -gt 90 ]; then
        echo "ERROR: Memory usage too high: ${MEM_USAGE}%"
        return 1
    fi
    return 0
}

# Check HTTP health endpoint
check_http() {
    # Use wget if curl is not available
    if command -v wget > /dev/null; then
        RESPONSE=$(wget -q -O - --timeout="$TIMEOUT" "$HEALTH_ENDPOINT" 2>/dev/null || echo "FAILED")
    else
        RESPONSE=$(curl -s --max-time "$TIMEOUT" "$HEALTH_ENDPOINT" 2>/dev/null || echo "FAILED")
    fi
    
    if echo "$RESPONSE" | grep -q '"status":"healthy"'; then
        return 0
    else
        echo "ERROR: Health endpoint returned: $RESPONSE"
        return 1
    fi
}

# Main health check
main() {
    echo "Running health checks..."
    
    # Check for zombies
    if ! check_zombies; then
        exit 1
    fi
    
    # Check memory
    if ! check_memory; then
        exit 1
    fi
    
    # Check HTTP endpoint
    if ! check_http; then
        exit 1
    fi
    
    echo "All health checks passed"
    exit 0
}

main
