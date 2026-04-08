#!/usr/bin/env bash
# =============================================================================
# S3-05: Pre-Launch Secret Rotation
# =============================================================================
# Rotates all production secrets before go-live, verifies health, and updates
# the rotation log. Uses AWS Secrets Manager / Vault via ExternalSecrets.
#
# Usage:
#   ./scripts/security/pre-launch-secret-rotation.sh \
#       --namespace <ns> --endpoint <green-url> [--dry-run]
#
# Prerequisites:
#   - AWS CLI configured with appropriate IAM role
#   - kubectl access to production cluster
#   - vault CLI (if Vault provider is used)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${PROD_NAMESPACE:-valynt}"
GREEN_ENDPOINT="${GREEN_ENDPOINT:-}"
DRY_RUN=false
AWS_REGION="${AWS_REGION:-us-east-1}"
ROTATION_LOG="docs/security-compliance/secret-rotation-log.md"
SECRETS_PREFIX="${SECRETS_PREFIX:-valueos}"
PASS=0
FAIL=0

# --- Parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --endpoint)  GREEN_ENDPOINT="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

log_info()    { echo -e "${BLUE}[INFO]  $1${NC}"; }
log_pass()    { echo -e "${GREEN}[PASS]  $1${NC}"; PASS=$((PASS + 1)); }
log_fail()    { echo -e "${RED}[FAIL]  $1${NC}"; FAIL=$((FAIL + 1)); }
log_warn()    { echo -e "${YELLOW}[WARN]  $1${NC}"; }

section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

ROTATION_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
declare -a ROTATED_SECRETS=()

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  S3-05: Pre-Launch Secret Rotation${NC}"
echo -e "${BLUE}  Namespace: ${NAMESPACE}${NC}"
echo -e "${BLUE}  Dry-Run:   ${DRY_RUN}${NC}"
echo -e "${BLUE}  Date:      ${ROTATION_DATE}${NC}"
echo -e "${BLUE}================================================================${NC}"

# =============================================================================
# Secret Definitions
# =============================================================================
# Each secret: <aws-secret-id> <description>
declare -A SECRETS_TO_ROTATE=(
  ["${SECRETS_PREFIX}/jwt-secret"]="JWT signing secret"
  ["${SECRETS_PREFIX}/stripe-api-key"]="Stripe API secret key"
  ["${SECRETS_PREFIX}/openai-api-key"]="OpenAI API key"
  ["${SECRETS_PREFIX}/together-api-key"]="Together AI API key"
  ["${SECRETS_PREFIX}/redis-password"]="Redis cluster password"
  ["${SECRETS_PREFIX}/session-secret"]="Express session secret"
)

# Supabase service_role requires dashboard rotation — document separately
SUPABASE_ROTATION_BLOCKED=true

# =============================================================================
# 1. Check current secret ages
# =============================================================================
section "1. Current Secret Ages"

MAX_AGE_DAYS=90
for secret_id in "${!SECRETS_TO_ROTATE[@]}"; do
  desc="${SECRETS_TO_ROTATE[$secret_id]}"

  age_info=$(aws secretsmanager describe-secret \
    --secret-id "$secret_id" \
    --region "$AWS_REGION" \
    --query '{LastRotated: LastRotatedDate, LastChanged: LastChangedDate, Created: CreatedDate}' \
    --output json 2>/dev/null || echo '{}')

  last_date=$(echo "$age_info" | jq -r '[.LastRotated, .LastChanged, .Created] | map(select(. != null)) | first // "unknown"')
  if [[ "$last_date" != "unknown" && "$last_date" != "null" ]]; then
    age_days=$(python3 -c "
from datetime import datetime, timezone
d = datetime.fromisoformat('${last_date}'.replace('Z','+00:00'))
print(int((datetime.now(timezone.utc) - d).days))
" 2>/dev/null || echo "999")
    log_info "${desc}: ${age_days} days old (last: ${last_date})"
    if [[ "$age_days" -gt "$MAX_AGE_DAYS" ]]; then
      log_warn "${desc} exceeds ${MAX_AGE_DAYS}-day policy"
    fi
  else
    log_warn "${desc}: Could not determine age (secret may not exist yet)"
  fi
done

# =============================================================================
# 2. Rotate secrets
# =============================================================================
section "2. Rotating Secrets"

rotate_aws_secret() {
  local secret_id="$1"
  local desc="$2"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] Would rotate: ${desc} (${secret_id})"
    ROTATED_SECRETS+=("${secret_id}|${desc}|DRY-RUN")
    return 0
  fi

  log_info "Rotating: ${desc} (${secret_id})"

  if aws secretsmanager rotate-secret \
    --secret-id "$secret_id" \
    --region "$AWS_REGION" 2>/dev/null; then
    log_pass "Rotated: ${desc}"
    ROTATED_SECRETS+=("${secret_id}|${desc}|ROTATED")
    return 0
  else
    # If no rotation lambda configured, put a new random value
    new_value=$(openssl rand -base64 48 | tr -d '\n')
    if aws secretsmanager put-secret-value \
      --secret-id "$secret_id" \
      --secret-string "$new_value" \
      --region "$AWS_REGION" 2>/dev/null; then
      log_pass "Updated: ${desc} (manual rotation)"
      ROTATED_SECRETS+=("${secret_id}|${desc}|MANUAL")
      return 0
    else
      log_fail "Failed to rotate: ${desc}"
      ROTATED_SECRETS+=("${secret_id}|${desc}|FAILED")
      return 1
    fi
  fi
}

