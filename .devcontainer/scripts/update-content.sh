#!/bin/bash
###############################################################################
# Dev Container - Update Content Script
# Runs when container content is updated (e.g., after git pull)
###############################################################################

set -e

echo "🔄 Updating container content..."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check if package.json changed
if [ -f "package.json" ]; then
    print_status "Checking for dependency changes..."
    
    # Install dependencies if package.json changed
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_status "Installing dependencies..."
        npm ci --prefer-offline --no-audit
        print_success "Dependencies installed"
    else
        print_success "Dependencies up to date"
    fi
fi

# Update Prisma client if schema changed
if [ -f "prisma/schema.prisma" ]; then
    if [ ! -d "node_modules/.prisma" ] || [ "prisma/schema.prisma" -nt "node_modules/.prisma" ]; then
        print_status "Generating Prisma client..."
        npx prisma generate
        print_success "Prisma client generated"
    fi
fi

# Update Playwright browsers if needed
if [ -f "playwright.config.ts" ]; then
    if [ ! -d "$HOME/.cache/ms-playwright" ]; then
        print_status "Installing Playwright browsers..."
        npx playwright install --with-deps
        print_success "Playwright browsers installed"
    fi
fi

echo ""
echo "✅ Content update complete!"
echo ""
