#!/bin/bash

# Blue-Green Deployment Script for Kubernetes
# Usage: ./blue-green-deploy.sh <image_tag> [namespace]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_TAG="${1:-latest}"
NAMESPACE="${2:-valuecanvas}"
DEPLOYMENT_NAME="backend"
SERVICE_NAME="backend"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
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

# Get current active version
get_active_version() {
    kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue"
}

# Get inactive version
get_inactive_version() {
    active_version=$(get_active_version)
    if [ "$active_version" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Scale deployment
scale_deployment() {
    local version="$1"
    local replicas="$2"
    log_info "Scaling $version deployment to $replicas replicas"
    kubectl scale deployment "$DEPLOYMENT_NAME-$version" -n "$NAMESPACE" --replicas="$replicas"
}

# Wait for deployment rollout
wait_for_rollout() {
    local version="$1"
    local timeout="${2:-300}"
    log_info "Waiting for $version deployment rollout (timeout: ${timeout}s)"
    kubectl rollout status deployment/"$DEPLOYMENT_NAME-$version" -n "$NAMESPACE" --timeout="${timeout}s"
}

# Update deployment image
update_deployment_image() {
    local version="$1"
    local image_tag="$2"
    log_info "Updating $version deployment image to: $image_tag"
    kubectl set image deployment/"$DEPLOYMENT_NAME-$version" backend="$image_tag" -n "$NAMESPACE"
}

# Switch service selector
switch_service() {
    local target_version="$1"
    log_info "Switching service selector to version: $target_version"
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"app\":\"backend\",\"version\":\"$target_version\"}}}"
}

# Health check
health_check() {
    local timeout="${1:-60}"
    log_info "Performing health check (timeout: ${timeout}s)"
    ./scripts/health-check.sh "http://$SERVICE_NAME.$NAMESPACE.svc.cluster.local:8000/health" "$timeout" 5
}

# Rollback function
rollback() {
    local from_version="$1"
    local to_version="$2"
    log_warning "Rolling back from $from_version to $to_version"
    switch_service "$to_version"
    scale_deployment "$from_version" 0
    log_success "Rollback completed"
}

# Main blue-green deployment
deploy_blue_green() {
    local image_tag="$1"
    local namespace="$2"

    log_info "Starting blue-green deployment"
    log_info "Image: $image_tag, Namespace: $namespace"

    # Get versions
    active_version=$(get_active_version)
    inactive_version=$(get_inactive_version)

    log_info "Active version: $active_version"
    log_info "Inactive version: $inactive_version"

    # Step 1: Scale up inactive version
    log_info "Step 1: Preparing inactive version ($inactive_version)"
    update_deployment_image "$inactive_version" "$image_tag"
    scale_deployment "$inactive_version" 2

    # Step 2: Wait for rollout
    log_info "Step 2: Waiting for deployment rollout"
    if ! wait_for_rollout "$inactive_version"; then
        log_error "Deployment rollout failed"
        scale_deployment "$inactive_version" 0
        exit 1
    fi

    # Step 3: Health check
    log_info "Step 3: Performing health checks"
    if ! health_check 120; then
        log_error "Health check failed"
        scale_deployment "$inactive_version" 0
        exit 1
    fi

    # Step 4: Switch traffic
    log_info "Step 4: Switching traffic to $inactive_version"
    switch_service "$inactive_version"

    # Step 5: Scale down old version
    log_info "Step 5: Scaling down $active_version"
    scale_deployment "$active_version" 0

    log_success "Blue-green deployment completed successfully"
    log_info "Active version is now: $inactive_version"
}

# Main execution
main() {
    if [ -z "$IMAGE_TAG" ]; then
        log_error "Image tag is required"
        echo "Usage: $0 <image_tag> [namespace]"
        exit 1
    fi

    deploy_blue_green "$IMAGE_TAG" "$NAMESPACE"
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
