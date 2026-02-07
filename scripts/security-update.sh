#!/bin/bash

# Security Update Script
# Automatically updates dependencies to fix known vulnerabilities

set -e

echo "🔒 ValueCanvas Security Update Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Backup current state
echo "📦 Creating backup..."
git stash push -m "Security update backup $(date +%Y%m%d_%H%M%S)"

# Update package-lock.json
echo ""
echo "🔄 Updating dependencies..."

# Update critical packages first
echo "  → Updating Vite (CRITICAL)..."
npm update vite@latest --save

echo "  → Updating other vulnerable packages..."
npm update cross-spawn@latest --save
npm update glob@latest --save
npm update nanoid@latest --save
npm update js-yaml@latest --save
npm update brace-expansion@latest --save
npm update @babel/helpers@latest --save-dev
npm update @eslint/plugin-kit@latest --save-dev
npm update esbuild@latest --save-dev

# Run npm audit fix
echo ""
echo "🔧 Running npm audit fix..."
npm audit fix

# Check for remaining vulnerabilities
echo ""
echo "🔍 Checking for remaining vulnerabilities..."
AUDIT_RESULT=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
VULN_COUNT=$(echo "$AUDIT_RESULT" | grep -o '"vulnerabilities"' | wc -l)

if [ "$VULN_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No vulnerabilities found!${NC}"
else
    echo -e "${YELLOW}⚠️  Some vulnerabilities remain. Running npm audit for details...${NC}"
    npm audit
    
    echo ""
    echo -e "${YELLOW}Attempting force fix...${NC}"
    npm audit fix --force
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
pnpm install

# Run tests
echo ""
echo "🧪 Running tests..."
if pnpm test; then
    echo -e "${GREEN}✅ Tests passed!${NC}"
else
    echo -e "${RED}❌ Tests failed. Rolling back...${NC}"
    git stash pop
    exit 1
fi

# Build project
echo ""
echo "🏗️  Building project..."
if pnpm run build; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed. Rolling back...${NC}"
    git stash pop
    exit 1
fi

# Final audit
echo ""
echo "📊 Final security audit:"
npm audit

echo ""
echo -e "${GREEN}✅ Security update complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test application manually"
echo "  3. Commit changes: git add . && git commit -m 'security: update dependencies to fix vulnerabilities'"
echo "  4. Push to remote: git push"
echo ""
echo "To restore backup if needed: git stash pop"
