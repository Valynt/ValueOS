#!/bin/bash
#
# Phase 5: Comprehensive Test Suite Runner
# Executes all critical tests for tenant settings system
#

set -e

echo "🧪 Phase 5: Running Comprehensive Test Suite"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test suite
run_test_suite() {
  local name="$1"
  local command="$2"
  
  echo -e "${YELLOW}Running: $name${NC}"
  echo "Command: $command"
  echo ""
  
  if eval "$command"; then
    echo -e "${GREEN}✓ $name PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ $name FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo ""
  echo "---"
  echo ""
}

# 1. Settings Cascade Tests
run_test_suite \
  "Settings Cascade Logic" \
  "pnpm test -- src/lib/__tests__/settingsCascade.test.ts --run"

# 2. Sanitization Tests
run_test_suite \
  "XSS Prevention & Sanitization" \
  "pnpm test -- src/utils/__tests__/sanitization.test.ts --run"

# 3. MFA Recovery Tests
run_test_suite \
  "MFA Backup Code Security" \
  "pnpm test -- src/views/Settings/__tests__/MFARecovery.test.ts --run"

# 4. RLS Cross-Tenant Tests (if database tests are available)
if [ -f "supabase/tests/database/settings_rls_cross_tenant.test.sql" ]; then
  run_test_suite \
    "RLS Cross-Tenant Isolation" \
    "pnpm run test:db -- settings_rls_cross_tenant"
else
  echo -e "${YELLOW}⚠ Skipping RLS tests (database tests not configured)${NC}"
  echo ""
fi

# Summary
echo "=============================================="
echo "📊 Test Suite Summary"
echo "=============================================="
echo ""
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All test suites passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some test suites failed${NC}"
  exit 1
fi
