#!/bin/bash
# remediation-critical-issues.sh
# Security hardening script that runs before test suite
# Fails the build on critical security deviations

set -euo pipefail

echo "🔒 Running Security Hardening Checks..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Check 1: No hardcoded secrets in service files
echo "🔍 Checking for hardcoded secrets..."
if grep -rE "(password|secret|api_key|private_key)\s*[=:]\s*[\"'][^\"']{8,}[\"']" \
  --include="*.ts" packages/backend/src/services/ 2>/dev/null | \
  grep -vE "(test|spec|fixture|mock|example|placeholder|YOUR_)" | \
  grep -v "^\s*//" | \
  grep -v "^\s*\*" | head -20; then
  echo -e "${RED}❌ FAIL: Potential hardcoded secrets detected${NC}"
  FAILED=1
else
  echo -e "${GREEN}✅ No hardcoded secrets found${NC}"
fi

# Check 2: No SQL injection vulnerabilities
echo "🔍 Checking for SQL injection patterns..."
if grep -rE "(\\\$\\{.*\}|\+.*\+|concat|sprintf).*\\\bfrom\\b|\\\bwhere\\b" \
  --include="*.ts" packages/backend/src/services/ 2>/dev/null | \
  grep -vE "(test|spec|fixture)" | head -10; then
  echo -e "${YELLOW}⚠️  WARNING: Potential SQL injection patterns (review required)${NC}"
fi

# Check 3: All services use tenant isolation
echo "🔍 Verifying tenant isolation patterns..."
SERVICES_WITHOUT_TENANT=$(grep -rL "tenant_id\|organization_id" \
  --include="*.ts" packages/backend/src/services/*/ 2>/dev/null | \
  grep -vE "(test|spec|index|types)" || true)

if [ -n "$SERVICES_WITHOUT_TENANT" ]; then
  echo -e "${YELLOW}⚠️  Services without tenant isolation pattern:${NC}"
  echo "$SERVICES_WITHOUT_TENANT"
fi

# Check 4: ESLint compliance for agent patterns
echo "🔍 Checking ESLint agent pattern compliance..."
cd packages/backend
if pnpm exec eslint src/services/ --ext .ts --quiet 2>/dev/null; then
  echo -e "${GREEN}✅ ESLint checks passed${NC}"
else
  echo -e "${YELLOW}⚠️  ESLint warnings detected${NC}"
fi
cd ../..

# Check 5: Verify no console.log in production code
echo "🔍 Checking for console.log statements..."
if grep -rE "^\s*console\.(log|debug|warn|error)" \
  --include="*.ts" packages/backend/src/services/ 2>/dev/null | \
  grep -vE "(test|spec|__tests__|logger\.error|logger\.warn)" | head -10; then
  echo -e "${YELLOW}⚠️  WARNING: console.log statements found (should use structured logger)${NC}"
fi

# Check 6: Validate test files exist for all services
echo "🔍 Validating test coverage..."
SERVICES=$(find packages/backend/src/services -name "*.ts" -not -path "*/__tests__/*" -not -name "index.ts" -not -name "*.d.ts" | grep -vE "(test|spec)" | sort)
MISSING_TESTS=0

for service in $SERVICES; do
  service_name=$(basename "$service" .ts)
  test_file="packages/backend/src/services/__tests__/$(dirname "$service" | sed 's|packages/backend/src/services/||')/${service_name}.test.ts"

  if [ ! -f "$test_file" ]; then
    echo -e "${YELLOW}⚠️  Missing test: $test_file${NC}"
    MISSING_TESTS=$((MISSING_TESTS + 1))
  fi
done

if [ $MISSING_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All services have test coverage${NC}"
fi

# Check 7: Security fixtures validation
echo "🔍 Validating security test fixtures..."
if [ -f "packages/backend/src/services/__tests__/fixtures/securityFixtures.ts" ]; then
  echo -e "${GREEN}✅ Security fixtures exist${NC}"
else
  echo -e "${RED}❌ FAIL: Security fixtures not found${NC}"
  FAILED=1
fi

# Check 8: Zod schema validation in services
echo "🔍 Checking Zod schema validation..."
if grep -r "z\.object\|z\.string\|z\.number" \
  --include="*.ts" packages/backend/src/services/ 2>/dev/null | \
  grep -vE "(test|spec|__tests__|node_modules)" | head -5 > /dev/null; then
  echo -e "${GREEN}✅ Zod validation patterns found${NC}"
else
  echo -e "${YELLOW}⚠️  Limited Zod validation detected${NC}"
fi

# Summary
echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Security Hardening Checks Passed${NC}"
  echo "Proceeding with test suite execution..."
  exit 0
else
  echo -e "${RED}❌ Security Hardening Checks Failed${NC}"
  echo "Fix critical issues before running tests"
  exit 1
fi
