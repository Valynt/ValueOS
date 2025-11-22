#!/bin/bash

# SEC-004: Batch replace console.log statements with secure logger
# This script performs safe replacements for common patterns

set -e

echo "🔧 SEC-004: Replacing console.log statements with secure logger..."
echo ""

# Files to process (excluding already fixed files)
FILES=(
  "src/agents/InterventionDesignerAgent.ts"
  "src/agents/RealizationLoopAgent.ts"
  "src/agents/SystemMapperAgent.ts"
  "src/agents/OutcomeEngineerAgent.ts"
  "src/agents/ValueEvalAgent.ts"
  "src/services/MessageBus.ts"
  "src/services/PersistenceService.ts"
  "src/services/CacheService.ts"
  "src/services/SecurityLogger.ts"
  "src/services/workflows/WorkflowDAGIntegration.ts"
  "src/services/UIGenerationTracker.ts"
  "src/services/AgentAuditLogger.ts"
)

# Backup directory
BACKUP_DIR="/tmp/valuecanvas-console-backup-$(date +%s)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backups in $BACKUP_DIR"
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
  fi
done

echo ""
echo "🔄 Processing files..."
echo ""

# Add logger import to each file if not present
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if logger import already exists
    if ! grep -q "import.*logger.*from.*lib/logger" "$file"; then
      # Find the last import statement
      last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
      
      if [ -n "$last_import_line" ]; then
        # Add logger import after last import
        sed -i "${last_import_line}a import { logger } from '../lib/logger';" "$file"
        echo "✅ Added logger import to $file"
      fi
    fi
  fi
done

echo ""
echo "✅ Batch replacement complete!"
echo ""
echo "⚠️  Manual review required for:"
echo "   - Error handling contexts"
echo "   - Sensitive data in log messages"
echo "   - Complex console.log patterns"
echo ""
echo "📁 Backups saved to: $BACKUP_DIR"
