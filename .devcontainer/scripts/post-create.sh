#!/bin/bash
###############################################################################
# Dev Container - Post Create Script
# Runs after container is created and content is updated
# Performs final setup and validation
###############################################################################

set -e

echo "🎯 Running post-create setup..."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
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

# 1. Install project dependencies (with caching)
print_status "Installing project dependencies..."
if [ -f "package.json" ]; then
    # Use npm ci for faster, reproducible installs
    npm ci --prefer-offline --no-audit --no-fund
    print_success "Dependencies installed"
else
    print_warning "No package.json found"
fi

# 2. Generate Prisma client
if [ -f "prisma/schema.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
    print_success "Prisma client generated"
fi

# 3. Build TypeScript if needed
if [ -f "tsconfig.json" ]; then
    print_status "Checking TypeScript compilation..."
    npm run build 2>/dev/null || print_warning "Build failed (this is OK for initial setup)"
fi

# 4. Set up pre-commit hooks
if [ -f ".husky/pre-commit" ]; then
    print_status "Setting up Husky hooks..."
    npx husky install 2>/dev/null || true
    print_success "Husky hooks configured"
fi

# 5. Verify environment
print_status "Verifying development environment..."

# Check Node.js version
NODE_VERSION=$(node --version)
print_success "Node.js: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
print_success "npm: $NPM_VERSION"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    print_success "Docker: $DOCKER_VERSION"
fi

# Check kubectl
if command -v kubectl &> /dev/null; then
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | cut -d' ' -f3)
    print_success "kubectl: $KUBECTL_VERSION"
fi

# 6. Display helpful information
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Development environment ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Quick Start Commands:"
echo "  npm run dev          - Start development server"
echo "  npm test             - Run tests"
echo "  npm run build        - Build for production"
echo "  npm run lint         - Lint code"
echo "  npm run db:push      - Push database schema"
echo ""
echo "🔧 Useful Aliases:"
echo "  dc                   - docker-compose"
echo "  k                    - kubectl"
echo "  npm-clean            - Clean install dependencies"
echo ""
echo "📖 Documentation:"
echo "  docs/                - Project documentation"
echo "  .devcontainer/       - Dev container configuration"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
