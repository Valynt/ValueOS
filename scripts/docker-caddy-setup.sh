#!/bin/bash
###############################################################################
# Docker + Caddy Setup Script
# Sets up ValueCanvas with Caddy reverse proxy
###############################################################################

set -e

echo "🐳 ValueCanvas Docker + Caddy Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Check prerequisites
print_status "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

print_success "Prerequisites met"

# 2. Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.caddy.yml down 2>/dev/null || true
docker-compose down 2>/dev/null || true
print_success "Existing containers stopped"

# 3. Create secrets directory
print_status "Creating secrets directory..."
mkdir -p secrets

if [ ! -f "secrets/dev_db_password.txt" ]; then
    echo "dev_password_123" > secrets/dev_db_password.txt
    print_success "Created dev_db_password.txt"
fi

if [ ! -f "secrets/dev_redis_password.txt" ]; then
    echo "dev_redis_456" > secrets/dev_redis_password.txt
    print_success "Created dev_redis_password.txt"
fi

# 4. Create .env.local if it doesn't exist
print_status "Checking environment file..."
if [ ! -f ".env.local" ]; then
    if [ -f ".env.dev.example" ]; then
        cp .env.dev.example .env.local
        print_success "Created .env.local from .env.dev.example"
    elif [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_success "Created .env.local from .env.example"
    else
        print_warning ".env.local not found and no example file available"
    fi
else
    print_success ".env.local exists"
fi

# 5. Verify Caddyfile exists
print_status "Checking Caddyfile..."
if [ ! -f "Caddyfile" ]; then
    print_error "Caddyfile not found!"
    echo "Please create a Caddyfile in the project root"
    exit 1
fi
print_success "Caddyfile found"

# 6. Build and start services
print_status "Building and starting services..."
docker-compose -f docker-compose.caddy.yml up -d --build

# 7. Wait for services to be healthy
print_status "Waiting for services to start..."
echo "This may take a minute..."

# Wait up to 2 minutes for services
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker-compose -f docker-compose.caddy.yml ps | grep -q "healthy"; then
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done
echo ""

# 8. Check service status
print_status "Checking service status..."
docker-compose -f docker-compose.caddy.yml ps

# 9. Test connectivity
echo ""
print_status "Testing connectivity..."

# Test app directly
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "App is accessible at http://localhost:3000"
else
    print_warning "App not accessible at http://localhost:3000"
fi

# Test Caddy
if curl -f -s http://localhost:80 > /dev/null 2>&1; then
    print_success "Caddy is accessible at http://localhost"
else
    print_warning "Caddy not accessible at http://localhost"
fi

# Test health endpoint
if curl -f -s http://localhost:80/health > /dev/null 2>&1; then
    print_success "Health endpoint working"
else
    print_warning "Health endpoint not responding"
fi

# 10. Display summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Access your application:"
echo "  • Via Caddy:  http://localhost"
echo "  • Direct:     http://localhost:3000"
echo "  • Health:     http://localhost/health"
echo ""
echo "Useful commands:"
echo "  • View logs:     docker-compose -f docker-compose.caddy.yml logs -f"
echo "  • Stop:          docker-compose -f docker-compose.caddy.yml down"
echo "  • Restart:       docker-compose -f docker-compose.caddy.yml restart"
echo "  • Status:        docker-compose -f docker-compose.caddy.yml ps"
echo ""
echo "Troubleshooting:"
echo "  • If not accessible from Windows, restart Docker Desktop"
echo "  • Check logs: docker-compose -f docker-compose.caddy.yml logs caddy"
echo "  • See docs/DOCKER_PORT_FORWARDING_FIX.md for more help"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
