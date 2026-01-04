#!/bin/bash
###############################################################################
# Apply Resource Limits to Running Container
# 
# Updates the running container with resource limits without full recreation
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER_NAME="valuecanvas-dev-optimized"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

###############################################################################
# Check current resource limits
###############################################################################

check_current_limits() {
    log_section "Current Resource Limits"
    
    if ! docker inspect "$CONTAINER_NAME" &> /dev/null; then
        log_error "Container $CONTAINER_NAME not found"
        exit 1
    fi
    
    log_info "Current configuration:"
    docker inspect "$CONTAINER_NAME" --format '{{json .HostConfig}}' | jq '{
        Memory,
        MemoryReservation,
        MemorySwap,
        NanoCpus,
        CpuShares,
        PidsLimit,
        RestartPolicy
    }'
}

###############################################################################
# Apply resource limits using docker update
###############################################################################

apply_limits_with_update() {
    log_section "Applying Resource Limits (docker update)"
    
    log_info "Updating container resource limits..."
    
    # Note: docker update has limitations - not all flags are supported
    # Supported: --memory, --memory-reservation, --memory-swap, --cpu-shares, --cpus, --pids-limit
    # Not supported: --restart (requires container recreation)
    
    docker update \
        --memory=6g \
        --memory-reservation=4g \
        --memory-swap=8g \
        --cpus=4 \
        --cpu-shares=2048 \
        --pids-limit=4096 \
        "$CONTAINER_NAME"
    
    log_info "✓ Resource limits updated"
}

###############################################################################
# Verify applied limits
###############################################################################

verify_limits() {
    log_section "Verifying Applied Limits"
    
    log_info "New configuration:"
    docker inspect "$CONTAINER_NAME" --format '{{json .HostConfig}}' | jq '{
        Memory,
        MemoryReservation,
        MemorySwap,
        NanoCpus,
        CpuShares,
        PidsLimit,
        RestartPolicy
    }'
    
    # Check if limits are applied
    local memory=$(docker inspect "$CONTAINER_NAME" --format '{{.HostConfig.Memory}}')
    local cpus=$(docker inspect "$CONTAINER_NAME" --format '{{.HostConfig.NanoCpus}}')
    local pids=$(docker inspect "$CONTAINER_NAME" --format '{{.HostConfig.PidsLimit}}')
    
    local all_good=true
    
    if [ "$memory" -eq 0 ]; then
        log_error "Memory limit not applied"
        all_good=false
    else
        log_info "✓ Memory limit: $(numfmt --to=iec $memory)"
    fi
    
    if [ "$cpus" -eq 0 ]; then
        log_error "CPU limit not applied"
        all_good=false
    else
        local cpu_count=$(echo "scale=2; $cpus / 1000000000" | bc)
        log_info "✓ CPU limit: ${cpu_count} cores"
    fi
    
    if [ "$pids" = "null" ] || [ "$pids" -eq 0 ]; then
        log_error "PID limit not applied"
        all_good=false
    else
        log_info "✓ PID limit: $pids"
    fi
    
    if [ "$all_good" = true ]; then
        log_info "✅ All resource limits successfully applied"
        return 0
    else
        log_warn "⚠️  Some limits may not have been applied"
        log_warn "Container recreation may be required for full effect"
        return 1
    fi
}

###############################################################################
# Show restart policy note
###############################################################################

show_restart_note() {
    log_section "Restart Policy"
    
    log_warn "Note: Restart policy cannot be updated on running container"
    log_warn "To apply restart policy (--restart=unless-stopped):"
    echo ""
    echo "Option 1: Update via Docker API (if container was created with docker run):"
    echo "  docker update --restart=unless-stopped $CONTAINER_NAME"
    echo ""
    echo "Option 2: Recreate container (recommended for dev containers):"
    echo "  # This will be done when you rebuild the dev container"
    echo "  # The restart policy is configured in devcontainer.json"
    echo ""
}

###############################################################################
# Main execution
###############################################################################

main() {
    echo "========================================="
    echo "  Apply Resource Limits"
    echo "========================================="
    echo ""
    
    check_current_limits
    
    log_warn "This will update resource limits on the running container"
    log_warn "The container will continue running, but limits will take effect immediately"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    apply_limits_with_update
    
    echo ""
    sleep 2  # Give Docker a moment to apply changes
    
    if verify_limits; then
        show_restart_note
        
        echo ""
        log_info "✅ Resource limits applied successfully"
        log_info "Monitor resource usage with: docker stats $CONTAINER_NAME"
        exit 0
    else
        log_error "Failed to apply all resource limits"
        log_info "You may need to rebuild the dev container for full effect"
        exit 1
    fi
}

main "$@"
