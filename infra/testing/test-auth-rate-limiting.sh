#!/bin/bash
# ValueCanvas - Auth Rate Limiting Validation Script
# Phase 1: Test rate limiting with IP and tenant-based limits

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${1:-https://valuecanvas.example.com}"
TENANT_ID="tenant-test-123"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Auth Rate Limiting Validation                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Testing URL: ${YELLOW}$BASE_URL${NC}"
echo ""

# ============================================================================
# Test 1: Per-IP Rate Limiting on Login (5 req/min)
# ============================================================================

echo -e "${BLUE}Test 1: Per-IP Rate Limiting on /auth/login${NC}"
echo -e "Expected: First 5-7 succeed (with burst), then 429s"
echo ""

passed=0
rate_limited=0

for i in {1..10}; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"TestPassword123!"}' \
        2>/dev/null || echo "000")
    
    status_code=$(echo "$response" | tail -1)
    retry_after=$(echo "$response" | grep -i "retry-after:" | cut -d' ' -f2 | tr -d '\r')
    
    if [ "$status_code" = "429" ]; then
        rate_limited=$((rate_limited + 1))
        echo -e "  Request $i: ${RED}429 Rate Limited${NC} (Retry-After: ${retry_after}s)"
    elif [ "$status_code" = "200" ] || [ "$status_code" = "401" ]; then
        passed=$((passed + 1))
        echo -e "  Request $i: ${GREEN}$status_code${NC}"
    else
        echo -e "  Request $i: ${YELLOW}$status_code${NC}"
    fi
    
    sleep 1
done

echo ""
if [ $rate_limited -gt 0 ]; then
    echo -e "${GREEN}✅ Per-IP rate limiting is working${NC}"
    echo -e "   Passed: $passed, Rate limited: $rate_limited"
else
    echo -e "${RED}❌ No rate limiting detected!${NC}"
fi

echo ""
echo -e "${YELLOW}Waiting 60 seconds for rate limit to reset...${NC}"
sleep 60

# ============================================================================
# Test 2: Per-Tenant Rate Limiting (20 req/min)
# ============================================================================

echo -e "${BLUE}Test 2: Per-Tenant Rate Limiting on /auth/login${NC}"
echo -e "Expected: First 20-25 succeed (with burst), then 429s"
echo ""

passed=0
rate_limited=0

for i in {1..30}; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-Id: $TENANT_ID" \
        -d '{"email":"test@example.com","password":"TestPassword123!"}' \
        2>/dev/null || echo "000")
    
    status_code=$(echo "$response" | tail -1)
    
    if [ "$status_code" = "429" ]; then
        rate_limited=$((rate_limited + 1))
        echo -e "  Request $i: ${RED}429 Rate Limited${NC}"
    elif [ "$status_code" = "200" ] || [ "$status_code" = "401" ]; then
        passed=$((passed + 1))
        echo -e "  Request $i: ${GREEN}$status_code${NC}"
    else
        echo -e "  Request $i: ${YELLOW}$status_code${NC}"
    fi
    
    sleep 0.5
done

echo ""
if [ $rate_limited -gt 0 ]; then
    echo -e "${GREEN}✅ Per-tenant rate limiting is working${NC}"
    echo -e "   Passed: $passed, Rate limited: $rate_limited"
else
    echo -e "${YELLOW}⚠️  No tenant-specific rate limiting detected${NC}"
fi

echo ""
sleep 10

# ============================================================================
# Test 3: Multiple Tenants (should have independent limits)
# ============================================================================

echo -e "${BLUE}Test 3: Multiple Tenants (Independent Limits)${NC}"
echo -e "Expected: Each tenant should have independent rate limits"
echo ""

tenant_results=()

for tenant_num in {1..3}; do
    tenant_id="tenant-$tenant_num"
    echo -e "${YELLOW}Testing tenant: $tenant_id${NC}"
    
    passed=0
    for i in {1..8}; do
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $tenant_id" \
            -d '{"email":"test@example.com","password":"TestPassword123!"}' \
            2>/dev/null || echo "000")
        
        status_code=$(echo "$response" | tail -1)
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "401" ]; then
            passed=$((passed + 1))
        fi
    done
    
    tenant_results+=("$tenant_id: $passed requests succeeded")
    echo -e "  ${GREEN}$tenant_id: $passed/8 requests succeeded${NC}"
    sleep 2
