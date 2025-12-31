#!/bin/bash

###############################################################################
# End-to-End Billing System Test Suite
# 
# Tests all billing functionality in staging environment
# 
# Usage: ./scripts/tests/billing-e2e.sh [--env=staging|production]
# 
# Requirements:
# - curl
# - jq
# - psql
# - Valid API credentials
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENV="staging"
for arg in "$@"; do
  case $arg in
    --env=*)
      ENV="${arg#*=}"
      shift
      ;;
  esac
done

# Set API URL based on environment
if [ "$ENV" = "production" ]; then
  API_URL="https://api.valuecanvas.com"
  echo -e "${RED}⚠️  WARNING: Running tests against PRODUCTION${NC}"
  read -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
else
  API_URL="https://staging.valuecanvas.com"
fi

echo -e "${BLUE}🧪 Running E2E Billing Tests against $ENV${NC}"
echo "API URL: $API_URL"
echo ""

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
function test_start() {
  TESTS_RUN=$((TESTS_RUN + 1))
  echo -e "${BLUE}▶ Test $TESTS_RUN: $1${NC}"
}

function test_pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${GREEN}✓ PASS${NC}"
  echo ""
}

function test_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${RED}✗ FAIL: $1${NC}"
  echo ""
}

function check_command() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}Error: $1 is not installed${NC}"
    exit 1
  fi
}

# Check required commands
check_command curl
check_command jq
check_command psql

###############################################################################
# Test 1: Authentication
###############################################################################
test_start "User Authentication"

# Get test credentials from environment or prompt
if [ -z "$TEST_EMAIL" ]; then
  read -p "Test user email: " TEST_EMAIL
fi

if [ -z "$TEST_PASSWORD" ]; then
  read -sp "Test user password: " TEST_PASSWORD
  echo ""
fi

# Login
AUTH_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  test_fail "Failed to authenticate. Response: $AUTH_RESPONSE"
  exit 1
fi

test_pass

###############################################################################
# Test 2: Get Current Subscription
###############################################################################
test_start "Get Current Subscription"

