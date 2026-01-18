#!/usr/bin/env bash

# ValueOS Agent-Fabric Production Deployment Script
# Deploys the agent-fabric system to production with comprehensive checks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}📊 $1${NC}"
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

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="valueos"
ENVIRONMENT="${1:-production}"
REGION="${2:-us-west-2}"
CLUSTER="${3:-valueos-prod}"

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check docker
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Build and push Docker image
build_and_push() {
    log_info "Building and pushing Docker image..."

    cd "$REPO_ROOT"

    # Build image
    docker build -t valueos/agent-fabric:latest \
        -t valueos/agent-fabric:"$(git rev-parse --short HEAD) \
        -f infra/docker/agent-fabric/Dockerfile .

    # Push to registry
    docker push valueos/agent-fabric:latest
    docker push valueos/agent-fabric:"$(git rev-parse --short HEAD)

    log_success "Docker image built and pushed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Create namespace if not exists
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Apply configurations
    kubectl apply -f infra/k8s/agent-fabric/namespace.yaml
    kubectl apply -f infra/k8s/agent-fabric/configmap.yaml
    kubectl apply -f infra/k8s/agent-fabric/secret.yaml

    # Deploy services
    kubectl apply -f infra/k8s/agent-fabric/deployment.yaml
    kubectl apply -f infra/k8s/agent-fabric/service.yaml
    kubectl apply -f infra/k8s/agent-fabric/ingress.yaml

    # Wait for deployment
    kubectl rollout status deployment/agent-fabric -n "$NAMESPACE" --timeout=300s

    log_success "Kubernetes deployment completed"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."

    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=agent-fabric -n "$NAMESPACE" --timeout=300s

    # Check service health
    for i in {1..30}; do
        if kubectl exec -n "$NAMESPACE" deployment/agent-fabric -- curl -f http://localhost:3000/health; then
            log_success "Health check passed"
            return 0
        fi
        log_warning "Health check attempt $i/30 failed, retrying..."
        sleep 10
    done

    log_error "Health check failed after 30 attempts"
    return 1
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."

    # Test agent endpoints
    kubectl exec -n "$NAMESPACE" deployment/agent-fabric -- npm run test:integration

    # Test telemetry
    kubectl exec -n "$NAMESPACE" deployment/agent-fabric -- npm run test:telemetry

    # Test security
    kubectl exec -n "$NAMESPACE" deployment/agent-fabric -- npm run test:security

    log_success "Integration tests passed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."

    # Apply monitoring configurations
    kubectl apply -f infra/k8s/monitoring/prometheus-config.yaml
    kubectl apply -f infra/k8s/monitoring/grafana-dashboard.yaml

    # Create service monitors
    kubectl apply -f infra/k8s/monitoring/servicemonitor.yaml

    log_success "Monitoring setup completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    # Check pod status
    kubectl get pods -n "$NAMESPACE" -l app=agent-fabric

    # Check service status
    kubectl get services -n "$NAMESPACE"

    # Check ingress status
    kubectl get ingress -n "$NAMESPACE"

    # Get deployment URL
    INGRESS_URL=$(kubectl get ingress agent-fabric -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}')

    log_success "Deployment verified"
    log_info "Application available at: https://$INGRESS_URL"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."

    kubectl rollout undo deployment/agent-fabric -n "$NAMESPACE"
    kubectl rollout status deployment/agent-fabric -n "$NAMESPACE" --timeout=300s

    log_success "Rollback completed"
}

# Main deployment function
main() {
    log_info "Starting ValueOS Agent-Fabric deployment to $ENVIRONMENT"

    # Check if rollback requested
    if [[ "${1:-}" == "rollback" ]]; then
        rollback
        exit 0
    fi

    # Run deployment steps
    check_prerequisites
    build_and_push
    deploy_kubernetes

    # Run health checks
    if ! run_health_checks; then
        log_error "Health checks failed, rolling back..."
        rollback
        exit 1
    fi

    # Run integration tests
    if ! run_integration_tests; then
        log_error "Integration tests failed, rolling back..."
        rollback
        exit 1
    fi

    # Setup monitoring
    setup_monitoring

    # Verify deployment
    verify_deployment

    log_success "🎉 Agent-Fabric deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    log_info "Cluster: $CLUSTER"
}

# Handle script arguments
case "${1:-}" in
    "rollback")
        rollback
        ;;
    "health")
        run_health_checks
        ;;
    "test")
        run_integration_tests
        ;;
    "monitor")
        setup_monitoring
        ;;
    *)
        main "$@"
        ;;
esac
