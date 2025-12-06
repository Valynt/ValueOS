#!/bin/bash
###############################################################################
# Dev Container - Post Start Script
# Runs every time the container starts
# Performs quick health checks and starts services
###############################################################################

set -e

echo "🚦 Running post-start checks..."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
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

# 1. Check Docker daemon
print_status "Checking Docker..."
if docker ps &> /dev/null; then
    print_success "Docker is running"
else
    print_warning "Docker is not accessible (this is OK if not using Docker)"
fi

# 2. Check disk space
print_status "Checking disk space..."
DISK_USAGE=$(df -h /workspace | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
    print_success "Disk space: ${DISK_USAGE}% used"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warning "Disk space: ${DISK_USAGE}% used (consider cleanup)"
else
    print_error "Disk space: ${DISK_USAGE}% used (cleanup recommended)"
fi

# 3. Check node_modules
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found - run 'npm install'"
else
    print_success "node_modules present"
fi

# 4. Check environment file
if [ ! -f ".env" ]; then
    print_warning ".env file not found - copy from .env.example if needed"
else
    print_success ".env file present"
fi

# 5. Start background services (if configured)
if [ -f "docker-compose.dev.yml" ]; then
    print_status "Starting development services..."
    docker-compose -f docker-compose.dev.yml up -d 2>/dev/null || print_warning "Could not start services"
fi

# 6. Display service status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Environment Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show running containers
if docker ps &> /dev/null; then
    CONTAINER_COUNT=$(docker ps --format '{{.Names}}' | wc -l)
    if [ "$CONTAINER_COUNT" -gt 0 ]; then
        echo ""
        echo "🐳 Running Containers:"
        docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -6
    fi
fi

# Show forwarded ports
echo ""
echo "🌐 Forwarded Ports:"
echo "  3000  - Frontend (Vite)"
echo "  8000  - Backend API"
echo "  5432  - PostgreSQL"
echo "  6379  - Redis"
echo "  9090  - Prometheus"
echo "  16686 - Jaeger UI"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Container ready! Start coding with 'npm run dev'"
echo ""
