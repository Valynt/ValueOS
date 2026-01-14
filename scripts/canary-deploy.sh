#!/usr/bin/env bash

# Canary deployment script for production
# Implements gradual traffic shifting with automated rollback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CANARY_STEPS=${CANARY_STEPS:-5}
CANARY_STEP_DURATION=${CANARY_STEP_DURATION:-300}  # 5 minutes
CANARY_INITIAL_WEIGHT=${CANARY_INITIAL_WEIGHT:-10}  # 10%
CANARY_MAX_WEIGHT=${CANARY_MAX_WEIGHT:-50}         # 50%
ERROR_RATE_THRESHOLD=${ERROR_RATE_THRESHOLD:-5}     # 5%
LATENCY_THRESHOLD=${LATENCY_THRESHOLD:-1000}         # 1000ms

# Logging functions
log_info() {
    echo -e "${BLUE}🐦 $1${NC}"
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

# Get current canary weight
get_canary_weight() {
    kubectl get service valueos-app -n production -o jsonpath='{.spec.selector.canary}' 2>/dev/null || echo "0"
}

# Set canary weight
set_canary_weight() {
    local weight="$1"
    log_info "Setting canary weight to ${weight}%"

    # Patch service to use canary selector
    kubectl patch service valueos-app -n production -p '{"spec":{"selector":{"version":"canary","weight":"'${weight}'"}}}' || \
    kubectl patch service valueos-app -n production -p '{"spec":{"selector":{"canary":"true","weight":"'${weight}'"}}}'
}

# Monitor canary deployment
monitor_canary() {
    local duration="$1"
    local weight="$2"

    log_info "Monitoring canary deployment for ${duration}s at ${weight}% traffic"

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))

    while [ $(date +%s) -lt $end_time ]; do
        # Check error rate
        local error_rate=$(get_error_rate)
        if [ "$error_rate" -gt "$ERROR_RATE_THRESHOLD" ]; then
            log_error "High error rate detected: ${error_rate}% (threshold: ${ERROR_RATE_THRESHOLD}%)"
            return 1
        fi

        # Check latency
        local latency=$(get_latency)
        if [ "$latency" -gt "$LATENCY_THRESHOLD" ]; then
            log_warning "High latency detected: ${latency}ms (threshold: ${LATENCY_THRESHOLD}ms)"
            # Continue monitoring but flag as warning
        fi

        sleep 30  # Check every 30 seconds
    done

    log_success "Canary monitoring passed for weight ${weight}%"
    return 0
}

# Get error rate from metrics
get_error_rate() {
    # Simplified metric collection - in production, use proper monitoring
    local error_rate=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name HTTPCode_Target_5XX_Count \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")

    echo "${error_rate:-0}"
}

# Get latency from metrics
get_latency() {
    # Simplified latency collection
    local latency=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name TargetResponseTime \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")

    echo "${latency:-0}"
}

# Rollback canary deployment
rollback_canary() {
    log_warning "Rolling back canary deployment..."

    # Switch back to stable version
    kubectl patch service valueos-app -n production -p '{"spec":{"selector":{"version":"stable"}}}' || \
    kubectl patch service valueos-app -n production -p '{"spec":{"selector":{"canary":"false"}}}'

    # Scale down canary deployment
    kubectl scale deployment valueos-app-canary -n production --replicas=0 || true

    log_success "Canary rollback completed"
}

# Promote canary to stable
promote_canary() {
    log_info "Promoting canary to stable..."

    # Update stable deployment
    kubectl set image deployment/valueos-app app="${IMAGE_DIGEST}" -n production --record

    # Wait for rollout
    kubectl rollout status deployment/valueos-app -n production --timeout=15m

    # Clean up canary
    kubectl scale deployment valueos-app-canary -n production --replicas=0 || true

    log_success "Canary promotion completed"
}

# Main canary deployment
deploy_canary() {
    local image_digest="$1"
    local namespace="${2:-production}"

    log_info "Starting canary deployment with image: $image_digest"

    # Create canary deployment if not exists
    kubectl get deployment valueos-app-canary -n "$namespace" || \
    kubectl create deployment valueos-app-canary -n "$namespace" --image="$image_digest" --replicas=1

    # Set canary label
    kubectl label deployment valueos-app-canary -n "$namespace" version=canary --overwrite

    # Gradual traffic shifting
    local step_increment=$(( (CANARY_MAX_WEIGHT - CANARY_INITIAL_WEIGHT) / CANARY_STEPS ))
    local current_weight=$CANARY_INITIAL_WEIGHT

    for step in $(seq 1 $CANARY_STEPS); do
        log_info "Canary step $step/$CANARY_STEPS"

        # Set traffic weight
        set_canary_weight "$current_weight"

        # Monitor for specified duration
        if ! monitor_canary "$CANARY_STEP_DURATION" "$current_weight"; then
            rollback_canary
            return 1
        fi

        # Increase weight for next step
        current_weight=$((current_weight + step_increment))
        if [ $current_weight -gt $CANARY_MAX_WEIGHT ]; then
            current_weight=$CANARY_MAX_WEIGHT
        fi
    done

    # Final promotion
    promote_canary
    return 0
}

# Main execution
main() {
    local image_digest="${1:-}"
    local namespace="${2:-production}"

    if [ -z "$image_digest" ]; then
        log_error "Image digest is required"
        echo "Usage: $0 <image_digest> [namespace]"
        exit 1
    fi

    # Export variables for sub-functions
    export IMAGE_DIGEST="$image_digest"
    export CANARY_STEPS CANARY_STEP_DURATION CANARY_INITIAL_WEIGHT CANARY_MAX_WEIGHT
    export ERROR_RATE_THRESHOLD LATENCY_THRESHOLD

    # Execute canary deployment
    if deploy_canary "$image_digest" "$namespace"; then
        log_success "Canary deployment completed successfully"
        exit 0
    else
        log_error "Canary deployment failed"
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
