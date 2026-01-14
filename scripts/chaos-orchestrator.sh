#!/bin/bash
# Chaos Engineering Orchestrator
# Executes controlled chaos experiments to test system resilience

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="valueos-ha"
LOG_FILE="/var/log/chaos-orchestrator.log"
CONFIG_FILE="$PROJECT_ROOT/k8s/chaos-config.yaml"
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Chaos state tracking
CHAOS_STATE_DIR="/tmp/chaos-state"
EXPERIMENT_LOG="$CHAOS_STATE_DIR/experiments.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Send notification
send_notification() {
    local message="$1"
    local severity="${2:-info}"
    
    if [[ -n "$WEBHOOK_URL" ]]; then
        local emoji="ℹ️"
        case "$severity" in
            "critical") emoji="🚨" ;;
            "warning") emoji="⚠️" ;;
            "info") emoji="ℹ️" ;;
        esac
        
        curl -X POST "$WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji Chaos Engineering: $message\"}" || true
    fi
    
    log "Notification: $message"
}

# Check if chaos is safe to run
check_safety_conditions() {
    log "Checking safety conditions..."
    
    # Check cluster health
    local unhealthy_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers | wc -l)
    if [[ $unhealthy_pods -gt 2 ]]; then
        log "WARNING: $unhealthy_pods unhealthy pods detected, skipping chaos"
        send_notification "Skipping chaos due to unhealthy cluster state" "warning"
        return 1
    fi
    
    # Check recent deployments
    local recent_deployments=$(kubectl get deployments -n "$NAMESPACE" -o json | jq '.items[] | select(.metadata.creationTimestamp > (now | strftime("%Y-%m-%dT%H:%M:%SZ") | sub("[0-9]{2}:[0-9]{2}:[0-9]{2}"; "00:00:00") | fromdateiso8601 - 300)) | .metadata.name' | wc -l)
    if [[ $recent_deployments -gt 0 ]]; then
        log "INFO: Recent deployments detected, reducing chaos probability"
        return 1
    fi
    
    return 0
}

# Pod deletion chaos experiment
chaos_pod_deletion() {
    local target="$1"
    log "Executing pod deletion chaos on: $target"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$target" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod" ]]; then
        log "Deleting pod: $pod"
        kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=10 || true
        send_notification "Pod deletion chaos executed on $target ($pod)" "info"
        
        # Wait for recovery
        sleep 30
        
        # Verify recovery
        local recovered_pods=$(kubectl get pods -n "$NAMESPACE" -l app="$target" --field-selector=status.phase=Running --no-headers | wc -l)
        if [[ $recovered_pods -gt 0 ]]; then
            log "Pod deletion chaos recovery successful for $target"
        else
            log "WARNING: Pod deletion chaos recovery failed for $target"
            send_notification "Pod deletion chaos recovery failed for $target" "warning"
        fi
    else
        log "No target pod found for: $target"
    fi
}

# Network latency chaos experiment
chaos_network_latency() {
    local target="$1"
    local latency="${2:-100ms}"
    local duration="${3:-60s}"
    
    log "Executing network latency chaos on: $target (latency: $latency, duration: $duration)"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$target" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod" ]]; then
        # Add network delay using tc (traffic control)
        kubectl exec "$pod" -n "$NAMESPACE" -- \
            sh -c "tc qdisc add dev eth0 root netem delay $latency && sleep $duration && tc qdisc del dev eth0 root" || true
        
        send_notification "Network latency chaos executed on $target ($latency for $duration)" "info"
        log "Network latency chaos completed for $target"
    else
        log "No target pod found for: $target"
    fi
}

# CPU exhaustion chaos experiment
chaos_cpu_exhaustion() {
    local target="$1"
    local load="${2:-80}"
    local duration="${3:-60s}"
    
    log "Executing CPU exhaustion chaos on: $target (load: $load%, duration: $duration)"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$target" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod" ]]; then
        # Generate CPU load
        kubectl exec "$pod" -n "$NAMESPACE" -- \
            sh -c "dd if=/dev/zero of=/dev/null & pid=\$!; sleep $duration; kill \$pid 2>/dev/null || true" || true
        
        send_notification "CPU exhaustion chaos executed on $target ($load% for $duration)" "info"
        log "CPU exhaustion chaos completed for $target"
    else
        log "No target pod found for: $target"
    fi
}

