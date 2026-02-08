#!/bin/bash
###############################################################################
# ValueOS Environment Verification Script
#
# Verifies deterministic tool versions and basic connectivity
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying environment determinism..."

# 1. Node version check
echo -n "Node.js version: "
NODE_VERSION=$(node -v)
if echo "$NODE_VERSION" | grep -qE '^v20\.19\.'; then
    echo -e "${GREEN}✅ $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Expected v20.19.x, got $NODE_VERSION${NC}"
    exit 1
fi

# 2. pnpm version check
echo -n "pnpm version: "
PNPM_VERSION=$(pnpm -v)
if echo "$PNPM_VERSION" | grep -qE '^9\.15\.0$'; then
    echo -e "${GREEN}✅ $PNPM_VERSION${NC}"
else
    echo -e "${RED}❌ Expected 9.15.0, got $PNPM_VERSION${NC}"
    exit 1
fi

# 3. Node binary location check (detailed)
echo -n "Node binary locations: "
NODE_PATHS=$(type -a node 2>/dev/null | awk '{print $3}' | tr '\n' ' ')
if [[ "$NODE_PATHS" == "/usr/local/bin/node "* ]]; then
    echo -e "${GREEN}✅ First: /usr/local/bin/node${NC}"
else
    echo -e "${YELLOW}⚠️  Paths: $NODE_PATHS${NC}"
fi

# 4. pnpm resolution check
echo -n "pnpm binary locations: "
PNPM_PATHS=$(type -a pnpm 2>/dev/null | awk '{print $3}' | tr '\n' ' ')
if [[ "$PNPM_PATHS" != *"/usr/local/bin/pnpm"* ]] && [[ "$PNPM_PATHS" != *"/usr/bin/pnpm"* ]]; then
    echo -e "${GREEN}✅ Not from system paths${NC}"
else
    echo -e "${YELLOW}⚠️  May be system-installed: $PNPM_PATHS${NC}"
fi

# Check corepack availability
echo -n "Corepack availability: "
if command -v corepack >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Available${NC}"
else
    echo -e "${YELLOW}⚠️  Not found${NC}"
fi

# 4. DNS connectivity check
echo -n "DNS resolution: "
if nslookup github.com >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    exit 1
fi

# 5. glibc check
echo -n "glibc version: "
GLIBC_VERSION=$(node -p "process.report.getReport().header.glibcVersionRuntime" 2>/dev/null || echo "unknown")
if [[ "$GLIBC_VERSION" != "unknown" ]]; then
    echo -e "${GREEN}✅ $GLIBC_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Could not determine glibc version${NC}"
fi

echo -e "${GREEN}🎉 Environment verification complete!${NC}"
