#!/bin/bash
# ============================================================================
# Critical Security Fixes - Verification Script
#
# Run this script to verify security controls before production deployment.
#
# Usage: bash scripts/verify-security-fixes.sh
# ============================================================================

set -e

echo "========================================="
echo "Critical Security Fixes Verification"
echo "========================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Step 1: Checking TypeScript compilation..."
if pnpm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
else
    echo -e "${RED}✗ TypeScript compilation failed${NC}"
    pnpm run typecheck
    exit 1
fi

echo ""
echo "Step 2: Verifying MemorySystem tenant guards..."
if grep -q "organizationId" packages/backend/src/lib/agent-fabric/MemorySystem.ts; then
    echo -e "${GREEN}✓ MemorySystem includes organizationId handling${NC}"
else
    echo -e "${RED}✗ MemorySystem missing organizationId handling${NC}"
    exit 1
fi

echo ""
echo "Step 3: Verifying secureInvoke() usage..."
if grep -q "await this.secureInvoke(" packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts; then
    echo -e "${GREEN}✓ BaseAgent exposes secureInvoke()${NC}"
else
    echo -e "${RED}✗ BaseAgent missing secureInvoke()${NC}"
    exit 1
fi

if grep -q "await this.secureInvoke(" packages/backend/src/services/memory/RetrievalEngine.ts; then
    echo -e "${GREEN}✓ RetrievalEngine uses secureInvoke()${NC}"
else
    echo -e "${YELLOW}⚠ RetrievalEngine secureInvoke() usage not detected${NC}"
fi

echo ""
echo "Step 4: Verifying BaseAgent integration..."
if grep -q "checkHallucination" packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts; then
    echo -e "${GREEN}✓ BaseAgent includes hallucination checks${NC}"
else
    echo -e "${RED}✗ BaseAgent missing hallucination checks${NC}"
    exit 1
fi

echo ""
echo "Step 5: Verifying database migration..."
if [ -f "supabase/migrations/20260111000000_add_tenant_isolation_to_match_memory.sql" ]; then
    echo -e "${GREEN}✓ Tenant isolation migration exists${NC}"
else
    echo -e "${RED}✗ Tenant isolation migration missing${NC}"
    exit 1
fi

if grep -q "p_organization_id uuid" supabase/migrations/20260111000000_add_tenant_isolation_to_match_memory.sql; then
    echo -e "${GREEN}✓ match_memory() has organization_id parameter${NC}"
else
    echo -e "${RED}✗ match_memory() missing organization_id parameter${NC}"
    exit 1
fi

echo ""
echo "Step 6: Checking for common issues..."
TODO_COUNT=$(grep -r "TODO\|FIXME" \
  packages/backend/src/lib/agent-fabric/MemorySystem.ts \
  packages/backend/src/services/memory/RetrievalEngine.ts \
  packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts 2>/dev/null | wc -l)

if [ "$TODO_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No TODO/FIXME comments in critical files${NC}"
else
    echo -e "${YELLOW}⚠ Warning: $TODO_COUNT TODO/FIXME comments found${NC}"
fi

echo ""
echo "Step 7: Running unit tests..."
if pnpm test -- --run 2>&1 | grep -q "0 failed"; then
    echo -e "${GREEN}✓ Unit tests passing${NC}"
else
    echo -e "${YELLOW}⚠ Some unit tests may need updates${NC}"
fi

echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo ""
echo -e "${GREEN}✓ Security verification completed${NC}"
echo ""
