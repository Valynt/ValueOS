#!/bin/bash
# Quick verification script for LGTM observability stack

set -e

echo "🔍 LGTM Observability Stack - Health Check"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    
    echo -n "Checking $name... "
    
    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Check if Docker Compose is running
echo "📦 Checking if observability stack is running..."
if docker-compose -f docker-compose.observability.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Stack is running${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Stack is not running${NC}"
    echo "Start it with: make -f Makefile.observability obs-up"
    exit 1
fi

# Check each service
echo "🏥 Health Checks:"
echo "----------------"

all_healthy=true

check_service "Loki      " "http://localhost:3100/ready" || all_healthy=false
check_service "Tempo     " "http://localhost:3200/ready" || all_healthy=false
check_service "Prometheus" "http://localhost:9090/-/ready" || all_healthy=false
check_service "Grafana   " "http://localhost:3000/api/health" || all_healthy=false

echo ""
echo "📊 Service Endpoints:"
echo "--------------------"
echo "  Grafana:    http://localhost:3000 (No login required)"
echo "  Prometheus: http://localhost:9090"
echo "  Loki API:   http://localhost:3100"
echo "  Tempo API:  http://localhost:3200"
echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}✅ All services are healthy!${NC}"
    echo ""
    echo "🎉 You're ready to:"
    echo "  1. View traces in Grafana (Explore → Tempo)"
    echo "  2. Query logs in Loki (Explore → Loki)"
    echo "  3. Check metrics in Prometheus (Explore → Prometheus)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some services are unhealthy${NC}"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "  - Check logs: make -f Makefile.observability obs-logs"
    echo "  - Restart stack: make -f Makefile.observability obs-restart"
    echo "  - See troubleshooting guide: docs/observability/TROUBLESHOOTING.md"
    echo ""
    exit 1
fi
