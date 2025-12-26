#!/bin/bash

# Agent Security Test Suite Runner
# Executes all security-related tests for the 8 fixed production agents

set -e

echo "🔒 Agent Security Test Suite"
echo "============================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test file
run_test() {
  local test_file=$1
  local test_name=$2
  
  echo -e "${YELLOW}Running: ${test_name}${NC}"
  
  if npx vitest run "$test_file" --reporter=verbose; then
    echo -e "${GREEN}✓ PASSED: ${test_name}${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAILED: ${test_name}${NC}"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

echo "📋 Phase 1: Individual Agent Security Tests"
echo "-------------------------------------------"

run_test "src/lib/agent-fabric/agents/__tests__/OpportunityAgent.test.ts" "OpportunityAgent"
run_test "src/lib/agent-fabric/agents/__tests__/TargetAgent.test.ts" "TargetAgent"
run_test "src/lib/agent-fabric/agents/__tests__/RealizationAgent.security.test.ts" "RealizationAgent Security"
run_test "src/lib/agent-fabric/agents/__tests__/ExpansionAgent.security.test.ts" "ExpansionAgent Security"
run_test "src/lib/agent-fabric/agents/__tests__/FinancialModelingAgent.security.test.ts" "FinancialModelingAgent Security"
run_test "src/lib/agent-fabric/agents/__tests__/CompanyIntelligence.ValueMapping.security.test.ts" "CompanyIntelligence & ValueMapping"

echo ""
echo "📋 Phase 2: Integration Tests"
echo "------------------------------"

run_test "src/lib/agent-fabric/agents/__tests__/AgentSecurity.integration.test.ts" "Cross-Tenant Isolation & Circuit Breaker"

echo ""
echo "📋 Phase 3: Memory System Tenant Isolation"
echo "------------------------------------------"

run_test "test/lib/agent-fabric/MemorySystem.tenant-isolation.test.ts" "MemorySystem Tenant Isolation"

echo ""
echo "📋 Phase 4: Security Verification Commands"
echo "------------------------------------------"

echo -e "${YELLOW}Checking for direct llmGateway.complete() calls...${NC}"
DIRECT_CALLS=$(grep -r "llmGateway\.complete" src/lib/agent-fabric/agents/*.ts | grep -v "BaseAgent.ts" | grep -v "//" | wc -l || echo "0")

if [ "$DIRECT_CALLS" -eq 0 ]; then
  echo -e "${GREEN}✓ No direct llmGateway.complete() calls found${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ Found $DIRECT_CALLS direct llmGateway.complete() calls${NC}"
  grep -r "llmGateway\.complete" src/lib/agent-fabric/agents/*.ts | grep -v "BaseAgent.ts" | grep -v "//"
  ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}Checking for organizationId in memory calls...${NC}"
MEMORY_CALLS=$(grep -A 5 "memorySystem.storeSemanticMemory" src/lib/agent-fabric/agents/*.ts | grep "organizationId" | wc -l || echo "0")

if [ "$MEMORY_CALLS" -ge 8 ]; then
  echo -e "${GREEN}✓ All memory calls include organizationId ($MEMORY_CALLS found)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ Missing organizationId in some memory calls (found $MEMORY_CALLS, expected >= 8)${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}Checking for Zod schema usage...${NC}"
ZOD_IMPORTS=$(grep "import.*zod" src/lib/agent-fabric/agents/*.ts | wc -l || echo "0")

if [ "$ZOD_IMPORTS" -ge 7 ]; then
  echo -e "${GREEN}✓ Zod schemas implemented ($ZOD_IMPORTS imports found)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ Missing Zod imports (found $ZOD_IMPORTS, expected >= 7)${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}Running TypeScript type check...${NC}"

if npm run typecheck -- --noEmit src/lib/agent-fabric/agents/*.ts 2>&1 | grep -q "Found 0 errors"; then
  echo -e "${GREEN}✓ No TypeScript errors in agent files${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ TypeScript errors found${NC}"
  npm run typecheck -- --noEmit src/lib/agent-fabric/agents/*.ts || true
  ((TESTS_FAILED++))
fi

echo ""
echo "============================"
echo "📊 Test Results Summary"
echo "============================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL SECURITY TESTS PASSED${NC}"
  echo ""
  echo "Ready for staging deployment:"
  echo "  1. Run: bash scripts/cleanup-legacy-agents.sh"
  echo "  2. Run: npm run test:rls"
  echo "  3. Deploy to staging"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SECURITY TESTS FAILED${NC}"
  echo "Fix failing tests before deployment"
  exit 1
fi
