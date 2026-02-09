#!/bin/bash
# Verification script for PGLT observability stack (7 services)

set -e

COMPOSE_FILE="infra/docker/docker-compose.observability.yml"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local name=$1
    local url=$2

    printf "  %-18s" "$name"

    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

echo "PGLT Observability Stack - Health Check"
echo "========================================"
echo ""

# Check if stack is running
if docker compose -f "$COMPOSE_FILE" ps 2>/dev/null | grep -q "running"; then
    echo -e "Stack status: ${GREEN}running${NC}"
    echo ""
else
    echo -e "Stack status: ${YELLOW}not running${NC}"
    echo "Start with: make -f scripts/Makefile.observability obs-up"
    exit 1
fi

echo "Health Checks:"
echo "--------------"

all_healthy=true

check_service "Grafana"        "http://localhost:3000/api/health" || all_healthy=false
check_service "Prometheus"     "http://localhost:9090/-/ready"    || all_healthy=false
check_service "Loki"           "http://localhost:3100/ready"      || all_healthy=false
check_service "Tempo"          "http://localhost:3200/ready"      || all_healthy=false
check_service "OTel Collector" "http://localhost:13133/"          || all_healthy=false
check_service "node-exporter"  "http://localhost:9100/metrics"    || all_healthy=false

# Promtail has no health endpoint; check container status
printf "  %-18s" "Promtail"
if docker inspect valueos-promtail --format='{{.State.Running}}' 2>/dev/null | grep -q "true"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAIL${NC}"
    all_healthy=false
fi

echo ""
echo "Endpoints:"
echo "  Grafana:        http://localhost:3000 (no login)"
echo "  Prometheus:     http://localhost:9090"
echo "  Loki:           http://localhost:3100"
echo "  Tempo:          http://localhost:3200"
echo "  OTel Collector: http://localhost:13133"
echo "  node-exporter:  http://localhost:9100"
echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}All 7 services healthy.${NC}"
    exit 0
else
    echo -e "${RED}Some services are unhealthy.${NC}"
    echo "Check logs: make -f scripts/Makefile.observability obs-logs"
    exit 1
fi
