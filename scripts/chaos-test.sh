#!/usr/bin/env bash

# Chaos testing script for staging environment
# Simulates failures to test system resilience

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="staging"
CHAOS_DURATION=${CHAOS_DURATION:-300}  # 5 minutes
CHAOS_EXPERIMENTS=${CHAOS_EXPERIMENTS:-"pod-delete network-latency cpu-hog memory-hog"}

# Logging functions
log_info() {
    echo -e "${BLUE}🌀 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl > /dev/null 2>&1; then
        log_error "kubectl not found"
        return 1
    fi

    # Check cluster access
    if ! kubectl cluster-info > /dev/null 2>&1; then
        log_error "Cannot access cluster"
        return 1
    fi

    # Check namespace
    if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
        log_error "Namespace $NAMESPACE not found"
        return 1
    fi

    log_success "Prerequisites check passed"
}

# Get baseline metrics
get_baseline_metrics() {
    log_info "Collecting baseline metrics..."

    local baseline_file="/tmp/chaos-baseline-$(date +%s).json"

    # Get pod counts
    local pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)

    # Get service endpoints
    local endpoints=$(kubectl get endpoints -n "$NAMESPACE" -o json)

    # Get response times
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' https://staging.valuecanvas.app/health 2>/dev/null || echo "0")

    cat > "$baseline_file" <<EOF
{
    "timestamp": $(date +%s),
    "pod_count": $pod_count,
    "response_time": $response_time,
    "endpoints": $endpoints
}
EOF

    echo "$baseline_file"
}

# Pod deletion experiment
experiment_pod_delete() {
    log_info "Starting pod deletion experiment..."

    local deployment="valueos-app"
    local original_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')

    # Delete 50% of pods
    local delete_count=$((original_replicas / 2))
    log_info "Deleting $delete_count pods from $deployment..."

    # Scale down temporarily
    kubectl scale deployment "$deployment" -n "$NAMESPACE" --replicas="$delete_count"

    # Wait for scaling
    kubectl rollout status deployment "$deployment" -n "$NAMESPACE" --timeout=60s

    # Monitor for specified duration
    log_info "Monitoring system for $CHAOS_DURATION seconds..."
    sleep "$CHAOS_DURATION"

    # Restore original replicas
    log_info "Restoring original replica count: $original_replicas"
    kubectl scale deployment "$deployment" -n "$NAMESPACE" --replicas="$original_replicas"

    # Wait for recovery
    kubectl rollout status deployment "$deployment" -n "$NAMESPACE" --timeout=120s

    log_success "Pod deletion experiment completed"
}

# Network latency experiment
experiment_network_latency() {
    log_info "Starting network latency experiment..."

    # Install chaos-mesh if not available (simplified version)
    if ! kubectl get pods -n chaos-mesh > /dev/null 2>&1; then
        log_warning "Chaos Mesh not found, using tc for network delay simulation"

        # Get a pod to inject latency
        local pod=$(kubectl get pods -n "$NAMESPACE" -l app=valueos-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

        if [ -n "$pod" ]; then
            log_info "Injecting 100ms latency into pod: $pod"

            # Add network delay using tc (requires privileged container)
            kubectl exec -n "$NAMESPACE" "$pod" -- tc qdisc add dev eth0 root netem delay 100ms 2>/dev/null || \
            log_warning "Could not inject network delay (requires privileged container)"

            sleep "$CHAOS_DURATION"

            # Remove delay
            kubectl exec -n "$NAMESPACE" "$pod" -- tc qdisc del dev eth0 root 2>/dev/null || true
        fi
    else
        log_info "Using Chaos Mesh for network latency injection"
        # Chaos Mesh implementation would go here
        sleep "$CHAOS_DURATION"
    fi

    log_success "Network latency experiment completed"
}

# CPU hog experiment
experiment_cpu_hog() {
    log_info "Starting CPU hog experiment..."

    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=valueos-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -n "$pod" ]; then
        log_info "Injecting CPU load into pod: $pod"

        # Run CPU stress test
        kubectl exec -n "$NAMESPACE" "$pod" -- sh -c 'dd if=/dev/zero of=/dev/null &' 2>/dev/null || \
        kubectl exec -n "$NAMESPACE" "$pod" -- sh -c 'yes > /dev/null &' 2>/dev/null || \
        log_warning "Could not inject CPU load"

        sleep "$CHAOS_DURATION"

        # Kill stress processes
        kubectl exec -n "$NAMESPACE" "$pod" -- pkill -f "dd if=/dev/zero" 2>/dev/null || true
        kubectl exec -n "$NAMESPACE" "$pod" -- pkill yes 2>/dev/null || true
    fi

    log_success "CPU hog experiment completed"
}

