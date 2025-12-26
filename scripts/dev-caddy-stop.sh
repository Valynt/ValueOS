#!/bin/bash

# ============================================================================
# Stop ValueCanvas Development Environment
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Stopping ValueCanvas Development                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}→ Stopping containers...${NC}"
docker-compose -f docker-compose.dev-caddy.yml down

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""

# Ask if user wants to remove volumes
read -p "$(echo -e ${RED}Remove data volumes (database, cache)? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}→ Removing volumes...${NC}"
    docker-compose -f docker-compose.dev-caddy.yml down -v
    echo -e "${GREEN}✓ Volumes removed${NC}"
fi

echo ""
echo -e "${GREEN}👋 Development environment stopped${NC}"
