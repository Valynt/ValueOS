#!/usr/bin/env bash
# staging-parity-check.sh — Validate staging/production K8s config parity.
#
# Compares the staging and production Kustomize overlays to detect drift
# in infrastructure components that should be identical. Differences in
# replica counts and resource limits are expected; differences in secrets
# structure, feature flags, and infrastructure components are not.
#
# Usage:
#   bash scripts/staging-parity-check.sh
#
# Exit codes:
#   0 — parity checks pass
#   1 — parity violations found

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STAGING="infra/k8s/overlays/staging/kustomization.yaml"
PRODUCTION="infra/k8s/overlays/production/kustomization.yaml"
BASE_CONFIG="infra/k8s/base/configmap.yaml"
FAILURES=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Staging/Production Parity Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ---- Check 1: Both overlays exist ----
echo "1. Overlay files"
if [[ -f "$STAGING" ]]; then
  pass "Staging kustomization exists"
else
  fail "Staging kustomization missing: $STAGING"
fi

if [[ -f "$PRODUCTION" ]]; then
  pass "Production kustomization exists"
else
  fail "Production kustomization missing: $PRODUCTION"
fi

# ---- Check 2: Secrets structure ----
echo ""
echo "2. Secrets structure"

STAGING_HAS_SECRETS=$(grep -c "external-secrets" "$STAGING" 2>/dev/null || echo 0)
PROD_HAS_SECRETS=$(grep -c "external-secrets" "$PRODUCTION" 2>/dev/null || echo 0)

if [[ "$STAGING_HAS_SECRETS" -gt 0 && "$PROD_HAS_SECRETS" -gt 0 ]]; then
  pass "Both environments use External Secrets"
elif [[ "$STAGING_HAS_SECRETS" -eq 0 && "$PROD_HAS_SECRETS" -eq 0 ]]; then
  pass "Neither environment uses External Secrets (manual secrets)"
else
  fail "Secrets strategy mismatch: staging=$STAGING_HAS_SECRETS, production=$PROD_HAS_SECRETS"
fi

# ---- Check 3: Redis/messaging infrastructure ----
echo ""
echo "3. Messaging infrastructure (Redis)"

STAGING_HAS_REDIS=$(grep -c "redis\|messaging" "$STAGING" 2>/dev/null || echo 0)
PROD_HAS_REDIS=$(grep -c "redis\|messaging" "$PRODUCTION" 2>/dev/null || echo 0)

# Production uses base which includes redis via configmap; staging should also have it
STAGING_REDIS_RESOURCE=$(grep -c "redis-streams" "$STAGING" 2>/dev/null || echo 0)

if [[ "$STAGING_REDIS_RESOURCE" -gt 0 ]]; then
  pass "Staging includes Redis Streams resource"
else
  fail "Staging missing Redis Streams resource"
fi

# ---- Check 4: Rate limiting ----
echo ""
echo "4. Rate limiting"

STAGING_RATE_LIMIT=$(grep -c "rate-limit" "$STAGING" 2>/dev/null || echo 0)
if [[ "$STAGING_RATE_LIMIT" -gt 0 ]]; then
  pass "Staging has rate limiting configuration"
else
  fail "Staging missing rate limiting configuration"
fi

if [[ -f "infra/k8s/overlays/staging/rate-limiting-patch.yaml" ]]; then
  pass "Staging rate limiting patch file exists"
else
  fail "Staging rate limiting patch file missing"
fi

# ---- Check 5: Feature flags parity ----
echo ""
echo "5. Feature flags"

for flag in "enable-circuit-breaker" "enable-rate-limiting" "enable-audit-logging"; do
  BASE_HAS=$(grep -c "$flag" "$BASE_CONFIG" 2>/dev/null || echo 0)
  STAGING_HAS=$(grep -c "$flag" "$STAGING" 2>/dev/null || echo 0)

  if [[ "$BASE_HAS" -gt 0 || "$STAGING_HAS" -gt 0 ]]; then
    pass "$flag present in staging"
  else
    fail "$flag missing from staging"
  fi
done

# ---- Check 6: Deployment structure ----
echo ""
echo "6. Deployment patches"

if [[ -f "infra/k8s/overlays/staging/deployment-patch.yaml" ]]; then
  pass "Staging deployment patch exists"
else
  fail "Staging deployment patch missing"
fi

if [[ -f "infra/k8s/overlays/production/deployment-patch.yaml" ]]; then
  pass "Production deployment patch exists"
else
  fail "Production deployment patch missing"
fi

# ---- Check 7: Both use same base ----
echo ""
echo "7. Shared base"

STAGING_BASE=$(grep -E "^\s*-\s*\.\./\.\./base" "$STAGING" 2>/dev/null | head -1 || echo "")
PROD_BASE=$(grep -E "^\s*-\s*\.\./\.\./base" "$PRODUCTION" 2>/dev/null | head -1 || echo "")

if [[ -n "$STAGING_BASE" && -n "$PROD_BASE" ]]; then
  pass "Both overlays reference ../../base"
else
  fail "Base reference mismatch: staging='$STAGING_BASE', production='$PROD_BASE'"
fi

# ---- Summary ----
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "  ${GREEN}All parity checks passed${NC}"
else
  echo -e "  ${RED}$FAILURES parity violation(s) found${NC}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit "$FAILURES"
