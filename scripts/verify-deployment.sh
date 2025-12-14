#!/bin/bash

# ============================================================================
# Deployment Verification Script
# ============================================================================
# Verifies that the deployment is healthy and ready for production
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_URL="${APP_URL:-http://localhost:5173}"
TIMEOUT=30
RETRIES=5

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              ValueCanvas Deployment Verification                     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# Helper Functions
# ============================================================================

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    exit 1
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo "📋 Pre-flight Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Docker
if command -v docker &> /dev/null; then
    check_pass "Docker is installed ($(docker --version))"
else
    check_fail "Docker is not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    check_pass "Docker Compose is installed ($(docker-compose --version))"
else
    check_fail "Docker Compose is not installed"
fi

# Check environment file
if [ -f ".env.production" ] || [ -f ".env.local" ]; then
    check_pass "Environment file exists"
else
    check_warn "No environment file found (.env.production or .env.local)"
fi

echo ""

# ============================================================================
# Container Health Checks
# ============================================================================

echo "🐳 Container Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if containers are running
CONTAINERS=$(docker ps --filter "name=valuecanvas" --format "{{.Names}}")

if [ -z "$CONTAINERS" ]; then
    check_fail "No ValueCanvas containers are running"
fi

for container in $CONTAINERS; do
    # Check container status
    STATUS=$(docker inspect --format='{{.State.Status}}' "$container")
    if [ "$STATUS" = "running" ]; then
        check_pass "Container $container is running"
    else
        check_fail "Container $container is not running (status: $STATUS)"
    fi

    # Check health status (if health check is configured)
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    if [ "$HEALTH" = "healthy" ]; then
        check_pass "Container $container is healthy"
    elif [ "$HEALTH" = "none" ]; then
        check_warn "Container $container has no health check configured"
    else
        check_fail "Container $container is unhealthy (status: $HEALTH)"
    fi
done

echo ""

# ============================================================================
# Application Health Checks
# ============================================================================

echo "🌐 Application Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for application to be ready
echo "Waiting for application to be ready..."
for i in $(seq 1 $RETRIES); do
    if curl -f -s -o /dev/null -w "%{http_code}" "$APP_URL" > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq $RETRIES ]; then
        check_fail "Application did not become ready after $RETRIES attempts"
    fi
    echo "  Attempt $i/$RETRIES..."
    sleep 5
done

# Check HTTP response
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "Application is responding (HTTP $HTTP_CODE)"
else
    check_fail "Application returned HTTP $HTTP_CODE"
fi

# Check response time
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$APP_URL")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    check_pass "Response time is acceptable (${RESPONSE_TIME}s)"
else
    check_warn "Response time is slow (${RESPONSE_TIME}s)"
fi

echo ""

# ============================================================================
# Security Checks
# ============================================================================

echo "🔒 Security Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running as non-root
for container in $CONTAINERS; do
    USER=$(docker exec "$container" whoami 2>/dev/null || echo "unknown")
    if [ "$USER" != "root" ]; then
        check_pass "Container $container is running as non-root user ($USER)"
    else
        check_warn "Container $container is running as root"
    fi
done

# Check for console.log statements
if [ -f "scripts/audit-logs.sh" ]; then
    if bash scripts/audit-logs.sh > /dev/null 2>&1; then
        check_pass "No console.log statements in production code"
    else
        check_fail "Console.log statements found in production code"
    fi
else
    check_warn "Audit logs script not found"
fi

# Check security headers
HEADERS=$(curl -s -I "$APP_URL")
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    check_pass "X-Frame-Options header is set"
else
    check_warn "X-Frame-Options header is missing"
fi

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    check_pass "X-Content-Type-Options header is set"
else
    check_warn "X-Content-Type-Options header is missing"
fi

echo ""

# ============================================================================
# Resource Checks
# ============================================================================

echo "📊 Resource Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage is acceptable (${DISK_USAGE}%)"
else
    check_warn "Disk usage is high (${DISK_USAGE}%)"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    check_pass "Memory usage is acceptable (${MEMORY_USAGE}%)"
else
    check_warn "Memory usage is high (${MEMORY_USAGE}%)"
fi

# Check container resource limits
for container in $CONTAINERS; do
    MEMORY_LIMIT=$(docker inspect --format='{{.HostConfig.Memory}}' "$container")
    if [ "$MEMORY_LIMIT" != "0" ]; then
        check_pass "Container $container has memory limit set"
    else
        check_warn "Container $container has no memory limit"
    fi

    CPU_LIMIT=$(docker inspect --format='{{.HostConfig.NanoCpus}}' "$container")
    if [ "$CPU_LIMIT" != "0" ]; then
        check_pass "Container $container has CPU limit set"
    else
        check_warn "Container $container has no CPU limit"
    fi
done

echo ""

# ============================================================================
# Network Checks
# ============================================================================

echo "🌐 Network Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if containers are on the same network
NETWORK=$(docker inspect --format='{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}' $(echo $CONTAINERS | awk '{print $1}'))
if [ -n "$NETWORK" ]; then
    check_pass "Containers are on network: $NETWORK"
else
    check_warn "Could not determine container network"
fi

# Check port bindings
for container in $CONTAINERS; do
    PORTS=$(docker port "$container" 2>/dev/null || echo "none")
    if [ "$PORTS" != "none" ]; then
        check_pass "Container $container has ports exposed"
    else
        check_warn "Container $container has no ports exposed"
    fi
done

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    Verification Complete ✅                          ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Application URL: $APP_URL"
echo "Containers: $(echo $CONTAINERS | wc -w)"
echo ""
echo "Next steps:"
echo "  1. Review any warnings above"
echo "  2. Monitor logs: docker-compose logs -f"
echo "  3. Check metrics: docker stats"
echo ""
