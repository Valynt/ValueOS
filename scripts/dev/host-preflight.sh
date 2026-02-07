#!/bin/bash
###############################################################################
# Host Preflight Checks
#
# Run this on the host machine before starting the devcontainer to verify
# all prerequisites are met.
#
# Usage: bash scripts/dev/host-preflight.sh
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

echo "🔍 ValueOS Host Preflight Checks"
echo "================================="
echo ""

###############################################################################
# Check Docker
###############################################################################
echo -n "Checking Docker CLI... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(docker --version)"
else
    echo -e "${RED}✗ Docker CLI not found${NC}"
    echo "  Install: https://docs.docker.com/get-docker/"
    FAILED=1
fi

echo -n "Checking Docker daemon... "
if docker info &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Running"
else
    echo -e "${RED}✗ Docker daemon not running${NC}"
    echo "  Start Docker Desktop or run: sudo systemctl start docker"
    FAILED=1
fi

###############################################################################
# Check Docker Compose
###############################################################################
echo -n "Checking Docker Compose... "
if docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $(docker compose version --short)"
elif command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Using legacy docker-compose"
else
    echo -e "${RED}✗ Docker Compose not found${NC}"
    FAILED=1
fi

###############################################################################
# Check Required Ports
###############################################################################
echo ""
echo "Checking port availability..."

check_port() {
    local port=$1
    local service=$2
    echo -n "  Port $port ($service)... "

    # Check if port is in use
    if command -v lsof &> /dev/null; then
        if lsof -i ":$port" &> /dev/null; then
            local proc=$(lsof -i ":$port" -t 2>/dev/null | head -1)
            echo -e "${RED}✗ IN USE${NC} (PID: $proc)"
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${RED}✗ IN USE${NC}"
            return 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${RED}✗ IN USE${NC}"
            return 1
        fi
    fi

    echo -e "${GREEN}✓${NC} Available"
    return 0
}

PORTS_OK=true
check_port 5173 "Frontend" || PORTS_OK=false
check_port 3001 "Backend" || PORTS_OK=false
check_port 54321 "Supabase API" || PORTS_OK=false
check_port 54322 "PostgreSQL" || PORTS_OK=false
check_port 54323 "Supabase Studio" || PORTS_OK=false
check_port 6379 "Redis" || PORTS_OK=false

if [[ "$PORTS_OK" != "true" ]]; then
    echo ""
    echo -e "${YELLOW}Some ports are in use. Stop conflicting services or change ports.${NC}"
    FAILED=1
fi

###############################################################################
# Check Node.js (optional but helpful)
###############################################################################
echo ""
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} $NODE_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Not installed (will use container's Node)"
fi

###############################################################################
# Check pnpm (optional but helpful)
###############################################################################
echo -n "Checking pnpm... "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}✓${NC} v$PNPM_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Not installed (will use container's pnpm)"
fi

###############################################################################
# Check Git
###############################################################################
echo -n "Checking Git... "
if command -v git &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(git --version)"
else
    echo -e "${RED}✗ Git not found${NC}"
    FAILED=1
fi

###############################################################################
# Check disk space
###############################################################################
echo ""
echo -n "Checking disk space... "
if command -v df &> /dev/null; then
    AVAIL_KB=$(df . 2>/dev/null | tail -1 | awk '{print $4}')
    AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
    if [[ $AVAIL_GB -lt 5 ]]; then
        echo -e "${YELLOW}⚠${NC} ${AVAIL_GB}GB available (recommend 10GB+)"
    else
        echo -e "${GREEN}✓${NC} ${AVAIL_GB}GB available"
    fi
else
    echo -e "${YELLOW}⚠${NC} Could not check"
fi

###############################################################################
# Summary
###############################################################################
echo ""
echo "================================="
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All preflight checks passed!${NC}"
    echo ""
    echo "You can now open this folder in VS Code and use:"
    echo "  'Dev Containers: Reopen in Container'"
    exit 0
else
    echo -e "${RED}✗ Some preflight checks failed${NC}"
    echo ""
    echo "Fix the issues above before starting the devcontainer."
    exit 1
fi
