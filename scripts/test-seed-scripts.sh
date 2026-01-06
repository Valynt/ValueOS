#!/bin/bash
# Test Seed Scripts
# Purpose: Verify seed scripts work correctly and securely
# Usage: ./scripts/test-seed-scripts.sh

set -e  # Exit on error

echo "============================================================"
echo "Testing Seed Scripts"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -n "Testing: $test_name... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
  fi
}

# Function to test environment check
test_env_check() {
  local script="$1"
  local test_name="$2"
  
  echo -n "Testing: $test_name environment check... "
  
  # Try to run in production mode (should fail)
  if NODE_ENV=production $script 2>&1 | grep -q "production"; then
    echo -e "${GREEN}✅ PASS${NC} (correctly blocks production)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (does not block production)"
    ((TESTS_FAILED++))
  fi
}

echo "1. Checking seed script files exist..."
echo "----------------------------------------"

run_test "seed_database.ts exists" "test -f scripts/seed_database.ts"
run_test "create_dummy_user.sql exists" "test -f scripts/seeds/create_dummy_user.sql"
run_test "prisma/seed.ts exists" "test -f prisma/seed.ts"

echo ""
echo "2. Checking for hardcoded credentials..."
echo "----------------------------------------"

# Check for hardcoded passwords
if grep -r "password.*=.*['\"].*123" scripts/seed_database.ts scripts/seeds/ prisma/seed.ts 2>/dev/null; then
  echo -e "${RED}❌ FAIL${NC} Found hardcoded passwords"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✅ PASS${NC} No hardcoded passwords found"
  ((TESTS_PASSED++))
fi

# Check for hardcoded API keys
if grep -r "api.*key.*=.*['\"]sk_" scripts/seed_database.ts scripts/seeds/ prisma/seed.ts 2>/dev/null | grep -v "sk_dev_"; then
  echo -e "${RED}❌ FAIL${NC} Found hardcoded API keys"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✅ PASS${NC} No hardcoded API keys found"
  ((TESTS_PASSED++))
fi

# Check for predictable UUIDs
if grep -r "00000000-0000-0000-0000" scripts/seed_database.ts scripts/seeds/ prisma/seed.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  WARN${NC} Found predictable UUIDs (check if intentional)"
else
  echo -e "${GREEN}✅ PASS${NC} No predictable UUIDs found"
  ((TESTS_PASSED++))
fi

echo ""
echo "3. Checking for environment validation..."
echo "----------------------------------------"

# Check seed_database.ts has environment check
if grep -q "NODE_ENV.*production" scripts/seed_database.ts; then
  echo -e "${GREEN}✅ PASS${NC} seed_database.ts has environment check"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} seed_database.ts missing environment check"
  ((TESTS_FAILED++))
fi

# Check create_dummy_user.sql has environment check
if grep -q "app.environment.*production" scripts/seeds/create_dummy_user.sql; then
  echo -e "${GREEN}✅ PASS${NC} create_dummy_user.sql has environment check"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} create_dummy_user.sql missing environment check"
  ((TESTS_FAILED++))
fi

# Check prisma/seed.ts has environment check
if grep -q "NODE_ENV.*production" prisma/seed.ts; then
  echo -e "${GREEN}✅ PASS${NC} prisma/seed.ts has environment check"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} prisma/seed.ts missing environment check"
  ((TESTS_FAILED++))
fi

echo ""
echo "4. Checking for secure password generation..."
echo "----------------------------------------"

# Check for generateSecurePassword or similar
if grep -q "generateSecurePassword\|crypto.randomBytes" scripts/seed_database.ts; then
  echo -e "${GREEN}✅ PASS${NC} seed_database.ts uses secure password generation"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} seed_database.ts missing secure password generation"
  ((TESTS_FAILED++))
fi

if grep -q "generateSecurePassword\|crypto.randomBytes" prisma/seed.ts; then
  echo -e "${GREEN}✅ PASS${NC} prisma/seed.ts uses secure password generation"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} prisma/seed.ts missing secure password generation"
  ((TESTS_FAILED++))
fi

echo ""
echo "5. Checking for bcrypt usage..."
echo "----------------------------------------"

# Check for bcrypt in prisma/seed.ts
if grep -q "bcrypt" prisma/seed.ts; then
  echo -e "${GREEN}✅ PASS${NC} prisma/seed.ts uses bcrypt for password hashing"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} prisma/seed.ts not using bcrypt"
  ((TESTS_FAILED++))
fi

echo ""
echo "6. Checking for environment variable usage..."
echo "----------------------------------------"

# Check for SEED_ADMIN_PASSWORD usage
if grep -q "SEED_ADMIN_PASSWORD" scripts/seed_database.ts prisma/seed.ts; then
  echo -e "${GREEN}✅ PASS${NC} Scripts support environment variable passwords"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} Scripts don't support environment variable passwords"
  ((TESTS_FAILED++))
fi

echo ""
echo "7. Checking for credential logging..."
echo "----------------------------------------"

# Check that credentials are only logged in development
if grep -q "NODE_ENV.*development.*console.log.*password\|if.*development.*password" scripts/seed_database.ts prisma/seed.ts; then
  echo -e "${GREEN}✅ PASS${NC} Credentials only logged in development"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️  WARN${NC} Credential logging not conditional on environment"
fi

echo ""
echo "============================================================"
echo "Test Summary"
echo "============================================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Seed scripts are secure and ready to use."
  exit 0
else
  echo -e "${RED}❌ Some tests failed!${NC}"
  echo ""
  echo "Please fix the issues above before using seed scripts."
  exit 1
fi
