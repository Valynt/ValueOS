#!/bin/bash

# SEC-004: Fix Console.log Statements
# This script finds and reports all console.log statements that need to be fixed

echo "🔍 SEC-004: Scanning for console.log statements..."
echo ""

# Find all console.log statements
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.error\|console\.warn\|console\.debug" src --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|stories\|node_modules")

if [ -z "$CONSOLE_LOGS" ]; then
  echo "✅ No console.log statements found!"
  exit 0
fi

echo "🔴 Found console.log statements that need to be fixed:"
echo ""
echo "$CONSOLE_LOGS"
echo ""

# Count occurrences
COUNT=$(echo "$CONSOLE_LOGS" | wc -l)
echo "📊 Total: $COUNT statements found"
echo ""

echo "📋 Files to fix:"
echo "$CONSOLE_LOGS" | cut -d: -f1 | sort | uniq
echo ""

echo "🔧 To fix these issues:"
echo "1. Replace console.log with: import { log } from './lib/logger';"
echo "2. Use: log.info('message', sanitizeForLogging(context));"
echo "3. Never log: user objects, request bodies, passwords, tokens"
echo ""

echo "Example fix:"
echo "// BEFORE:"
echo "console.log('User data:', user);"
echo ""
echo "// AFTER:"
echo "import { log } from './lib/logger';"
echo "import { sanitizeUser } from './lib/piiFilter';"
echo "log.info('User action', sanitizeUser(user));"
