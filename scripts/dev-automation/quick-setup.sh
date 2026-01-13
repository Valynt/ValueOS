#!/bin/bash
###############################################################################
# Quick Development Setup
# One-command setup for new developers
###############################################################################

set -e

RUN_CHECKS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --run-checks)
            RUN_CHECKS=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo "🚀 ValueCanvas Quick Setup"
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

# 1. Check prerequisites
print_status "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ git is required but not installed. Aborting." >&2; exit 1; }
print_success "Prerequisites met"

# 2. Install dependencies
print_status "Installing dependencies..."
npm ci --prefer-offline --no-audit --no-fund
print_success "Dependencies installed"

# 3. Set up environment
print_status "Setting up environment..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
    else
        print_warning ".env.example not found"
    fi
else
    print_success ".env already exists"
fi

# 4. Generate Prisma client
if [ -f "prisma/schema.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
    print_success "Prisma client generated"
fi

# 5. Set up Git hooks
if [ -d ".husky" ]; then
    print_status "Setting up Git hooks..."
    npx husky install
    print_success "Git hooks configured"
fi

# 6. Build project
if [ "$RUN_CHECKS" = true ]; then
    print_status "Building project..."
    npm run build 2>/dev/null || print_warning "Build failed (this is OK for initial setup)"
else
    print_warning "Skipping build. Run manually with --run-checks."
    echo "  npm run build"
fi

# 7. Run tests
if [ "$RUN_CHECKS" = true ]; then
    print_status "Running tests..."
    npm test 2>/dev/null || print_warning "Some tests failed (review and fix)"
else
    print_warning "Skipping tests. Run manually with --run-checks."
    echo "  npm test"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update .env file"
echo "  2. Start development server: npm run dev"
echo "  3. Run tests: npm test"
echo ""
echo "Happy coding! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
