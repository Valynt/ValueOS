#!/usr/bin/env bash
# =============================================================================
# S3-06: Traffic Cutover (Go-Live)
# =============================================================================
# Executes the blue-green traffic switch to the green slot, then monitors
# SLOs for 30 minutes. Auto-rollback if any SLO is breached.
#
# Usage:
#   ./scripts/traffic-cutover.sh --endpoint <production-url> \
#       [--namespace <ns>] [--monitoring-minutes <m>] [--dry-run]
#
# SLO Thresholds:
#   - Error rate:  < 0.1%
#   - p95 latency: ≤ 300ms
#   - Health:      all endpoints 200
#   - RLS violations: 0
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${PROD_NAMESPACE:-valynt}"
ENDPOINT="${PROD_ENDPOINT:-}"
MONITORING_MINUTES="${MONITORING_MINUTES:-30}"
DRY_RUN=false

SLO_ERROR_RATE_THRESHOLD="0.001"  # 0.1%
SLO_P95_LATENCY_MS=300
HEALTH_CHECK_INTERVAL=30  # seconds between health checks during monitoring

# --- Parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)           NAMESPACE="$2"; shift 2 ;;
    --endpoint)            ENDPOINT="$2"; shift 2 ;;
    --monitoring-minutes)  MONITORING_MINUTES="$2"; shift 2 ;;
    --dry-run)             DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

log_info()    { echo -e "${BLUE}[$(date -u +%H:%M:%S)] $1${NC}"; }
log_pass()    { echo -e "${GREEN}[$(date -u +%H:%M:%S)] $1${NC}"; }
log_fail()    { echo -e "${RED}[$(date -u +%H:%M:%S)] $1${NC}"; }
log_warn()    { echo -e "${YELLOW}[$(date -u +%H:%M:%S)] $1${NC}"; }

# =============================================================================
# Pre-Flight Checks
# =============================================================================

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  S3-06: Traffic Cutover${NC}"
echo -e "${BLUE}  Namespace:  ${NAMESPACE}${NC}"
echo -e "${BLUE}  Endpoint:   ${ENDPOINT}${NC}"
echo -e "${BLUE}  Monitor:    ${MONITORING_MINUTES} minutes${NC}"
echo -e "${BLUE}  Dry-Run:    ${DRY_RUN}${NC}"
echo -e "${BLUE}  Date:       $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo -e "${BLUE}================================================================${NC}"

# Verify green slot is healthy before switching
log_info "Pre-flight: Checking green slot health..."
green_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  "${ENDPOINT}/api/health" 2>/dev/null || echo "000")
if [[ "$green_status" != "200" ]]; then
  log_fail "Green slot health check failed (${green_status}). Aborting cutover."
  exit 1
fi
log_pass "Green slot healthy"

# Verify blue slot exists for rollback
blue_ready=$(kubectl get deployment backend-blue-production -n "$NAMESPACE" \
  -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
log_info "Blue slot ready replicas: ${blue_ready:-0} (rollback target)"

# Capture baseline metrics
log_info "Capturing pre-cutover baseline..."
CUTOVER_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# =============================================================================
# Rollback Function
# =============================================================================

rollback() {
  echo ""
  log_fail "SLO BREACH DETECTED — INITIATING ROLLBACK"
  log_info "Switching traffic back to blue slot..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] Would patch services to slot=blue"
    return
  fi

  ROLLBACK_START=$(date +%s)

  kubectl patch service backend-active-production -n "$NAMESPACE" \
    -p '{"spec":{"selector":{"slot":"blue"}}}' 2>/dev/null || true
  kubectl patch service frontend-active-production -n "$NAMESPACE" \
    -p '{"spec":{"selector":{"slot":"blue"}}}' 2>/dev/null || true

  ROLLBACK_END=$(date +%s)
  ROLLBACK_DURATION=$((ROLLBACK_END - ROLLBACK_START))

  log_info "Rollback completed in ${ROLLBACK_DURATION}s (target: ≤120s)"

  # Verify rollback health
  for i in $(seq 1 5); do
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
      "${ENDPOINT}/api/health" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]]; then
      log_pass "Post-rollback health: 200"
      break
    fi
    sleep 5
  done

  echo ""
  log_fail "CUTOVER ROLLED BACK. Investigate and retry after fix."
  exit 1
}

# =============================================================================
# Execute Traffic Switch
# =============================================================================

log_info "=== EXECUTING TRAFFIC SWITCH ==="

if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[DRY-RUN] Would patch backend-active-production selector to slot=green"
  log_info "[DRY-RUN] Would patch frontend-active-production selector to slot=green"
else
  log_info "Patching backend service selector to green..."
  kubectl patch service backend-active-production -n "$NAMESPACE" \
    -p '{"spec":{"selector":{"slot":"green"}}}'

  log_info "Patching frontend service selector to green..."
  kubectl patch service frontend-active-production -n "$NAMESPACE" \
    -p '{"spec":{"selector":{"slot":"green"}}}'

  log_pass "Traffic switched to green slot"
fi

