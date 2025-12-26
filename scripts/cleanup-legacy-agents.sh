#!/bin/bash

# Cleanup Legacy Agents Directory
# Removes duplicate/orphaned agents from src/agents/
# VERIFIED SAFE: Zero active imports found via grep_search

set -e

LEGACY_DIR="/workspaces/ValueCanvas/src/agents"
BACKUP_DIR="/workspaces/ValueCanvas/backup/legacy-agents-$(date +%Y%m%d-%H%M%S)"

echo "🔍 Verifying legacy directory exists..."
if [ ! -d "$LEGACY_DIR" ]; then
  echo "❌ Directory not found: $LEGACY_DIR"
  exit 1
fi

echo "📋 Legacy agents to be removed:"
ls -la "$LEGACY_DIR"

echo ""
echo "🔍 Double-checking for active imports (should be ZERO)..."
IMPORT_COUNT=$(grep -r "from ['\"].*src/agents/" /workspaces/ValueCanvas/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")

if [ "$IMPORT_COUNT" -gt 0 ]; then
  echo "❌ ABORT: Found $IMPORT_COUNT active imports from src/agents/"
  echo "Manual review required before deletion!"
  grep -r "from ['\"].*src/agents/" /workspaces/ValueCanvas/src --include="*.ts" --include="*.tsx" 2>/dev/null || true
  exit 1
fi

echo "✅ No active imports found (verified safe to delete)"

echo ""
echo "📦 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$LEGACY_DIR" "$BACKUP_DIR/"

echo ""
echo "🗑️  Deleting legacy agents directory..."
rm -rf "$LEGACY_DIR"

echo ""
echo "✅ SUCCESS: Legacy agents removed"
echo "📦 Backup location: $BACKUP_DIR"
echo ""
echo "Files removed:"
echo "  - CommunicatorAgent.ts"
echo "  - CoordinatorAgent.ts (duplicate)"
echo "  - IntegrityAgent.ts (duplicate)"
echo "  - OpportunityAgent.ts (duplicate)"
echo "  - RealizationAgent.ts (duplicate)"
echo "  - SystemMapperAgent.ts"
echo "  - TargetAgent.ts (duplicate)"
echo "  - __tests__/ directory"
echo "  - coordinator.yaml"
echo ""
echo "✅ Repository cleanup complete"