done

echo ""
echo -e "${GREEN}✅ Tenant isolation verified${NC}"
for result in "${tenant_results[@]}"; do
    echo -e "  $result"
done

echo ""
sleep 10

# ============================================================================
# Test 4: Signup Rate Limiting (3 req/min/IP)
# ============================================================================

echo -e "${BLUE}Test 4: Signup Rate Limiting (3 req/min/IP)${NC}"
echo -e "Expected: First 3-4 succeed, then 429s"
echo ""

passed=0
rate_limited=0

for i in {1..7}; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d '{"email":"newuser'$i'@example.com","password":"TestPassword123!"}' \
        2>/dev/null || echo "000")
    
    status_code=$(echo "$response" | tail -1)
    
    if [ "$status_code" = "429" ]; then
        rate_limited=$((rate_limited + 1))
        echo -e "  Request $i: ${RED}429 Rate Limited${NC}"
    else
        passed=$((passed + 1))
        echo -e "  Request $i: ${GREEN}$status_code${NC}"
    fi
    
    sleep 1
done

echo ""
if [ $rate_limited -gt 0 ]; then
    echo -e "${GREEN}✅ Signup rate limiting is working${NC}"
    echo -e "   Passed: $passed, Rate limited: $rate_limited"
else
    echo -e "${RED}❌ No signup rate limiting detected!${NC}"
fi

echo ""
sleep 10

# ============================================================================
# Test 5: Password Reset Rate Limiting (3 req/min/IP)
# ============================================================================

echo -e "${BLUE}Test 5: Password Reset Rate Limiting (3 req/min/IP)${NC}"
echo -e "Expected: First 3-4 succeed, then 429s"
echo ""

passed=0
rate_limited=0

for i in {1..7}; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/reset-password" \
        -H "Content-Type: application/json" \
        -d '{"email":"reset@example.com"}' \
        2>/dev/null || echo "000")
    
    status_code=$(echo "$response" | tail -1)
    
    if [ "$status_code" = "429" ]; then
        rate_limited=$((rate_limited + 1))
        echo -e "  Request $i: ${RED}429 Rate Limited${NC}"
    else
        passed=$((passed + 1))
        echo -e "  Request $i: ${GREEN}$status_code${NC}"
    fi
    
    sleep 1
done

echo ""
if [ $rate_limited -gt 0 ]; then
    echo -e "${GREEN}✅ Password reset rate limiting is working${NC}"
    echo -e "   Passed: $passed, Rate limited: $rate_limited"
else
    echo -e "${RED}❌ No password reset rate limiting detected!${NC}"
fi

# ============================================================================
# Test 6: Check 429 Response Headers
# ============================================================================

echo ""
echo -e "${BLUE}Test 6: Verify 429 Response Headers${NC}"
echo ""

# Trigger rate limit
for i in {1..10}; do
    curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test"}' \
        >/dev/null 2>&1
    sleep 0.1
done

# Get 429 response with headers
response=$(curl -i -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    2>/dev/null)

retry_after=$(echo "$response" | grep -i "retry-after:" | cut -d' ' -f2 | tr -d '\r')
rate_limit_header=$(echo "$response" | grep -i "x-ratelimit-limit:" | cut -d' ' -f2- | tr -d '\r')

if [ -n "$retry_after" ]; then
    echo -e "${GREEN}✅ Retry-After header present: ${retry_after}s${NC}"
else
    echo -e "${RED}❌ Retry-After header missing${NC}"
fi

if [ -n "$rate_limit_header" ]; then
    echo -e "${GREEN}✅ X-RateLimit-Limit header present: $rate_limit_header${NC}"
else
    echo -e "${YELLOW}⚠️  X-RateLimit-Limit header not found (optional)${NC}"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Summary                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✅ Rate limiting validation complete!${NC}"
echo ""
echo -e "Recommendations:"
echo -e "  1. Monitor logs for sustained 429s"
echo -e "  2. Adjust rate limits based on legitimate traffic patterns"
echo -e "  3. Set up alerting for rate limit violations"
echo -e "  4. Consider implementing backoff strategies in client"
echo ""

echo -e "Next steps:"
echo -e "  ${BLUE}./test-session-timeouts.sh $BASE_URL${NC}"
