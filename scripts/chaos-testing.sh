#!/bin/bash

# Chaos Engineering Testing Script
# Simulates failure scenarios to test system resilience

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-valuecanvas}"
CHAOS_DURATION="${CHAOS_DURATION:-60}"  # Duration in seconds
CHAOS_EXPERIMENTS="${CHAOS_EXPERIMENTS:-pod-kill,network-delay,node-cpu-hog}"

# Chaos experiment tracking
EXPERIMENTS_RUN=()
EXPERIMENTS_PASSED=()
EXPERIMENTS_FAILED=()

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

log_chaos() {
    echo -e "${PURPLE}🎭 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking chaos engineering prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if chaos-mesh or litmus is installed
    if ! kubectl get crd chaosengines.chaos-mesh.org &>/dev/null && ! kubectl get crd chaosengines.litmuschaos.io &>/dev/null; then
        log_warning "Chaos engineering framework not detected"
        log_info "Installing Chaos Mesh..."

        # Install Chaos Mesh (lightweight version for testing)
        kubectl create ns chaos-mesh --dry-run=client -o yaml | kubectl apply -f -
        kubectl apply -f https://mirrors.chaos-mesh.org/latest/crd.yaml
        kubectl apply -f https://mirrors.chaos-mesh.org/latest/chaos-mesh.yaml

        # Wait for chaos mesh to be ready
        log_info "Waiting for Chaos Mesh to be ready..."
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=chaos-mesh -n chaos-mesh --timeout=300s
    fi

    log_success "Prerequisites check passed"
}

# Pod Kill Chaos Experiment
experiment_pod_kill() {
    local experiment_name="pod-kill-$(date +%s)"
    log_chaos "Starting Pod Kill experiment: $experiment_name"

    EXPERIMENTS_RUN+=("$experiment_name")

    # Create chaos experiment
    cat <<EOF | kubectl apply -f -
apiVersion: chaos-mesh.org/v1alpha1
kind: ChaosExperiment
metadata:
  name: $experiment_name
  namespace: $NAMESPACE
spec:
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: backend
  mode: one
  action: pod-kill
  duration: ${CHAOS_DURATION}s
  scheduler:
    cron: "@every 30s"
EOF

    # Wait for experiment to complete
    sleep $((CHAOS_DURATION + 10))

    # Check system health after chaos
    if check_system_health; then
        log_success "Pod Kill experiment passed"
        EXPERIMENTS_PASSED+=("$experiment_name")
    else
        log_error "Pod Kill experiment failed - system unhealthy"
        EXPERIMENTS_FAILED+=("$experiment_name")
    fi

    # Cleanup
    kubectl delete chaosexperiment "$experiment_name" -n "$NAMESPACE" --ignore-not-found=true
}

# Network Delay Chaos Experiment
experiment_network_delay() {
    local experiment_name="network-delay-$(date +%s)"
    log_chaos "Starting Network Delay experiment: $experiment_name"

    EXPERIMENTS_RUN+=("$experiment_name")

    # Create network chaos
    cat <<EOF | kubectl apply -f -
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: $experiment_name
  namespace: $NAMESPACE
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: backend
  delay:
    latency: 1000ms
    jitter: 200ms
  duration: ${CHAOS_DURATION}s
EOF

    # Wait for experiment to complete
    sleep $((CHAOS_DURATION + 10))

    # Check system health after chaos
    if check_system_health; then
        log_success "Network Delay experiment passed"
        EXPERIMENTS_PASSED+=("$experiment_name")
    else
        log_error "Network Delay experiment failed - system unhealthy"
        EXPERIMENTS_FAILED+=("$experiment_name")
    fi

    # Cleanup
    kubectl delete networkchaos "$experiment_name" -n "$NAMESPACE" --ignore-not-found=true
}

# CPU Hog Chaos Experiment
experiment_cpu_hog() {
    local experiment_name="cpu-hog-$(date +%s)"
    log_chaos "Starting CPU Hog experiment: $experiment_name"

    EXPERIMENTS_RUN+=("$experiment_name")

    # Create CPU stress
    cat <<EOF | kubectl apply -f -
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: $experiment_name
  namespace: $NAMESPACE
spec:
  mode: one
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: backend
  stressors:
    cpu:
      workers: 2
      load: 80
  duration: ${CHAOS_DURATION}s
EOF

    # Wait for experiment to complete
    sleep $((CHAOS_DURATION + 10))

    # Check system health after chaos
    if check_system_health; then
        log_success "CPU Hog experiment passed"
        EXPERIMENTS_PASSED+=("$experiment_name")
    else
        log_error "CPU Hog experiment failed - system unhealthy"
        EXPERIMENTS_FAILED+=("$experiment_name")
    fi

    # Cleanup
    kubectl delete stresschaos "$experiment_name" -n "$NAMESPACE" --ignore-not-found=true
}