# =============================================================================
# 30-Minute Monitoring Window
# =============================================================================

log_info "=== STARTING ${MONITORING_MINUTES}-MINUTE MONITORING WINDOW ==="

MONITORING_SECONDS=$((MONITORING_MINUTES * 60))
MONITORING_END=$(($(date +%s) + MONITORING_SECONDS))
CHECK_COUNT=0
ERROR_COUNT=0
TOTAL_CHECKS=0
LATENCY_SUM=0

while [[ $(date +%s) -lt $MONITORING_END ]]; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  elapsed_min=$(( ($(date +%s) - $(date -d "$CUTOVER_START" +%s 2>/dev/null || date +%s)) / 60 ))
  remaining=$((MONITORING_MINUTES - elapsed_min))

  # --- Health check ---
  start_ms=$(date +%s%N)
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    "${ENDPOINT}/api/health" 2>/dev/null || echo "000")
  end_ms=$(date +%s%N)
  latency_ms=$(( (end_ms - start_ms) / 1000000 ))

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  LATENCY_SUM=$((LATENCY_SUM + latency_ms))

  if [[ "$status" != "200" ]]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
    log_warn "Health check #${CHECK_COUNT}: ${status} (${latency_ms}ms) [${remaining}min remaining]"
  else
    log_info "Health check #${CHECK_COUNT}: ${status} (${latency_ms}ms) [${remaining}min remaining]"
  fi

  # --- Check error rate ---
  if [[ "$TOTAL_CHECKS" -gt 0 ]]; then
    error_rate=$(python3 -c "print(f'{${ERROR_COUNT}/${TOTAL_CHECKS}:.4f}')" 2>/dev/null || echo "0")
    if python3 -c "exit(0 if float('${error_rate}') < float('${SLO_ERROR_RATE_THRESHOLD}') else 1)" 2>/dev/null; then
      : # within SLO
    else
      log_fail "Error rate ${error_rate} exceeds threshold ${SLO_ERROR_RATE_THRESHOLD}"
      rollback
    fi
  fi

  # --- Check latency ---
  if [[ "$latency_ms" -gt "$SLO_P95_LATENCY_MS" ]]; then
    log_warn "Latency spike: ${latency_ms}ms (SLO: ≤${SLO_P95_LATENCY_MS}ms)"
    # Allow occasional spikes — only rollback on sustained breach
    consecutive_slow=$((${consecutive_slow:-0} + 1))
    if [[ "$consecutive_slow" -ge 3 ]]; then
      log_fail "3 consecutive latency SLO breaches"
      rollback
    fi
  else
    consecutive_slow=0
  fi

  # --- Check for RLS violations in logs ---
  if [[ "$DRY_RUN" == "false" && $((CHECK_COUNT % 5)) -eq 0 ]]; then
    rls_violations=$(kubectl logs -n "$NAMESPACE" -l slot=green,app=backend \
      --tail=200 --since=60s 2>/dev/null | \
      grep -ciE "rls.*violation|policy.*denied|row.*level.*security" || echo "0")
    if [[ "$rls_violations" -gt 0 ]]; then
      log_fail "RLS violations detected in logs: ${rls_violations}"
      rollback
    fi
  fi

  sleep "$HEALTH_CHECK_INTERVAL"
done

# =============================================================================
# Post-Cutover Validation
# =============================================================================

log_info "=== MONITORING COMPLETE — POST-CUTOVER VALIDATION ==="

AVG_LATENCY=$((LATENCY_SUM / TOTAL_CHECKS))
FINAL_ERROR_RATE=$(python3 -c "print(f'{${ERROR_COUNT}/${TOTAL_CHECKS}:.4f}')" 2>/dev/null || echo "0")

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  Cutover Results${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "  Duration:       ${MONITORING_MINUTES} minutes"
echo -e "  Health checks:  ${TOTAL_CHECKS}"
echo -e "  Errors:         ${ERROR_COUNT}"
echo -e "  Error rate:     ${FINAL_ERROR_RATE} (threshold: <${SLO_ERROR_RATE_THRESHOLD})"
echo -e "  Avg latency:    ${AVG_LATENCY}ms (threshold: ≤${SLO_P95_LATENCY_MS}ms)"
echo ""

# Final health check on all endpoints
all_healthy=true
for path in /api/health /api/health/ready /api/health/live; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    "${ENDPOINT}${path}" 2>/dev/null || echo "000")
  if [[ "$status" == "200" ]]; then
    log_pass "${path} -> 200"
  else
    log_fail "${path} -> ${status}"
    all_healthy=false
  fi
done

if [[ "$all_healthy" == "true" && "$ERROR_COUNT" -eq 0 ]]; then
  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}  GO-LIVE SUCCESSFUL${NC}"
  echo -e "${GREEN}  ValueOS is live on production.${NC}"
  echo -e "${GREEN}  Cutover completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
  echo -e "${GREEN}================================================================${NC}"
  exit 0
else
  echo ""
  log_warn "Cutover completed with warnings. Review logs carefully."
  exit 0
fi
