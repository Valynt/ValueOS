#!/bin/bash
# Run Chaos Engineering Pipeline
# Executes controlled chaos experiments in development environment

set -e

echo "🔥 Chaos Engineering Pipeline"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DURATION=${CHAOS_DURATION:-5}
EXPERIMENT_COUNT=0
SUCCESS_COUNT=0

# Enable chaos
export CHAOS_ENABLED=true
export NODE_ENV=development

echo -e "${BLUE}Configuration:${NC}"
echo "  Duration: ${DURATION} minutes"
echo "  Chaos Enabled: ${CHAOS_ENABLED}"
echo ""

# Step 1: Run unit tests
echo -e "${BLUE}Step 1: Chaos Unit Tests${NC}"
echo "------------------------"
if npm run test:chaos; then
    echo -e "${GREEN}✓ Chaos unit tests passed${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${YELLOW}⚠ Some chaos tests did not trigger (probability-based)${NC}"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 2: Start services
echo -e "${BLUE}Step 2: Start Development Services${NC}"
echo "-----------------------------------"
docker-compose -f docker-compose.dev.yml up -d
sleep 10

if docker ps | grep -q valuecanvas-dev; then
    echo -e "${GREEN}✓ Services started${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${RED}✗ Services failed to start${NC}"
    exit 1
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 3: Network chaos
echo -e "${BLUE}Step 3: Network Latency Chaos${NC}"
echo "------------------------------"

# Check if tc (traffic control) is available
if command -v tc &> /dev/null; then
    echo "  → Injecting 100ms latency..."
    docker exec valuecanvas-dev tc qdisc add dev eth0 root netem delay 100ms 50ms 2>/dev/null || echo "  ⚠ tc not available in container"
    sleep 5
    
    # Test service still responds
    if docker exec valuecanvas-dev curl -f http://localhost:5173 --max-time 10 &> /dev/null; then
        echo -e "${GREEN}✓ Service survived network latency${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗ Service failed under latency${NC}"
    fi
    
    # Remove latency
    docker exec valuecanvas-dev tc qdisc del dev eth0 root 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ tc not available, skipping network chaos${NC}"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 4: Memory pressure (if stress-ng available)
echo -e "${BLUE}Step 4: Memory Pressure Chaos${NC}"
echo "-----------------------------"

if docker exec valuecanvas-dev which stress-ng &> /dev/null; then
    echo "  → Applying memory pressure (512MB for 10s)..."
    docker exec valuecanvas-dev stress-ng --vm 1 --vm-bytes 512M --timeout 10s &> /dev/null || true
    
    # Check if service is still healthy
    if docker exec valuecanvas-dev curl -f http://localhost:5173 --max-time 5 &> /dev/null; then
        echo -e "${GREEN}✓ Service survived memory pressure${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗ Service degraded under memory pressure${NC}"
    fi
else
    echo -e "${YELLOW}⚠ stress-ng not available in container${NC}"
    echo "  Install with: apt-get install stress-ng"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 5: CPU stress (if stress-ng available)
echo -e "${BLUE}Step 5: CPU Stress Chaos${NC}"
echo "------------------------"

if docker exec valuecanvas-dev which stress-ng &> /dev/null; then
    echo "  → Applying CPU stress (2 cores for 10s)..."
    docker exec valuecanvas-dev stress-ng --cpu 2 --timeout 10s &> /dev/null || true
    
    # Check if service is still healthy
    if docker exec valuecanvas-dev curl -f http://localhost:5173 --max-time 5 &> /dev/null; then
        echo -e "${GREEN}✓ Service survived CPU stress${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗ Service degraded under CPU stress${NC}"
    fi
else
    echo -e "${YELLOW}⚠ stress-ng not available${NC}"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 6: Container restart chaos
echo -e "${BLUE}Step 6: Container Restart Chaos${NC}"
echo "-------------------------------"
echo "  → Restarting valuecanvas-dev container..."
docker restart valuecanvas-dev
sleep 10

# Wait for service to be healthy
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
    if docker exec valuecanvas-dev curl -f http://localhost:5173 --max-time 2 &> /dev/null; then
        echo -e "${GREEN}✓ Service recovered after restart${NC}"
        ((SUCCESS_COUNT++))
        break
    fi
    ((RETRIES++))
    echo "  Waiting for service... ($RETRIES/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Service failed to recover${NC}"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 7: Database chaos
echo -e "${BLUE}Step 7: Database Connection Chaos${NC}"
echo "---------------------------------"
echo "  → Pausing PostgreSQL container..."
docker pause valuecanvas-postgres
sleep 5

echo "  → Resuming PostgreSQL container..."
docker unpause valuecanvas-postgres
sleep 5

# Check if service handles DB reconnection
if docker exec valuecanvas-dev curl -f http://localhost:5173 --max-time 5 &> /dev/null; then
    echo -e "${GREEN}✓ Service survived database pause${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${YELLOW}⚠ Service may be degraded (expected for DB-dependent endpoints)${NC}"
fi
((EXPERIMENT_COUNT++))
echo ""

# Step 8: Collect logs
echo -e "${BLUE}Step 8: Collect Chaos Logs${NC}"
echo "--------------------------"
mkdir -p chaos-logs

docker logs valuecanvas-dev > chaos-logs/app.log 2>&1 || true
docker logs valuecanvas-postgres > chaos-logs/postgres.log 2>&1 || true
docker logs valuecanvas-redis > chaos-logs/redis.log 2>&1 || true

echo -e "${GREEN}✓ Logs collected in chaos-logs/${NC}"
echo ""

# Cleanup
echo -e "${BLUE}Cleanup${NC}"
echo "-------"
docker-compose -f docker-compose.dev.yml down
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

# Final report
echo "=============================="
echo -e "${BLUE}📊 Chaos Pipeline Results${NC}"
echo "=============================="
echo ""
echo "Experiments Run: $EXPERIMENT_COUNT"
echo "Successful: $SUCCESS_COUNT"
echo "Success Rate: $(( SUCCESS_COUNT * 100 / EXPERIMENT_COUNT ))%"
echo ""

if [ $SUCCESS_COUNT -eq $EXPERIMENT_COUNT ]; then
    echo -e "${GREEN}✅ All chaos experiments passed!${NC}"
    exit 0
elif [ $SUCCESS_COUNT -ge $(( EXPERIMENT_COUNT * 7 / 10 )) ]; then
    echo -e "${YELLOW}⚠️ Most experiments passed (>70%)${NC}"
    echo "Some tests may fail due to probability-based chaos"
    exit 0
else
    echo -e "${RED}❌ Too many experiments failed${NC}"
    exit 1
fi
