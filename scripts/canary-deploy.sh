#!/usr/bin/env bash

# Enhanced Canary Deployment Script for Kubernetes
# Implements gradual traffic shifting with improved monitoring and rollback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Enhanced Configuration
CANARY_STEPS=${CANARY_STEPS:-5}
CANARY_STEP_DURATION=${CANARY_STEP_DURATION:-300}  # 5 minutes per step
CANARY_INITIAL_WEIGHT=${CANARY_INITIAL_WEIGHT:-10}  # 10%
CANARY_MAX_WEIGHT=${CANARY_MAX_WEIGHT:-50}         # 50%
ERROR_RATE_THRESHOLD=${ERROR_RATE_THRESHOLD:-5}     # 5%
LATENCY_THRESHOLD=${LATENCY_THRESHOLD:-1000}         # 1000ms
SUCCESS_RATE_THRESHOLD=${SUCCESS_RATE_THRESHOLD:-95} # 95%

# Service configuration
NAMESPACE="${NAMESPACE:-valuecanvas}"
SERVICE_NAME="${SERVICE_NAME:-backend-service}"
CANARY_DEPLOYMENT="${CANARY_DEPLOYMENT:-backend-canary}"

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

# Create canary deployment
create_canary_deployment() {
    local image="$1"
    local replicas="${2:-1}"

    log_info "Creating canary deployment with image: $image"

    # Create canary deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $CANARY_DEPLOYMENT
  namespace: $NAMESPACE
  labels:
    app: backend
    version: canary
    component: api
spec:
  replicas: $replicas
  selector:
    matchLabels:
      app: backend
      version: canary
  template:
    metadata:
      labels:
        app: backend
        version: canary
        component: api
    spec:
      containers:
      - name: backend
        image: $image
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8000"
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
EOF
}

# Get current traffic weights (simplified - would use Istio VirtualService in production)
get_traffic_weights() {
    # In a real implementation, this would query Istio or service mesh
    local canary_weight=$(kubectl get deployment "$CANARY_DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.template.metadata.annotations.traffic-weight}' 2>/dev/null || echo "0")
    echo "$canary_weight"
}

# Set traffic weight (simplified - would use Istio DestinationRule in production)
set_traffic_weight() {
    local weight="$1"
    log_info "Setting canary traffic weight to ${weight}%"

    # Annotate the canary deployment with traffic weight
    kubectl annotate deployment "$CANARY_DEPLOYMENT" -n "$NAMESPACE" traffic-weight="$weight" --overwrite

    # In production with service mesh, this would update VirtualService weights
    # For now, we'll use a simple label-based approach
    if [ "$weight" -gt 0 ]; then
        kubectl label service "$SERVICE_NAME" -n "$NAMESPACE" canary-weight="$weight" --overwrite
    else
        kubectl label service "$SERVICE_NAME" -n "$NAMESPACE" canary-weight- --overwrite
    fi
}

# Enhanced metrics collection
get_error_rate() {
    # Enhanced metrics collection with multiple data points
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

    # Also check application-level errors from logs
    local app_errors=$(kubectl logs -n "$NAMESPACE" -l version=canary --tail=1000 --since=5m 2>/dev/null | grep -c "ERROR\|FATAL" || echo "0")

    # Calculate combined error rate (simplified)
    local total_requests=$(kubectl logs -n "$NAMESPACE" -l version=canary --tail=10000 --since=5m 2>/dev/null | wc -l || echo "1")
    local app_error_rate=$(( app_errors * 100 / (total_requests > 0 ? total_requests : 1) ))

    echo $(( error_rate + app_error_rate ))
}

get_success_rate() {
    # Get success rate from load balancer metrics
    local success_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name HTTPCode_Target_2XX_Count \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")

    local total_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name RequestCount \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "1")

    if [ "$total_count" -gt 0 ]; then
        echo $(( success_count * 100 / total_count ))
    else
        echo "100"
    fi
}

get_latency() {
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

    # Convert to milliseconds
    awk "BEGIN {print $latency * 1000}"
}

