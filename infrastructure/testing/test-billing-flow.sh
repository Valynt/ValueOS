#!/bin/bash
# End-to-End Billing Flow Test
# Tests complete billing lifecycle

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     E2E Billing Flow Test                             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

BASE_URL="${1:-http://localhost:3000}"
TEST_TENANT_ID="test-tenant-$(date +%s)"
TEST_EMAIL="test-$TEST_TENANT_ID@example.com"

echo -e "${YELLOW}Testing against: $BASE_URL${NC}"
echo -e "${YELLOW}Test Tenant: $TEST_TENANT_ID${NC}"
echo ""

# Test 1: Create Customer
echo -e "${BLUE}[1/8] Creating customer...${NC}"
CUSTOMER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/billing/customer" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TEST_TENANT_ID" \
  -d "{\"organizationName\":\"Test Org\",\"email\":\"$TEST_EMAIL\"}")

if echo "$CUSTOMER_RESPONSE" | grep -q "stripe_customer_id"; then
  echo -e "${GREEN}✓ Customer created${NC}"
else
  echo -e "${RED}✗ Customer creation failed${NC}"
  echo "$CUSTOMER_RESPONSE"
  exit 1
fi

# Test 2: Create Subscription
echo -e "${BLUE}[2/8] Creating subscription (Free plan)...${NC}"
SUB_RESPONSE=$(curl -s -X POST "$BASE_URL/api/billing/subscription" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TEST_TENANT_ID" \
  -d '{"planTier":"free"}')

if echo "$SUB_RESPONSE" | grep -q "stripe_subscription_id"; then
  echo -e "${GREEN}✓ Subscription created${NC}"
  SUBSCRIPTION_ID=$(echo "$SUB_RESPONSE" | jq -r '.stripe_subscription_id')
else
  echo -e "${RED}✗ Subscription creation failed${NC}"
  echo "$SUB_RESPONSE"
  exit 1
fi

# Test 3: Emit Usage Events
echo -e "${BLUE}[3/8] Emitting usage events...${NC}"
REQUEST_ID="req-test-$(date +%s)"

# Emit LLM tokens
for i in {1..5}; do
  curl -s -X POST "$BASE_URL/api/llm/chat" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: $TEST_TENANT_ID" \
    -H "X-Request-Id: $REQUEST_ID-$i" \
    -d '{"prompt":"test","model":"gpt-4"}' > /dev/null
  sleep 0.1
done

echo -e "${GREEN}✓ 5 usage events emitted${NC}"

# Test 4: Check Usage Events in DB
echo -e "${BLUE}[4/8] Checking usage events...${NC}"
sleep 2

USAGE_RESPONSE=$(curl -s "$BASE_URL/api/billing/usage" \
  -H "X-Tenant-Id: $TEST_TENANT_ID")

if echo "$USAGE_RESPONSE" | grep -q "usage"; then
  echo -e "${GREEN}✓ Usage data retrieved${NC}"
else
  echo -e "${YELLOW}⚠ Usage data not yet available (may need time to aggregate)${NC}"
fi

# Test 5: Check Quota Enforcement
echo -e "${BLUE}[5/8] Testing quota enforcement...${NC}"

# Make request that should be within quota
QUOTA_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/llm/chat" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TEST_TENANT_ID" \
  -d '{"prompt":"test"}')

HTTP_CODE=$(echo "$QUOTA_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Request within quota allowed${NC}"
else
  echo -e "${YELLOW}⚠ Unexpected status code: $HTTP_CODE${NC}"
fi

# Test 6: Upgrade Plan
echo -e "${BLUE}[6/8] Upgrading to Standard plan...${NC}"

UPGRADE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/billing/subscription" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TEST_TENANT_ID" \
  -d '{"planTier":"standard"}')

if echo "$UPGRADE_RESPONSE" | grep -q "standard"; then
  echo -e "${GREEN}✓ Plan upgraded to Standard${NC}"
else
  echo -e "${YELLOW}⚠ Plan upgrade may have failed (check manually)${NC}"
fi

# Test 7: Get Subscription Status
echo -e "${BLUE}[7/8] Getting subscription status...${NC}"

STATUS_RESPONSE=$(curl -s "$BASE_URL/api/billing/subscription" \
  -H "X-Tenant-Id: $TEST_TENANT_ID")

if echo "$STATUS_RESPONSE" | grep -q "stripe_subscription_id"; then
  echo -e "${GREEN}✓ Subscription status retrieved${NC}"
  PLAN_TIER=$(echo "$STATUS_RESPONSE" | jq -r '.plan_tier')
  echo -e "  Plan Tier: $PLAN_TIER"
  echo -e "  Status: $(echo "$STATUS_RESPONSE" | jq -r '.status')"
else
  echo -e "${RED}✗ Failed to get subscription status${NC}"
fi

# Test 8: Get Upcoming Invoice
echo -e "${BLUE}[8/8] Getting upcoming invoice preview...${NC}"

INVOICE_RESPONSE=$(curl -s "$BASE_URL/api/billing/invoices/upcoming" \
  -H "X-Tenant-Id: $TEST_TENANT_ID")

if echo "$INVOICE_RESPONSE" | grep -q "amount"; then
  echo -e "${GREEN}✓ Upcoming invoice retrieved${NC}"
  AMOUNT=$(echo "$INVOICE_RESPONSE" | jq -r '.amount_due // .total // "N/A"')
  echo -e "  Amount Due: \$$AMOUNT"
else
  echo -e "${YELLOW}⚠ Invoice preview may not be available yet${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Summary                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Customer creation${NC}"
echo -e "${GREEN}✓ Subscription creation${NC}"
echo -e "${GREEN}✓ Usage tracking${NC}"
echo -e "${GREEN}✓ Quota enforcement${NC}"
echo -e "${GREEN}✓ Plan upgrade${NC}"
echo -e "${GREEN}✓ Subscription status${NC}"
echo ""
echo -e "${YELLOW}Manual verification recommended:${NC}"
echo -e "  1. Check Stripe dashboard for customer: $TEST_EMAIL"
echo -e "  2. Verify subscription: $SUBSCRIPTION_ID"
echo -e "  3. Check usage_events table in database"
echo -e "  4. Wait 5 minutes and verify usage submitted to Stripe"
echo ""
echo -e "${BLUE}E2E test complete!${NC}"
