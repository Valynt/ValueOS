#!/bin/bash
###############################################################################
# Development Environment Health Check
# Verifies all services and dependencies are working
###############################################################################

set -e

echo "🏥 Development Environment Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    CHECKS_WARNING=$((CHECKS_WARNING + 1))
}

echo "📦 Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js: $NODE_VERSION"
else
    check_fail "Node.js: Not installed"
fi

# npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    check_pass "npm: $NPM_VERSION"
else
    check_fail "npm: Not installed"
fi

# Git
if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    check_pass "Git: $GIT_VERSION"
else
    check_fail "Git: Not installed"
fi

# Docker
if command -v docker >/dev/null 2>&1; then
    if docker ps >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        check_pass "Docker: $DOCKER_VERSION (running)"
    else
        check_warn "Docker: Installed but not running"
    fi
else
    check_warn "Docker: Not installed (optional)"
fi

echo ""
echo "📁 Project Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# package.json
if [ -f "package.json" ]; then
    check_pass "package.json: Found"
else
    check_fail "package.json: Missing"
fi

# node_modules
if [ -d "node_modules" ]; then
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    check_pass "node_modules: $MODULE_COUNT packages"
else
    check_fail "node_modules: Missing (run 'npm install')"
fi

# .env
if [ -f ".env" ]; then
    check_pass ".env: Found"
else
    check_warn ".env: Missing (copy from .env.example)"
fi

# tsconfig.json
if [ -f "tsconfig.json" ]; then
    check_pass "tsconfig.json: Found"
else
    check_warn "tsconfig.json: Missing"
fi

echo ""
echo "🗄️  Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Prisma
if [ -f "prisma/schema.prisma" ]; then
    check_pass "Prisma schema: Found"
    
    if [ -d "node_modules/.prisma" ]; then
        check_pass "Prisma client: Generated"
    else
        check_warn "Prisma client: Not generated (run 'npx prisma generate')"
    fi
else
    check_warn "Prisma schema: Not found"
fi

# Database connection
if [ -n "$DATABASE_URL" ]; then
    check_pass "DATABASE_URL: Set"
else
    check_warn "DATABASE_URL: Not set"
fi

echo ""
echo "🧪 Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vitest
if [ -f "vitest.config.ts" ]; then
    check_pass "Vitest config: Found"
else
    check_warn "Vitest config: Not found"
fi

# Playwright
if [ -f "playwright.config.ts" ]; then
    check_pass "Playwright config: Found"
    
    if [ -d "$HOME/.cache/ms-playwright" ]; then
        check_pass "Playwright browsers: Installed"
    else
        check_warn "Playwright browsers: Not installed (run 'npx playwright install')"
    fi
else
    check_warn "Playwright config: Not found"
fi

echo ""
echo "🔧 Build Tools"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vite
if [ -f "vite.config.ts" ]; then
    check_pass "Vite config: Found"
else
    check_warn "Vite config: Not found"
fi

# ESLint
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ]; then
    check_pass "ESLint config: Found"
else
    check_warn "ESLint config: Not found"
fi

# Prettier
if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f "prettier.config.js" ]; then
    check_pass "Prettier config: Found"
else
    check_warn "Prettier config: Not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Passed:${NC} $CHECKS_PASSED"
echo -e "${YELLOW}⚠ Warnings:${NC} $CHECKS_WARNING"
echo -e "${RED}✗ Failed:${NC} $CHECKS_FAILED"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Environment is healthy!${NC}"
    exit 0
else
    echo -e "${RED}❌ Environment has issues. Please fix the failed checks.${NC}"
    exit 1
fi
