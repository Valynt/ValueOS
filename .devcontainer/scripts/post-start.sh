#!/bin/bash
###############################################################################
# Dev Container - Post Start Script
# Runs every time the container starts
# Performs quick health checks and starts services
# Optimized for ValueOS with Windows compatibility
###############################################################################

set -e

# Windows compatibility: Use proper shebang and handle paths
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "🚦 Running post-start checks on Windows..."
else
    echo "🚦 Running post-start checks..."
fi

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

# 1. Check disk space (Windows compatible)
print_status "Checking disk space..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows: Use df with proper path handling
    DISK_USAGE=$(df /workspace 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%' || echo "0")
else
    # Unix/Linux: Standard df command
    DISK_USAGE=$(df -h /workspace | awk 'NR==2 {print $5}' | tr -d '%' || echo "0")
fi

# Validate that we got a number
if ! [[ "$DISK_USAGE" =~ ^[0-9]+$ ]]; then
    print_warning "Could not determine disk usage"
    DISK_USAGE=0
fi
if [ "$DISK_USAGE" -lt 80 ]; then
    print_success "Disk space: ${DISK_USAGE}% used"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warning "Disk space: ${DISK_USAGE}% used (consider cleanup)"
else
    print_error "Disk space: ${DISK_USAGE}% used (cleanup recommended)"
fi

# 2. Check node_modules
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found - run 'npm install'"
else
    print_success "node_modules present"
fi

# 3. Check environment file
if [ ! -f ".env" ]; then
    print_warning ".env file not found - copy from .env.example if needed"
else
    print_success ".env file present"
fi

# 4. Display service status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Environment Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show forwarded ports
echo ""
echo "🌐 Forwarded Ports:"
echo "  5173  - Frontend (Vite)"
echo "  3001  - Backend API"
echo "  5432  - PostgreSQL"
echo "  6379  - Redis"
echo "  54321 - Supabase API"
echo "  54323 - Supabase Studio"
echo "  9090  - Prometheus"
echo "  3000  - Grafana"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Container ready! Start coding with 'npm run dev'"
echo ""
