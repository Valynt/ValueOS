#!/bin/bash
###############################################################################
# Test Port Accessibility
# Quick script to test if development ports are accessible
###############################################################################

set -e

echo "🧪 Testing Port Accessibility"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_port() {
    local port=$1
    local name=$2
    local timeout=2
    
    echo -n "Testing $name (port $port)... "
    
    if timeout $timeout bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ Accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Test common development ports
PASSED=0
FAILED=0

test_port 3000 "Frontend (Vite)" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))
test_port 8000 "Backend API" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))
test_port 5432 "PostgreSQL" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))
test_port 6379 "Redis" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))
test_port 9090 "Prometheus" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))
test_port 16686 "Jaeger UI" && PASSED=$((PASSED + 1)) || FAILED=$((FAILED + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${YELLOW}Some ports are not accessible.${NC}"
    echo ""
    echo "To fix:"
    echo "  1. Start missing services"
    echo "  2. Check port forwarding configuration"
    echo "  3. Run: bash scripts/dev-automation/fix-port-forwarding.sh"
    echo ""
    exit 1
else
    echo -e "${GREEN}All ports are accessible!${NC}"
    exit 0
fi
