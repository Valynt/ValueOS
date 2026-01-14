#!/bin/bash
# Spot Instance Interruption Handler
# Gracefully handles AWS spot instance termination notices

set -euo pipefail

# Configuration
LOG_FILE="/var/log/spot-interruption-handler.log"
METADATA_URL="http://169.254.169.254/latest/meta-data"
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
NAMESPACE="${KUBERNETES_NAMESPACE:-valueos-ha}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check for spot interruption notice
check_interruption_notice() {
    log "Checking for spot interruption notice..."
    
    # Check termination notice
    if curl -s "$METADATA_URL/spot/termination-time" > /dev/null 2>&1; then
        local termination_time=$(curl -s "$METADATA_URL/spot/termination-time")
        log "Spot termination notice received. Termination time: $termination_time"
        return 0
    fi
    
    # Check rebalance recommendation
    if curl -s "$METADATA_URL/events/recommendations/rebalance" | grep -q '"instance-action": "rebalance"'; then
        log "Spot rebalance recommendation received"
        return 0
    fi
    
    return 1
}

# Gracefully drain node
drain_node() {
    local node_name=$(hostname)
    log "Draining node: $node_name"
    
    # Mark node as unschedulable
    kubectl cordon "$node_name" --namespace="$NAMESPACE" || true
    
    # Evict pods gracefully
    kubectl drain "$node_name" \
        --namespace="$NAMESPACE" \
        --ignore-daemonsets \
        --delete-emptydir-data \
        --force \
        --grace-period=120 || true
    
    log "Node drain completed"
}

# Send notification
send_notification() {
    local message="$1"
    
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Spot Instance Interruption: $message\"}" || true
    fi
    
    log "Notification sent: $message"
}

# Handle spot interruption
handle_interruption() {
    local node_name=$(hostname)
    local instance_id=$(curl -s "$METADATA_URL/instance-id")
    
    log "Handling spot interruption for instance: $instance_id"
    send_notification "Instance $instance_id ($node_name) is being terminated"
    
    # Drain node gracefully
    drain_node
    
    # Add final delay before termination
    log "Waiting for termination..."
    sleep 30
    
    log "Spot interruption handling completed"
}

# Monitor for interruptions
monitor_interruptions() {
    log "Starting spot interruption monitoring..."
    
    while true; do
        if check_interruption_notice; then
            handle_interruption
            break
        fi
        
        sleep 5
    done
}

# Main execution
main() {
    log "Spot interruption handler started"
    
    # Verify kubectl access
    if ! command -v kubectl &> /dev/null; then
        log "ERROR: kubectl not found"
        exit 1
    fi
    
    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR: Cannot access Kubernetes cluster"
        exit 1
    fi
    
    monitor_interruptions
}

# Handle signals
trap 'log "Spot interruption handler stopped"; exit 0' SIGTERM SIGINT

# Run main function
main "$@"
