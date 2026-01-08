#!/bin/bash

###############################################################################
# Production Rollback Script
# 
# Usage: ./rollback-production.sh [OPTIONS]
# 
# Options:
#   --to-version VERSION     Rollback to specific version/tag
#   --previous               Rollback to previous deployment (default)
#   --service SERVICE        Rollback specific service only
#   --confirm                Skip confirmation prompt
#   --dry-run                Show what would be rolled back without executing
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-valuecanvas}"
DRY_RUN=false
SKIP_CONFIRM=false
TARGET_VERSION=""
SERVICE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --to-version)
      TARGET_VERSION="$2"
      shift 2
      ;;
    --previous)
      TARGET_VERSION="previous"
      shift
      ;;
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --confirm)
      SKIP_CONFIRM=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
  log_info "Checking prerequisites..."
  
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
  fi
  
  if ! kubectl cluster-info &> /dev/null; then
    log_error "Cannot connect to Kubernetes cluster"
    exit 1
  fi
  
  log_info "Prerequisites check passed"
}

get_deployments() {
  if [[ -n "$SERVICE" ]]; then
    echo "$SERVICE"
  else
    kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}'
  fi
}

get_current_revision() {
  local deployment=$1
  kubectl rollout history deployment/"$deployment" -n "$NAMESPACE" --revision=0 | tail -n 1 | awk '{print $1}'
}

get_previous_revision() {
  local deployment=$1
  local current_rev
  current_rev=$(get_current_revision "$deployment")
  echo $((current_rev - 1))
}

show_rollback_plan() {
  log_info "=== ROLLBACK PLAN ==="
  echo ""
  
  local deployments
  deployments=$(get_deployments)
  
  for deployment in $deployments; do
    local current_rev
    local target_rev
    current_rev=$(get_current_revision "$deployment")
    
    if [[ "$TARGET_VERSION" == "previous" ]] || [[ -z "$TARGET_VERSION" ]]; then
      target_rev=$(get_previous_revision "$deployment")
    else
      target_rev="$TARGET_VERSION"
    fi
    
    echo "Deployment: $deployment"
    echo "  Current Revision: $current_rev"
    echo "  Target Revision:  $target_rev"
    echo ""
  done
}

confirm_rollback() {
  if [[ "$SKIP_CONFIRM" == true ]]; then
    return 0
  fi
  
  echo ""
  log_warn "⚠️  You are about to rollback production deployments!"
  echo ""
  read -p "Are you sure you want to proceed? (yes/no): " -r
  echo
  
  if [[ ! $REPLY =~ ^yes$ ]]; then
    log_info "Rollback cancelled"
    exit 0
  fi
}

execute_rollback() {
  local deployment=$1
  local target_rev=$2
  
  log_info "Rolling back deployment: $deployment to revision $target_rev"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would execute: kubectl rollout undo deployment/$deployment -n $NAMESPACE --to-revision=$target_rev"
    return 0
  fi
  
  if kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE" --to-revision="$target_rev"; then
    log_info "✓ Initiated rollback for $deployment"
    
    # Wait for rollout to complete
    if kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=5m; then
      log_info "✓ Rollback completed successfully for $deployment"
    else
      log_error "✗ Rollback timed out or failed for $deployment"
      return 1
    fi
  else
    log_error "✗ Failed to initiate rollback for $deployment"
    return 1
  fi
}

verify_rollback() {
  log_info "Verifying rollback..."
  
  local deployments
  deployments=$(get_deployments)
  
  for deployment in $deployments; do
    local ready_replicas
    ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
    local desired_replicas
    desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    
    if [[ "$ready_replicas" -eq "$desired_replicas" ]]; then
      log_info "✓ $deployment: $ready_replicas/$desired_replicas replicas ready"
    else
      log_error "✗ $deployment: Only $ready_replicas/$desired_replicas replicas ready"
    fi
  done
}

run_smoke_tests() {
  log_info "Running smoke tests..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run smoke tests"
    return 0
  fi
  
  # Run smoke tests (adjust based on your setup)
  if command -v npm &> /dev/null && [[ -f "package.json" ]]; then
    if npm run test:smoke; then
      log_info "✓ Smoke tests passed"
    else
      log_error "✗ Smoke tests failed!"
      log_warn "Consider rolling forward instead of staying on this version"
    fi
  else
    log_warn "Smoke tests not available, skipping"
  fi
}

notify_team() {
  log_info "Notifying team of rollback..."
  
  local message="🔄 Production Rollback Executed
  
Namespace: $NAMESPACE
Service: ${SERVICE:-all}
Version: ${TARGET_VERSION:-previous}
Executed by: ${USER}
Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

Please monitor production metrics closely."
  
  # Send Slack notification if webhook is configured
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$message\"}" \
      "$SLACK_WEBHOOK_URL" || log_warn "Failed to send Slack notification"
  fi
  
  echo "$message"
}

# Main execution
main() {
  log_info "=== ValueOS Production Rollback ===="
  echo ""
  
  check_prerequisites
  show_rollback_plan
  confirm_rollback
  
  log_info "Starting rollback process..."
  
  local deployments
  deployments=$(get_deployments)
  local failed=0
  
  for deployment in $deployments; do
    local target_rev
    
    if [[ "$TARGET_VERSION" == "previous" ]] || [[ -z "$TARGET_VERSION" ]]; then
      target_rev=$(get_previous_revision "$deployment")
    else
      target_rev="$TARGET_VERSION"
    fi
    
    if ! execute_rollback "$deployment" "$target_rev"; then
      ((failed++))
    fi
  done
  
  if [[ $failed -gt 0 ]]; then
    log_error "Rollback completed with $failed failures"
    exit 1
  fi
  
  verify_rollback
  run_smoke_tests
  notify_team
  
  log_info "=== Rollback Complete ==="
}

# Run main function
main
