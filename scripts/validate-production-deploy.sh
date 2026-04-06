#!/usr/bin/env bash
# =============================================================================
# S3-01: Production Deployment Dry-Run Validation
# =============================================================================
# Validates a green-slot production deployment WITHOUT switching traffic.
# Checks: health endpoints, secrets injection, DB migration parity,
#          Redis Sentinel, WAF rules, SSL/TLS.
#
# Usage:
#   ./scripts/validate-production-deploy.sh [--namespace <ns>] [--endpoint <url>]
#
# Environment:
#   PROD_NAMESPACE      K8s namespace (default: valynt)
#   GREEN_ENDPOINT      Internal green-slot URL
#   STAGING_DB_URL      Staging database URL (for migration parity check)
#   PROD_DB_URL         Production database URL
#   HEALTH_AUTH_TOKEN    Optional auth token for /api/health
# =============================================================================

set -euo pipefail

# --- Configuration -----------------------------------------------------------
NAMESPACE="${PROD_NAMESPACE:-valynt}"
GREEN_ENDPOINT="${GREEN_ENDPOINT:-}"
HEALTH_AUTH_TOKEN="${HEALTH_AUTH_TOKEN:-}"
STAGING_DB_URL="${STAGING_DB_URL:-}"
PROD_DB_URL="${PROD_DB_URL:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

# --- Helpers -----------------------------------------------------------------
log_info()    { echo -e "${BLUE}[INFO]  $1${NC}"; }
log_pass()    { echo -e "${GREEN}[PASS]  $1${NC}"; PASS=$((PASS + 1)); }
log_fail()    { echo -e "${RED}[FAIL]  $1${NC}"; FAIL=$((FAIL + 1)); }
log_warn()    { echo -e "${YELLOW}[WARN]  $1${NC}"; WARN=$((WARN + 1)); }

section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# --- Parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --endpoint)  GREEN_ENDPOINT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$GREEN_ENDPOINT" ]]; then
  # Derive from kubectl if not provided
  GREEN_ENDPOINT=$(kubectl get svc backend-green-production -n "$NAMESPACE" \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
  if [[ -z "$GREEN_ENDPOINT" ]]; then
    echo "Error: GREEN_ENDPOINT not set and cannot be derived from K8s."
    echo "Usage: $0 --endpoint https://<green-internal-url>"
    exit 1
  fi
  GREEN_ENDPOINT="https://${GREEN_ENDPOINT}"
fi

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  S3-01: Production Deploy Validation${NC}"
echo -e "${BLUE}  Namespace: ${NAMESPACE}${NC}"
echo -e "${BLUE}  Endpoint:  ${GREEN_ENDPOINT}${NC}"
echo -e "${BLUE}  Date:      $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo -e "${BLUE}===============================================${NC}"

# =============================================================================
# AC-1: All health endpoints return 200
# =============================================================================
section "AC-1: Health Endpoints"

HEALTH_HEADER=""
if [[ -n "$HEALTH_AUTH_TOKEN" ]]; then
  HEALTH_HEADER="Authorization: Bearer ${HEALTH_AUTH_TOKEN}"
fi

for path in /api/health /api/health/ready /api/health/live; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    ${HEALTH_HEADER:+-H "$HEALTH_HEADER"} \
    "${GREEN_ENDPOINT}${path}" 2>/dev/null || echo "000")
  if [[ "$status" == "200" ]]; then
    log_pass "${path} -> ${status}"
  else
    log_fail "${path} -> ${status} (expected 200)"
  fi
done

# Verify health body includes all subsystem checks
health_body=$(curl -s --max-time 15 \
  ${HEALTH_HEADER:+-H "$HEALTH_HEADER"} \
  "${GREEN_ENDPOINT}/api/health" 2>/dev/null || echo "{}")
for check in postgres redis; do
  if echo "$health_body" | grep -qi "\"$check\""; then
    log_pass "Health response includes ${check} check"
  else
    log_warn "Health response missing ${check} check"
  fi
done

# =============================================================================
# AC-2: Secrets injected correctly (no hardcoded values)
# =============================================================================
section "AC-2: Secrets Injection"

# Verify ExternalSecrets status
es_status=$(kubectl get externalsecrets -n "$NAMESPACE" -o json 2>/dev/null || echo '{}')
es_total=$(echo "$es_status" | jq '.items | length' 2>/dev/null || echo "0")
es_synced=$(echo "$es_status" | jq '[.items[] | select(.status.conditions[]?.reason == "SecretSynced")] | length' 2>/dev/null || echo "0")

if [[ "$es_total" -gt 0 && "$es_synced" -eq "$es_total" ]]; then
  log_pass "ExternalSecrets: ${es_synced}/${es_total} synced"
else
  log_fail "ExternalSecrets: ${es_synced}/${es_total} synced (expected all)"
fi

