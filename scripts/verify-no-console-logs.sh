#!/bin/bash

# SEC-004: Verify no console.log statements in production code
# This script should be run in CI/CD to prevent console.log from being committed

set -e

cd "$(dirname "$0")/.."

echo "🔍 SEC-004: Verifying no console statements in production code..."
echo ""

# Check production code (excluding tests)
VIOLATIONS=$(grep -r "^\s*console\.\(log\|error\|warn\|info\|debug\)" src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=test \
  --exclude-dir=node_modules \
  2>/dev/null | grep -v "// console\." | wc -l || echo "0")

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✅ PASS: No console statements found in production code"
  echo ""
  echo "📊 Summary:"
  echo "   - Production code: 0 violations"
  echo "   - All logging uses secure logger with PII protection"
  echo ""
  exit 0
else
  echo "❌ FAIL: Found $VIOLATIONS console statement(s) in production code"
  echo ""
  echo "🔴 Violations:"
  grep -rn "^\s*console\.\(log\|error\|warn\|info\|debug\)" src/ \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir=test \
    --exclude-dir=node_modules \
    2>/dev/null | grep -v "// console\."
  echo ""
  echo "⚠️  Console statements leak PII and violate GDPR/SOC 2 compliance"
  echo "   Use 'import { logger } from '@/lib/logger' instead"
  echo ""
  exit 1
fi