# Enhanced monitoring with multiple KPIs
monitor_canary() {
    local duration="$1"
    local weight="$2"

    log_info "Enhanced monitoring canary deployment for ${duration}s at ${weight}% traffic"

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local alerts=0

    while [ $(date +%s) -lt $end_time ]; do
        # Check error rate
        local error_rate=$(get_error_rate)
        if [ "$error_rate" -gt "$ERROR_RATE_THRESHOLD" ]; then
            log_error "High error rate detected: ${error_rate}% (threshold: ${ERROR_RATE_THRESHOLD}%)"
            ((alerts++))
        fi

        # Check success rate
        local success_rate=$(get_success_rate)
        if [ "$success_rate" -lt "$SUCCESS_RATE_THRESHOLD" ]; then
            log_error "Low success rate detected: ${success_rate}% (threshold: ${SUCCESS_RATE_THRESHOLD}%)"
            ((alerts++))
        fi

        # Check latency
        local latency=$(get_latency)
        if [ "$latency" -gt "$LATENCY_THRESHOLD" ]; then
            log_warning "High latency detected: ${latency}ms (threshold: ${LATENCY_THRESHOLD}ms)"
        fi

        # If too many alerts, fail fast
        if [ $alerts -gt 3 ]; then
            log_error "Too many alerts detected, failing canary"
            return 1
        fi

        sleep 30
    done

    # Final validation
    local final_error_rate=$(get_error_rate)
    local final_success_rate=$(get_success_rate)

    if [ "$final_error_rate" -le "$ERROR_RATE_THRESHOLD" ] && [ "$final_success_rate" -ge "$SUCCESS_RATE_THRESHOLD" ]; then
        log_success "Canary monitoring passed for weight ${weight}%"
        return 0
    else
        log_error "Canary monitoring failed - Error rate: ${final_error_rate}%, Success rate: ${final_success_rate}%"
        return 1
    fi
}

# Enhanced rollback with analysis
rollback_canary() {
    log_warning "Rolling back canary deployment with analysis..."

    # Collect failure metrics for analysis
    local final_error_rate=$(get_error_rate)
    local final_success_rate=$(get_success_rate)
    local final_latency=$(get_latency)

    log_info "Failure analysis:"
    log_info "  Final error rate: ${final_error_rate}%"
    log_info "  Final success rate: ${final_success_rate}%"
    log_info "  Final latency: ${final_latency}ms"

    # Switch all traffic back to stable
    set_traffic_weight 0

    # Scale down canary
    kubectl scale deployment "$CANARY_DEPLOYMENT" -n "$NAMESPACE" --replicas=0 || true

    log_success "Canary rollback completed"
}

# Promote canary with validation
promote_canary() {
    local image_digest="$1"
    log_info "Promoting canary to stable with image: $image_digest"

    # Update stable deployment
    kubectl set image deployment/backend backend="$image_digest" -n "$NAMESPACE" --record

    # Wait for rollout
    kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=15m

    # Switch all traffic to stable
    set_traffic_weight 0

    # Clean up canary
    kubectl delete deployment "$CANARY_DEPLOYMENT" -n "$NAMESPACE" || true

    log_success "Canary promotion completed successfully"
}

# Main enhanced canary deployment
deploy_enhanced_canary() {
    local image_digest="$1"
    local namespace="${2:-$NAMESPACE}"

    export NAMESPACE="$namespace"

    log_info "Starting enhanced canary deployment with image: $image_digest"

    # Create canary deployment
    create_canary_deployment "$image_digest"

    # Gradual traffic shifting with enhanced monitoring
    local step_increment=$(( (CANARY_MAX_WEIGHT - CANARY_INITIAL_WEIGHT) / CANARY_STEPS ))
    local current_weight=$CANARY_INITIAL_WEIGHT

    for step in $(seq 1 $CANARY_STEPS); do
        log_info "Canary step $step/$CANARY_STEPS at ${current_weight}% traffic"

        # Set traffic weight
        set_traffic_weight "$current_weight"

        # Enhanced monitoring
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
    promote_canary "$image_digest"
    return 0
}

# Main execution
main() {
    local image_digest="${1:-}"
    local namespace="${2:-$NAMESPACE}"

    if [ -z "$image_digest" ]; then
        log_error "Image digest is required"
        echo "Usage: $0 <image_digest> [namespace]"
        exit 1
    fi

    export IMAGE_DIGEST="$image_digest"
    export NAMESPACE="$namespace"

    if deploy_enhanced_canary "$image_digest" "$namespace"; then
        log_success "Enhanced canary deployment completed successfully"
        exit 0
    else
        log_error "Enhanced canary deployment failed"
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
