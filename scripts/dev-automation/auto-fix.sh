#!/bin/bash
###############################################################################
# Auto-Fix Development Issues
# Automatically fixes common development environment issues
###############################################################################

set -e

echo "🔧 Auto-Fix Development Issues"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

FIXES_APPLIED=0

# 1. Fix missing node_modules
if [ ! -d "node_modules" ]; then
    print_status "Installing missing node_modules..."
    npm ci --prefer-offline --no-audit --no-fund
    print_success "node_modules installed"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 2. Fix missing .env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    print_status "Creating .env from .env.example..."
    cp .env.example .env
    print_success ".env created"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 3. Fix Prisma client
if [ -f "prisma/schema.prisma" ] && [ ! -d "node_modules/.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
    print_success "Prisma client generated"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 4. Fix Playwright browsers
if [ -f "playwright.config.ts" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
    print_status "Installing Playwright browsers..."
    npx playwright install --with-deps
    print_success "Playwright browsers installed"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 5. Fix Git hooks
if [ -d ".husky" ] && [ ! -f ".husky/_/husky.sh" ]; then
    print_status "Setting up Git hooks..."
    npx husky install
    print_success "Git hooks configured"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 6. Fix stale lock files
if [ -f "package-lock.json" ]; then
    PACKAGE_MODIFIED=$(stat -c %Y package.json 2>/dev/null || stat -f %m package.json)
    LOCK_MODIFIED=$(stat -c %Y package-lock.json 2>/dev/null || stat -f %m package-lock.json)
    
    if [ "$PACKAGE_MODIFIED" -gt "$LOCK_MODIFIED" ]; then
        print_status "Updating stale package-lock.json..."
        npm install
        print_success "package-lock.json updated"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    fi
fi

# 7. Fix TypeScript build info
if [ -f "tsconfig.tsbuildinfo" ]; then
    print_status "Cleaning TypeScript build cache..."
    rm -f tsconfig.tsbuildinfo
    print_success "Build cache cleaned"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 8. Fix ESLint cache
if [ -f ".eslintcache" ]; then
    print_status "Cleaning ESLint cache..."
    rm -f .eslintcache
    print_success "ESLint cache cleaned"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 9. Fix Docker containers
if command -v docker >/dev/null 2>&1; then
    if docker ps -a | grep -q "Exited"; then
        print_status "Cleaning up stopped containers..."
        docker container prune -f >/dev/null 2>&1
        print_success "Stopped containers removed"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    fi
fi

# 10. Fix disk space (clean caches)
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
    print_warning "Disk usage is high ($DISK_USAGE%). Cleaning caches..."
    
    # Clean npm cache
    npm cache clean --force >/dev/null 2>&1
    
    # Clean build artifacts
    rm -rf dist build .cache .vite
    
    print_success "Caches cleaned"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FIXES_APPLIED -eq 0 ]; then
    echo "✅ No issues found. Environment is healthy!"
else
    echo "✅ Applied $FIXES_APPLIED fixes"
    echo ""
    echo "Run 'npm run dev' to start development"
fi

echo ""