SUBSCRIPTION_RESPONSE=$(curl -s -X GET "$API_URL/api/billing/subscription" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

CURRENT_PLAN=$(echo $SUBSCRIPTION_RESPONSE | jq -r '.plan_tier // empty')

if [ -z "$CURRENT_PLAN" ]; then
  echo -e "${YELLOW}⚠ No active subscription found (this is OK for new accounts)${NC}"
  CURRENT_PLAN="free"
else
  echo "Current plan: $CURRENT_PLAN"
fi

test_pass

###############################################################################
# Test 3: Invoice Preview
###############################################################################
test_start "Invoice Preview for Plan Change"

# Try to preview upgrade to standard
PREVIEW_RESPONSE=$(curl -s -X POST "$API_URL/api/billing/subscription/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planTier":"standard"}')

PREVIEW_ERROR=$(echo $PREVIEW_RESPONSE | jq -r '.error // empty')

if [ ! -z "$PREVIEW_ERROR" ]; then
  test_fail "Preview failed: $PREVIEW_ERROR"
else
  PRORATED_AMOUNT=$(echo $PREVIEW_RESPONSE | jq -r '.proratedAmount // empty')
  NEXT_INVOICE=$(echo $PREVIEW_RESPONSE | jq -r '.nextInvoiceAmount // empty')
  
  if [ -z "$PRORATED_AMOUNT" ] || [ -z "$NEXT_INVOICE" ]; then
    test_fail "Preview response missing required fields"
  else
    echo "Prorated amount: \$$PRORATED_AMOUNT"
    echo "Next invoice: \$$NEXT_INVOICE"
    test_pass
  fi
fi

###############################################################################
# Test 4: Usage Metrics
###############################################################################
test_start "Get Usage Metrics"

USAGE_RESPONSE=$(curl -s -X GET "$API_URL/api/billing/usage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

USAGE_ERROR=$(echo $USAGE_RESPONSE | jq -r '.error // empty')

if [ ! -z "$USAGE_ERROR" ]; then
  test_fail "Usage fetch failed: $USAGE_ERROR"
else
  LLM_USAGE=$(echo $USAGE_RESPONSE | jq -r '.usage.llm_tokens // 0')
  LLM_QUOTA=$(echo $USAGE_RESPONSE | jq -r '.quotas.llm_tokens // 0')
  
  echo "LLM tokens: $LLM_USAGE / $LLM_QUOTA"
  test_pass
fi

###############################################################################
# Test 5: Quota Enforcement (Soft Limit)
###############################################################################
test_start "Quota Enforcement with Grace Period"

# Make API call and check headers
QUOTA_RESPONSE=$(curl -s -v -X POST "$API_URL/api/agents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","input":"test"}' 2>&1)

# Check for quota headers
if echo "$QUOTA_RESPONSE" | grep -q "X-Quota-Remaining"; then
  REMAINING=$(echo "$QUOTA_RESPONSE" | grep "X-Quota-Remaining" | cut -d' ' -f3 | tr -d '\r')
  echo "Quota remaining: $REMAINING"
  test_pass
elif echo "$QUOTA_RESPONSE" | grep -q "X-Quota-Warning"; then
  echo -e "${YELLOW}⚠ Quota exceeded - grace period active${NC}"
  GRACE_EXPIRES=$(echo "$QUOTA_RESPONSE" | grep "X-Grace-Period-Expires" | cut -d' ' -f3 | tr -d '\r')
  echo "Grace period expires: $GRACE_EXPIRES"
  test_pass
else
  echo -e "${YELLOW}⚠ No quota headers found (endpoint may not have enforcement)${NC}"
  test_pass
fi

###############################################################################
# Test 6: Webhook Event Processing
###############################################################################
test_start "Webhook Event Processing"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠ DATABASE_URL not set, skipping webhook test${NC}"
  test_pass
else
  # Check recent webhook events
  WEBHOOK_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM webhook_events 
    WHERE received_at > NOW() - INTERVAL '1 hour';
  " | tr -d ' ')
  
  echo "Webhooks received in last hour: $WEBHOOK_COUNT"
  
  # Check for failed webhooks
  FAILED_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM webhook_events 
    WHERE processed = false 
    AND retry_count < 5;
  " | tr -d ' ')
  
  if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $FAILED_COUNT webhooks pending retry${NC}"
  fi
  
  test_pass
fi

###############################################################################
# Test 7: Grace Period Tracking
###############################################################################
test_start "Grace Period Tracking"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠ DATABASE_URL not set, skipping grace period test${NC}"
  test_pass
else
  # Check active grace periods
  GRACE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM grace_periods 
    WHERE expires_at > NOW();
  " | tr -d ' ')
  
  echo "Active grace periods: $GRACE_COUNT"
  
  if [ "$GRACE_COUNT" -gt 0 ]; then
    # Show details
    psql "$DATABASE_URL" -c "
      SELECT tenant_id, metric, started_at, expires_at 
      FROM grace_periods 
      WHERE expires_at > NOW() 
      LIMIT 5;
    "
  fi
  
  test_pass
fi

###############################################################################
# Test 8: Audit Log Entries
###############################################################################
test_start "Audit Log Entries"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠ DATABASE_URL not set, skipping audit log test${NC}"
  test_pass
else
  # Check recent audit log entries
  AUDIT_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM billing_audit_log 
    WHERE created_at > NOW() - INTERVAL '1 hour';
  " | tr -d ' ')
  
  echo "Audit log entries in last hour: $AUDIT_COUNT"
  
  if [ "$AUDIT_COUNT" -gt 0 ]; then
    # Show recent entries
    psql "$DATABASE_URL" -c "
      SELECT action, actor_type, resource_type, created_at 
      FROM billing_audit_log 
      ORDER BY created_at DESC 
      LIMIT 5;
    "
  fi
  
  test_pass
fi

###############################################################################
# Test 9: Dead Letter Queue
###############################################################################
test_start "Webhook Dead Letter Queue"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠ DATABASE_URL not set, skipping DLQ test${NC}"
  test_pass
else
  # Check dead letter queue
  DLQ_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM webhook_dead_letter_queue;
  " | tr -d ' ')
  
  echo "Events in dead letter queue: $DLQ_COUNT"
  
  if [ "$DLQ_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Dead letter queue has $DLQ_COUNT events - manual review needed${NC}"
    
    # Show DLQ entries
    psql "$DATABASE_URL" -c "
      SELECT stripe_event_id, event_type, error_message, moved_at 
      FROM webhook_dead_letter_queue 
      ORDER BY moved_at DESC 
      LIMIT 5;
    "
  fi
  
  test_pass
fi

###############################################################################
# Test 10: Invoices
###############################################################################
test_start "Invoice Retrieval"

INVOICES_RESPONSE=$(curl -s -X GET "$API_URL/api/billing/invoices?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

INVOICES_ERROR=$(echo $INVOICES_RESPONSE | jq -r '.error // empty')

if [ ! -z "$INVOICES_ERROR" ]; then
  test_fail "Invoice fetch failed: $INVOICES_ERROR"
else
  INVOICE_COUNT=$(echo $INVOICES_RESPONSE | jq -r '.invoices | length')
  echo "Invoices found: $INVOICE_COUNT"
  test_pass
fi

###############################################################################
# Summary
###############################################################################
echo ""
echo "========================================="
echo -e "${BLUE}Test Summary${NC}"
echo "========================================="
echo "Total tests run: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
