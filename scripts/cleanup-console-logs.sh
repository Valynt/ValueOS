#!/bin/bash

# Console.log Cleanup Script
# Finds and reports all console.log/info/debug statements in source code

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║    🔍 Console Statement Cleanup Report                       ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find all console.log statements (excluding allowed console.warn and console.error)
echo "📊 Scanning for console statements..."
echo ""

CONSOLE_LOG=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -n "console\.log" {} + | wc -l || echo "0")
CONSOLE_INFO=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -n "console\.info" {} + | wc -l || echo "0")
CONSOLE_DEBUG=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -n "console\.debug" {} + | wc -l || echo "0")
CONSOLE_WARN=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -n "console\.warn" {} + | wc -l || echo "0")
CONSOLE_ERROR=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -n "console\.error" {} + | wc -l || echo "0")

TOTAL=$((CONSOLE_LOG + CONSOLE_INFO + CONSOLE_DEBUG))
ALLOWED=$((CONSOLE_WARN + CONSOLE_ERROR))

echo "Results:"
echo "--------"
echo -e "${RED}console.log:${NC}   $CONSOLE_LOG occurrences"
echo -e "${RED}console.info:${NC}  $CONSOLE_INFO occurrences"
echo -e "${RED}console.debug:${NC} $CONSOLE_DEBUG occurrences"
echo -e "${GREEN}console.warn:${NC}  $CONSOLE_WARN occurrences (allowed)"
echo -e "${GREEN}console.error:${NC} $CONSOLE_ERROR occurrences (allowed)"
echo ""
echo -e "${YELLOW}Total to fix:${NC} $TOTAL"
echo ""

if [ "$TOTAL" -gt 0 ]; then
    echo "📍 Locations:"
    echo ""
    
    # Show files with console.log
    if [ "$CONSOLE_LOG" -gt 0 ]; then
        echo -e "${RED}console.log found in:${NC}"
        find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\.log" {} + || true
        echo ""
    fi
    
    # Show files with console.info
    if [ "$CONSOLE_INFO" -gt 0 ]; then
        echo -e "${RED}console.info found in:${NC}"
        find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\.info" {} + || true
        echo ""
    fi
    
    # Show files with console.debug
    if [ "$CONSOLE_DEBUG" -gt 0 ]; then
        echo -e "${RED}console.debug found in:${NC}"
        find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\.debug" {} + || true
        echo ""
    fi
    
    echo "💡 Recommended actions:"
    echo "   1. Replace console.log with logger.info() for important messages"
    echo "   2. Replace console.debug with logger.debug() for debug info"
    echo "   3. Remove console.log for temporary debugging statements"
    echo "   4. Keep console.warn and console.error (they're allowed)"
    echo ""
    echo "📝 Usage:"
    echo "   import { logger } from '../lib/logger';"
    echo "   logger.info('User action', { userId, action });"
    echo "   logger.debug('Debug info', { data });"
    echo ""
    
    exit 1
else
    echo -e "${GREEN}✅ No console.log/info/debug statements found!${NC}"
    echo ""
    echo "All logging is using proper logger methods."
    exit 0
fi
