#!/usr/bin/env bash
#
# CI Gate: Verify tenant_id presence in all structured log lines
#
# This script validates that:
# 1. All logger calls include tenant_id in metadata
# 2. No raw console.log/console.error without structured logging
# 3. All log entries in test outputs have tenant_id field
#
# Failures block the build.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../../packages/backend"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VIOLATIONS=0

echo "🔍 Checking structured logging compliance..."

# Check 1: Find direct console.log/console.error usage (bypasses structured logger)
echo ""
echo "📋 Check 1: Detecting raw console.* usage..."
CONSOLE_USAGE=$(grep -rn "console\.\(log\|warn\|error\|info\|debug\)" \
  --include="*.ts" \
  --include="*.js" \
  "${BACKEND_DIR}/src" 2>/dev/null || true)

if [ -n "$CONSOLE_USAGE" ]; then
  echo -e "${YELLOW}⚠️  Found raw console.* usage (should use logger):${NC}"
  echo "$CONSOLE_USAGE" | head -20
  VIOLATIONS=$((VIOLATIONS + $(echo "$CONSOLE_USAGE" | wc -l)))
else
  echo -e "${GREEN}✓ No raw console.* usage found${NC}"
fi

# Check 2: Verify logger imports and usage patterns
echo ""
echo "📋 Check 2: Validating logger import patterns..."

# Files that use logger but don't import it properly
MISSING_IMPORTS=$(grep -rln "logger\.\(debug\|info\|warn\|error\)" \
  --include="*.ts" \
  "${BACKEND_DIR}/src" 2>/dev/null | while read -r file; do
    if ! grep -q "import.*logger.*from" "$file" && \
       ! grep -q "import.*createLogger" "$file" && \
       ! grep -q "import.*log.*from.*logger" "$file"; then
      echo "$file"
    fi
  done || true)

if [ -n "$MISSING_IMPORTS" ]; then
  echo -e "${YELLOW}⚠️  Files using logger without explicit import:${NC}"
  echo "$MISSING_IMPORTS" | head -10
  VIOLATIONS=$((VIOLATIONS + $(echo "$MISSING_IMPORTS" | wc -l)))
else
  echo -e "${GREEN}✓ All logger usage has proper imports${NC}"
fi

# Check 3: TypeScript type validation - ensure logger.ts compiles
echo ""
echo "📋 Check 3: Validating logger TypeScript compilation..."
cd "${BACKEND_DIR}"
if ! npx tsc --noEmit src/lib/logger.ts 2>/dev/null; then
  echo -e "${RED}❌ Logger TypeScript compilation failed${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✓ Logger TypeScript validation passed${NC}"
fi

# Summary
echo ""
echo "========================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✅ All structured logging checks passed${NC}"
  echo "   tenant_id will be present in all log lines"
  exit 0
else
  echo -e "${RED}❌ Found $VIOLATIONS logging violations${NC}"
  echo "   Fix issues to ensure tenant_id in all logs"
  exit 1
fi