# Memory hog experiment
experiment_memory_hog() {
    log_info "Starting memory hog experiment..."

    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=valueos-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -n "$pod" ]; then
        log_info "Injecting memory pressure into pod: $pod"

        # Allocate memory (simplified version)
        kubectl exec -n "$NAMESPACE" "$pod" -- sh -c 'dd if=/dev/zero of=/tmp/memhog bs=1M count=100 &' 2>/dev/null || \
        log_warning "Could not allocate memory"

        sleep "$CHAOS_DURATION"

        # Clean up
        kubectl exec -n "$NAMESPACE" "$pod" -- rm -f /tmp/memhog 2>/dev/null || true
    fi

    log_success "Memory hog experiment completed"
}

# Monitor system health during chaos
monitor_health() {
    local baseline_file="$1"
    local experiment="$2"

    log_info "Monitoring system health during $experiment experiment..."

    # Check pod status
    local failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed --no-headers | wc -l)

    # Check service availability
    local health_check=$(curl -f -s https://staging.valuecanvas.app/health > /dev/null 2>&1 && echo "healthy" || echo "unhealthy")

    # Check response time
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' https://staging.valuecanvas.app/health 2>/dev/null || echo "0")

    # Log results
    log_info "Health check results:"
    log_info "  Failed pods: $failed_pods"
    log_info "  Service status: $health_check"
    log_info "  Response time: ${response_time}s"

    # Determine if system recovered
    if [ "$health_check" = "healthy" ] && [ "$failed_pods" -eq 0 ]; then
        log_success "System recovered successfully from $experiment experiment"
        return 0
    else
        log_warning "System showing signs of stress after $experiment experiment"
        return 1
    fi
}

# Generate chaos report
generate_report() {
    local baseline_file="$1"
    local output_file="${2:-chaos-report-$(date +%Y%m%d-%H%M%S).json}"

    log_info "Generating chaos report: $output_file"

    # Get final metrics
    local final_response_time=$(curl -o /dev/null -s -w '%{time_total}' https://staging.valuecanvas.app/health 2>/dev/null || echo "0")
    local final_pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)

    cat > "$output_file" <<EOF
{
    "chaos_test": {
        "timestamp": $(date +%s),
        "namespace": "$NAMESPACE",
        "duration": $CHAOS_DURATION,
        "experiments": [$CHAOS_EXPERIMENTS],
        "baseline": $(cat "$baseline_file"),
        "final_metrics": {
            "pod_count": $final_pod_count,
            "response_time": $final_response_time
        },
        "status": "completed"
    }
}
EOF

    log_success "Chaos report generated: $output_file"
}

# Main chaos execution
run_chaos_tests() {
    log_info "Starting chaos tests in namespace: $NAMESPACE"

    # Check prerequisites
    check_prerequisites || exit 1

    # Get baseline metrics
    local baseline_file=$(get_baseline_metrics)

    # Run experiments
    for experiment in $(echo "$CHAOS_EXPERIMENTS" | tr ',' ' '); do
        log_info "Running experiment: $experiment"

        case "$experiment" in
            "pod-delete")
                experiment_pod_delete
                ;;
            "network-latency")
                experiment_network_latency
                ;;
            "cpu-hog")
                experiment_cpu_hog
                ;;
            "memory-hog")
                experiment_memory_hog
                ;;
            *)
                log_warning "Unknown experiment: $experiment"
                continue
                ;;
        esac

        # Monitor health after each experiment
        monitor_health "$baseline_file" "$experiment"

        # Wait between experiments
        log_info "Waiting 60 seconds before next experiment..."
        sleep 60
    done

    # Generate report
    generate_report "$baseline_file"

    # Cleanup
    rm -f "$baseline_file"

    log_success "Chaos tests completed successfully"
}

# Main execution
main() {
    local command="${1:-run}"

    case "$command" in
        "run")
            run_chaos_tests
            ;;
        "check")
            check_prerequisites
            ;;
        "baseline")
            get_baseline_metrics
            ;;
        "help"|*)
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  run       Run chaos tests"
            echo "  check     Check prerequisites"
            echo "  baseline  Get baseline metrics"
            echo ""
            echo "Environment variables:"
            echo "  CHAOS_DURATION       Duration of each experiment (default: 300s)"
            echo "  CHAOS_EXPERIMENTS    Comma-separated list of experiments"
            echo "                       (default: pod-delete,network-latency,cpu-hog,memory-hog)"
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
