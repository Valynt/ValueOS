#!/bin/bash
# Security Scan Script for ValueOS
# Runs security checks and vulnerability scans

set -e

echo "🔒 Running ValueOS Security Scan..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

HIGH_SEVERITY_FINDINGS=0

echo "1️⃣  Checking for hardcoded secrets..."
if grep -r "password\|secret\|api_key\|private_key" --include="*.ts" --include="*.js" packages/backend/src/ 2>/dev/null | grep -v "test\|mock\|fixture\|\.test\.\|example\|placeholder" | grep -E "(=\s*['\"][^'\"]+['\"]|:\s*['\"][^'\"]+['\"])" || true; then
    echo -e "${YELLOW}⚠️  Potential hardcoded strings found - review manually${NC}"
else
    echo -e "${GREEN}✓ No obvious hardcoded secrets found${NC}"
fi

echo ""
echo "2️⃣  Running RLS security tests..."
if pnpm run test:rls 2>&1 | grep -q "FAIL"; then
    echo -e "${RED}❌ RLS tests failed${NC}"
    HIGH_SEVERITY_FINDINGS=$((HIGH_SEVERITY_FINDINGS + 1))
else
    echo -e "${GREEN}✓ RLS tests passed${NC}"
fi

echo ""
echo "3️⃣  Checking for SQL injection vulnerabilities..."
if grep -r "\.query\s*(\s*['\"].*\$" --include="*.ts" packages/backend/src/ 2>/dev/null || true; then
    echo -e "${YELLOW}⚠️  Potential SQL injection patterns - review manually${NC}"
else
    echo -e "${GREEN}✓ No obvious SQL injection patterns${NC}"
fi

echo ""
echo "4️⃣  Checking for insecure direct object references..."
if grep -r "req\.params\|req\.query.*id" --include="*.ts" packages/backend/src/routes/ 2>/dev/null | grep -v "tenant\|organization" | head -5 || true; then
    echo -e "${YELLOW}⚠️  Review route handlers for IDOR protection${NC}"
else
    echo -e "${GREEN}✓ Route handlers appear to have tenant checks${NC}"
fi

echo ""
echo "5️⃣  Running dependency audit..."
pnpm audit --audit-level=high 2>/dev/null || true

echo ""
echo "6️⃣  Checking for any-type usage in strict zones..."
if grep -r ": any" --include="*.ts" packages/backend/src/services/ 2>/dev/null | grep -v "test\|mock" | head -10 || true; then
    echo -e "${YELLOW}⚠️  'any' types found - review for strict typing${NC}"
else
    echo -e "${GREEN}✓ No 'any' types in service files${NC}"
fi

echo ""
echo "=========================================="
if [ $HIGH_SEVERITY_FINDINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Security scan complete - 0 high-severity findings${NC}"
    exit 0
else
    echo -e "${RED}❌ Security scan found $HIGH_SEVERITY_FINDINGS high-severity issues${NC}"
    exit 1
fi
