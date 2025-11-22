#!/bin/bash

# SEC-004: Bulk replace console.log statements
# This script performs automated replacements for simple patterns

set -e

cd /workspaces/ValueCanvas

echo "🔧 SEC-004: Bulk replacing console statements..."
echo ""

# Count before
BEFORE=$(grep -r "console\.\(log\|error\|warn\)" src/ --include="*.ts" --include="*.tsx" | wc -l)
echo "📊 Console statements before: $BEFORE"
echo ""

# Backup
BACKUP_DIR="/tmp/valuecanvas-bulk-backup-$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/"
echo "📦 Backup created: $BACKUP_DIR"
echo ""

# Process remaining agent files
echo "🤖 Processing agent files..."

for file in src/agents/*.ts; do
  if [ -f "$file" ]; then
    # Add logger import if not present
    if ! grep -q "import.*logger.*from.*lib/logger" "$file"; then
      # Find first import line
      first_import=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
      if [ -n "$first_import" ]; then
        sed -i "${first_import}i import { logger } from '../lib/logger';" "$file"
      fi
    fi
    
    # Replace simple console.log patterns
    sed -i "s/console\.log(\`\[\${this\.agentName}\] \(.*\)\`);/logger.debug('\1', { agent: this.agentName });/g" "$file"
    sed -i "s/console\.log(\`\[\${this\.agentName}\] \(.*\)\.\.\.\`);/logger.debug('\1', { agent: this.agentName });/g" "$file"
  fi
done

# Process service files
echo "🔧 Processing service files..."

for file in src/services/*.ts; do
  if [ -f "$file" ] && [ "$(basename "$file")" != "examples.ts" ]; then
    # Add logger import if not present
    if ! grep -q "import.*logger.*from.*lib/logger" "$file"; then
      first_import=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
      if [ -n "$first_import" ]; then
        sed -i "${first_import}i import { logger } from '../lib/logger';" "$file"
      fi
    fi
    
    # Replace console.error in catch blocks
    sed -i "s/console\.error('\(.*\):', error);/logger.error('\1', error instanceof Error ? error : undefined);/g" "$file"
    sed -i 's/console\.error("\(.*\):", error);/logger.error("\1", error instanceof Error ? error : undefined);/g' "$file"
    
    # Replace console.warn
    sed -i "s/console\.warn('\(.*\)');/logger.warn('\1');/g" "$file"
    sed -i 's/console\.warn("\(.*\)");/logger.warn("\1");/g' "$file"
  fi
done

# Process workflow files
echo "📋 Processing workflow files..."

if [ -d "src/services/workflows" ]; then
  for file in src/services/workflows/*.ts; do
    if [ -f "$file" ]; then
      # Add logger import if not present
      if ! grep -q "import.*logger.*from.*lib/logger" "$file"; then
        first_import=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
        if [ -n "$first_import" ]; then
          sed -i "${first_import}i import { logger } from '../../lib/logger';" "$file"
        fi
      fi
      
      # Replace console patterns
      sed -i "s/console\.error('\(.*\):', error);/logger.error('\1', error instanceof Error ? error : undefined);/g" "$file"
      sed -i "s/console\.warn(\`\(.*\)\`);/logger.warn('\1');/g" "$file"
      sed -i "s/console\.log(\`\(.*\)\`);/logger.debug('\1');/g" "$file"
    fi
  done
fi

echo ""
echo "✅ Bulk replacement complete!"
echo ""

# Count after
AFTER=$(grep -r "console\.\(log\|error\|warn\)" src/ --include="*.ts" --include="*.tsx" | wc -l)
echo "📊 Console statements after: $AFTER"
echo "📉 Reduced by: $((BEFORE - AFTER)) statements"
echo ""
echo "⚠️  Remaining statements require manual review"
echo "📁 Backup: $BACKUP_DIR"