# Memory pressure chaos experiment
chaos_memory_pressure() {
    local target="$1"
    local pressure="${2:-70}"
    local duration="${3:-60s}"
    
    log "Executing memory pressure chaos on: $target (pressure: $pressure%, duration: $duration)"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$target" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod" ]]; then
        # Allocate memory
        local memory_mb=$((pressure * 10))  # Rough estimation
        kubectl exec "$pod" -n "$NAMESPACE" -- \
            sh -c "dd if=/dev/zero of=/tmp/memory_test bs=1M count=$memory_mb & pid=\$!; sleep $duration; kill \$pid 2>/dev/null; rm -f /tmp/memory_test" || true
        
        send_notification "Memory pressure chaos executed on $target ($pressure% for $duration)" "info"
        log "Memory pressure chaos completed for $target"
    else
        log "No target pod found for: $target"
    fi
}

# DNS failure chaos experiment
chaos_dns_failure() {
    local target="$1"
    local duration="${2:-30s}"
    
    log "Executing DNS failure chaos on: $target (duration: $duration)"
    
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$target" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod" ]]; then
        # Break DNS resolution temporarily
        kubectl exec "$pod" -n "$NAMESPACE" -- \
            sh -c "echo '127.0.0.1 kube-dns.kube-system.svc.cluster.local' >> /etc/hosts && sleep $duration && sed -i '/kube-dns/d' /etc/hosts" || true
        
        send_notification "DNS failure chaos executed on $target ($duration)" "info"
        log "DNS failure chaos completed for $target"
    else
        log "No target pod found for: $target"
    fi
}

# Execute random chaos experiment
execute_random_chaos() {
    local experiments=("pod-deletion" "network-latency" "cpu-exhaustion" "memory-pressure" "dns-failure")
    local random_experiment=${experiments[$RANDOM % ${#experiments[@]}]}
    
    log "Selected random chaos experiment: $random_experiment"
    
    case "$random_experiment" in
        "pod-deletion")
            local targets=("frontend-secondary" "grafana" "prometheus")
            local target=${targets[$RANDOM % ${#targets[@]}]}
            chaos_pod_deletion "$target"
            ;;
        "network-latency")
            local targets=("frontend-secondary" "backend")
            local target=${targets[$RANDOM % ${#targets[@]}]}
            chaos_network_latency "$target" "100ms" "60s"
            ;;
        "cpu-exhaustion")
            local targets=("frontend-secondary" "grafana")
            local target=${targets[$RANDOM % ${#targets[@]}]}
            chaos_cpu_exhaustion "$target" "80" "60s"
            ;;
        "memory-pressure")
            local targets=("frontend-secondary" "prometheus")
            local target=${targets[$RANDOM % ${#targets[@]}]}
            chaos_memory_pressure "$target" "70" "60s"
            ;;
        "dns-failure")
            local targets=("frontend-secondary" "backend")
            local target=${targets[$RANDOM % ${#targets[@]}]}
            chaos_dns_failure "$target" "30s"
            ;;
    esac
}

# Main chaos orchestrator loop
main() {
    log "Chaos Engineering Orchestrator started"
    
    # Create chaos state directory
    mkdir -p "$CHAOS_STATE_DIR"
    
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
    
    # Main chaos loop
    while true; do
        # Check safety conditions
        if check_safety_conditions; then
            # Execute chaos with probability
            if [[ $((RANDOM % 100)) -lt 10 ]]; then  # 10% probability
                log "Executing chaos experiment"
                execute_random_chaos
            else
                log "Chaos experiment skipped (probability)"
            fi
        else
            log "Chaos experiment skipped (safety)"
        fi
        
        # Wait for next iteration
        sleep 300  # 5 minutes
    done
}

# Handle signals
trap 'log "Chaos orchestrator stopped"; exit 0' SIGTERM SIGINT

# Run main function
main "$@"