for secret_id in "${!SECRETS_TO_ROTATE[@]}"; do
  rotate_aws_secret "$secret_id" "${SECRETS_TO_ROTATE[$secret_id]}" || true
done

# Document Supabase key status
if [[ "$SUPABASE_ROTATION_BLOCKED" == "true" ]]; then
  log_warn "Supabase service_role key: REQUIRES MANUAL DASHBOARD ROTATION"
  log_warn "  -> Operator must rotate via Supabase dashboard before go-live"
  log_warn "  -> See docs/security-compliance/secret-rotation-log.md for details"
  ROTATED_SECRETS+=("supabase/service-role|Supabase service_role key|BLOCKED-MANUAL")
fi

# =============================================================================
# 3. Sync ExternalSecrets & restart green pods
# =============================================================================
section "3. Sync & Restart"

if [[ "$DRY_RUN" == "false" ]]; then
  # Force ExternalSecrets to re-sync
  log_info "Triggering ExternalSecrets refresh..."
  kubectl annotate externalsecrets -n "$NAMESPACE" --all \
    "force-sync=$(date +%s)" --overwrite 2>/dev/null || \
    log_warn "Could not annotate ExternalSecrets (may need manual sync)"

  # Wait for sync
  log_info "Waiting 30s for ExternalSecrets sync..."
  for i in $(seq 1 6); do
    synced=$(kubectl get externalsecrets -n "$NAMESPACE" -o json 2>/dev/null | \
      jq '[.items[] | select(.status.conditions[]?.reason == "SecretSynced")] | length' 2>/dev/null || echo "0")
    total=$(kubectl get externalsecrets -n "$NAMESPACE" -o json 2>/dev/null | \
      jq '.items | length' 2>/dev/null || echo "0")
    if [[ "$synced" -eq "$total" && "$total" -gt 0 ]]; then
      log_pass "ExternalSecrets synced: ${synced}/${total}"
      break
    fi
    sleep 5
  done

  # Restart green pods to pick up new secrets
  log_info "Restarting green-slot deployments..."
  kubectl rollout restart deployment -n "$NAMESPACE" -l slot=green 2>/dev/null || \
    log_warn "Could not restart green deployments"

  log_info "Waiting for rollout..."
  kubectl rollout status deployment -n "$NAMESPACE" -l slot=green --timeout=300s 2>/dev/null || \
    log_fail "Green deployment rollout did not complete within 300s"
fi

# =============================================================================
# 4. Verify health post-rotation
# =============================================================================
section "4. Post-Rotation Health Check"

if [[ -n "$GREEN_ENDPOINT" && "$DRY_RUN" == "false" ]]; then
  log_info "Waiting 15s for pod stabilization..."
  sleep 15

  for path in /api/health /api/health/ready /api/health/live; do
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      "${GREEN_ENDPOINT}${path}" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]]; then
      log_pass "Post-rotation health: ${path} -> 200"
    else
      log_fail "Post-rotation health: ${path} -> ${status}"
    fi
  done
else
  log_info "Skipping health check (dry-run or no endpoint)"
fi

# =============================================================================
# 5. Update rotation log
# =============================================================================
section "5. Updating Rotation Log"

mkdir -p "$(dirname "$ROTATION_LOG")"

{
  echo ""
  echo "## Rotation Entry — ${ROTATION_DATE}"
  echo ""
  echo "| Secret | Description | Status |"
  echo "|--------|-------------|--------|"
  for entry in "${ROTATED_SECRETS[@]}"; do
    IFS='|' read -r sid desc rstatus <<< "$entry"
    echo "| \`${sid}\` | ${desc} | ${rstatus} |"
  done
  echo ""
  echo "**Operator:** automated via \`scripts/security/pre-launch-secret-rotation.sh\`"
  echo "**Health Check Post-Rotation:** $([ "$FAIL" -eq 0 ] && echo "PASS" || echo "FAILED")"
  echo ""
} >> "$ROTATION_LOG"

log_pass "Rotation log updated: ${ROTATION_LOG}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  Secret Rotation Summary${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "  Rotated: ${#ROTATED_SECRETS[@]} secrets"
echo -e "  ${GREEN}PASS: ${PASS}${NC}"
echo -e "  ${RED}FAIL: ${FAIL}${NC}"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}RESULT: INCOMPLETE — ${FAIL} rotation(s) failed.${NC}"
  exit 1
elif [[ "$SUPABASE_ROTATION_BLOCKED" == "true" ]]; then
  echo -e "${YELLOW}RESULT: PARTIAL — Supabase service_role requires manual dashboard rotation.${NC}"
  exit 2
else
  echo -e "${GREEN}RESULT: COMPLETE — All secrets rotated and verified.${NC}"
  exit 0
fi