# Spot-check that green pods don't contain placeholder values
green_pod=$(kubectl get pods -n "$NAMESPACE" -l slot=green,app=backend \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$green_pod" ]]; then
  placeholder_count=$(kubectl exec "$green_pod" -n "$NAMESPACE" -- \
    env 2>/dev/null | grep -ciE 'CHANGE_ME|PLACEHOLDER|TODO|your-.*-here' || echo "0")
  if [[ "$placeholder_count" -eq 0 ]]; then
    log_pass "No placeholder secrets detected in green pod"
  else
    log_fail "Found ${placeholder_count} placeholder values in green pod env"
  fi
else
  log_warn "No green pod found — skipping env placeholder check"
fi

# =============================================================================
# AC-3: Database migration state matches staging
# =============================================================================
section "AC-3: Database Migration Parity"

if [[ -n "$STAGING_DB_URL" && -n "$PROD_DB_URL" ]]; then
  staging_version=$(psql "$STAGING_DB_URL" -t -c \
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | xargs)
  prod_version=$(psql "$PROD_DB_URL" -t -c \
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | xargs)
  if [[ "$staging_version" == "$prod_version" ]]; then
    log_pass "Migration parity: staging=${staging_version} prod=${prod_version}"
  else
    log_fail "Migration mismatch: staging=${staging_version} prod=${prod_version}"
  fi
else
  log_warn "STAGING_DB_URL or PROD_DB_URL not set — skipping migration parity"
fi

# =============================================================================
# AC-4: Redis Sentinel topology healthy
# =============================================================================
section "AC-4: Redis Sentinel"

redis_pod=$(kubectl get pods -n "$NAMESPACE" -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$redis_pod" ]]; then
  role=$(kubectl exec "$redis_pod" -n "$NAMESPACE" -- \
    redis-cli info replication 2>/dev/null | grep "^role:" | tr -d '\r' || echo "role:unknown")
  connected=$(kubectl exec "$redis_pod" -n "$NAMESPACE" -- \
    redis-cli info replication 2>/dev/null | grep "^connected_slaves:" | tr -d '\r' || echo "connected_slaves:0")
  slave_count=$(echo "$connected" | cut -d: -f2)

  if echo "$role" | grep -q "master"; then
    log_pass "Redis role: master"
  else
    log_fail "Redis role: $(echo "$role" | cut -d: -f2) (expected master)"
  fi

  if [[ "${slave_count:-0}" -ge 1 ]]; then
    log_pass "Redis connected slaves: ${slave_count}"
  else
    log_warn "Redis connected slaves: ${slave_count} (expected ≥1 for Sentinel)"
  fi
else
  log_warn "No Redis pod found — skipping Sentinel check"
fi

# =============================================================================
# AC-5: WAF blocks test attack payloads
# =============================================================================
section "AC-5: WAF Rules"

declare -A waf_payloads=(
  ["SQL injection"]="'; DROP TABLE users;--"
  ["XSS"]="<script>alert(1)</script>"
  ["Path traversal"]="../../etc/passwd"
)

for label in "${!waf_payloads[@]}"; do
  payload="${waf_payloads[$label]}"
  # URL-encode the payload for the query string
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${payload}'''))" 2>/dev/null || echo "$payload")
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    "${GREEN_ENDPOINT}/api/search?q=${encoded}" 2>/dev/null || echo "000")
  if [[ "$status" == "403" ]]; then
    log_pass "WAF blocked: ${label} -> ${status}"
  elif [[ "$status" == "400" || "$status" == "422" ]]; then
    log_pass "Input rejected: ${label} -> ${status} (app-level validation)"
  else
    log_warn "WAF did not block ${label}: got ${status} (expected 403)"
  fi
done

# =============================================================================
# AC-6: HTTPS with valid cert
# =============================================================================
section "AC-6: SSL/TLS"

hostname=$(echo "$GREEN_ENDPOINT" | sed 's|https://||;s|/.*||')

# Check certificate validity
cert_info=$(echo | openssl s_client -connect "${hostname}:443" -servername "$hostname" 2>/dev/null || true)
if echo "$cert_info" | grep -q "Verify return code: 0"; then
  log_pass "TLS certificate valid (verify return code: 0)"
else
  verify_code=$(echo "$cert_info" | grep "Verify return code:" | head -1 || echo "unknown")
  log_fail "TLS certificate issue: ${verify_code}"
fi

# Check HSTS header
hsts=$(curl -s -I --max-time 10 "${GREEN_ENDPOINT}/api/health" 2>/dev/null \
  | grep -i "strict-transport-security" || true)
if [[ -n "$hsts" ]]; then
  log_pass "HSTS header present: $(echo "$hsts" | xargs)"
else
  log_warn "HSTS header not found"
fi

# Check HTTP -> HTTPS redirect
http_endpoint=$(echo "$GREEN_ENDPOINT" | sed 's|https://|http://|')
redirect_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -L --max-redirs 0 "${http_endpoint}/api/health" 2>/dev/null || echo "000")
if [[ "$redirect_status" == "301" || "$redirect_status" == "308" ]]; then
  log_pass "HTTP->HTTPS redirect: ${redirect_status}"
else
  log_warn "HTTP->HTTPS redirect returned ${redirect_status} (expected 301/308)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  Validation Summary${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "  ${GREEN}PASS: ${PASS}${NC}"
echo -e "  ${RED}FAIL: ${FAIL}${NC}"
echo -e "  ${YELLOW}WARN: ${WARN}${NC}"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}RESULT: BLOCKED — ${FAIL} check(s) failed. Do NOT proceed to traffic cutover.${NC}"
  exit 1
else
  echo -e "${GREEN}RESULT: PASSED — Green slot ready for smoke tests (S3-02).${NC}"
  exit 0
fi