# Memory Hog Chaos Experiment
experiment_memory_hog() {
    local experiment_name="memory-hog-$(date +%s)"
    log_chaos "Starting Memory Hog experiment: $experiment_name"

    EXPERIMENTS_RUN+=("$experiment_name")

    # Create memory stress
    cat <<EOF | kubectl apply -f -
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: $experiment_name
  namespace: $NAMESPACE
spec:
  mode: one
  selector:
    namespaces:
      - $NAMESPACE
    labelSelectors:
      app: backend
  stressors:
    memory:
      workers: 2
      size: 256MB
  duration: ${CHAOS_DURATION}s
EOF

    # Wait for experiment to complete
    sleep $((CHAOS_DURATION + 10))

    # Check system health after chaos
    if check_system_health; then
        log_success "Memory Hog experiment passed"
        EXPERIMENTS_PASSED+=("$experiment_name")
    else
        log_error "Memory Hog experiment failed - system unhealthy"
        EXPERIMENTS_FAILED+=("$experiment_name")
    fi

    # Cleanup
    kubectl delete stresschaos "$experiment_name" -n "$NAMESPACE" --ignore-not-found=true
}

# Check system health after chaos
check_system_health() {
    log_info "Checking system health..."

    # Check if backend pods are ready
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o "True" | wc -l)
    local total_pods=$(kubectl get pods -n "$NAMESPACE" -l app=backend --no-headers | wc -l)

    if [ "$ready_pods" -lt "$total_pods" ]; then
        log_error "Not all backend pods are ready: $ready_pods/$total_pods"
        return 1
    fi

    # Quick health check via service
    if ! kubectl run health-check-test --image=curlimages/curl --rm -i --restart=Never -- curl -f --max-time 10 "http://backend-service.$NAMESPACE.svc.cluster.local:8000/health" >/dev/null 2>&1; then
        log_error "Health check failed"
        return 1
    fi

    log_success "System health check passed"
    return 0
}

# Run chaos experiments
run_chaos_experiments() {
    local experiments="$1"

    log_info "Running chaos experiments: $experiments"

    IFS=',' read -ra EXPERIMENT_ARRAY <<< "$experiments"

    for experiment in "${EXPERIMENT_ARRAY[@]}"; do
        case $experiment in
            pod-kill)
                experiment_pod_kill
                ;;
            network-delay)
                experiment_network_delay
                ;;
            cpu-hog)
                experiment_cpu_hog
                ;;
            memory-hog)
                experiment_memory_hog
                ;;
            *)
                log_warning "Unknown experiment: $experiment"
                ;;
        esac

        # Brief pause between experiments
        sleep 5
    done
}

# Generate chaos testing report
generate_chaos_report() {
    local report_file="chaos-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "namespace": "$NAMESPACE",
  "chaos_duration": ${CHAOS_DURATION},
  "experiments_run": ${#EXPERIMENTS_RUN[@]},
  "experiments_passed": ${#EXPERIMENTS_PASSED[@]},
  "experiments_failed": ${#EXPERIMENTS_FAILED[@]},
  "experiments": {
    "run": $(printf '%s\n' "${EXPERIMENTS_RUN[@]}" | jq -R . | jq -s .),
    "passed": $(printf '%s\n' "${EXPERIMENTS_PASSED[@]}" | jq -R . | jq -s .),
    "failed": $(printf '%s\n' "${EXPERIMENTS_FAILED[@]}" | jq -R . | jq -s .)
  },
  "configuration": {
    "chaos_experiments": "$CHAOS_EXPERIMENTS"
  }
}
EOF

    log_info "Chaos testing report saved to: $report_file"
}

# Main chaos testing function
run_chaos_testing() {
    log_chaos "🎭 Starting Chaos Engineering Testing"
    log_info "Configuration:"
    log_info "  Namespace: $NAMESPACE"
    log_info "  Duration per experiment: ${CHAOS_DURATION}s"
    log_info "  Experiments: $CHAOS_EXPERIMENTS"

    local start_time=$(date +%s)

    # Setup
    check_prerequisites

    # Run experiments
    run_chaos_experiments "$CHAOS_EXPERIMENTS"

    # Generate report
    generate_chaos_report

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Summary
    echo ""
    log_chaos "Chaos Testing Summary:"
    echo "  Total experiments: ${#EXPERIMENTS_RUN[@]}"
    echo "  Passed: ${#EXPERIMENTS_PASSED[@]}"
    echo "  Failed: ${#EXPERIMENTS_FAILED[@]}"
    echo "  Duration: ${duration}s"

    if [ ${#EXPERIMENTS_FAILED[@]} -eq 0 ]; then
        log_success "🎉 All chaos experiments passed! System is resilient."
        return 0
    else
        log_error "💥 ${#EXPERIMENTS_FAILED[@]} chaos experiments failed!"
        echo "Failed experiments: ${EXPERIMENTS_FAILED[*]}"
        return 1
    fi
}

# Main execution
main() {
    local command="${1:-test}"

    case "$command" in
        test)
            run_chaos_testing
            ;;
        pod-kill)
            check_prerequisites
            experiment_pod_kill
            ;;
        network-delay)
            check_prerequisites
            experiment_network_delay
            ;;
        cpu-hog)
            check_prerequisites
            experiment_cpu_hog
            ;;
        memory-hog)
            check_prerequisites
            experiment_memory_hog
            ;;
        *)
            echo "Usage: $0 [test|pod-kill|network-delay|cpu-hog|memory-hog]"
            echo "Commands:"
            echo "  test          - Run all chaos experiments (default)"
            echo "  pod-kill      - Run pod kill experiment only"
            echo "  network-delay - Run network delay experiment only"
            echo "  cpu-hog       - Run CPU hog experiment only"
            echo "  memory-hog    - Run memory hog experiment only"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
