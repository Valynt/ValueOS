#!/bin/bash

# ============================================================================
# ValueCanvas Development Environment with Caddy
# ============================================================================
# Quick start script for development with Caddy reverse proxy
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     ValueCanvas Development with Caddy                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo -e "${YELLOW}  Please start Docker Desktop and try again${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if .env.dev exists
if [ ! -f ".env.dev" ]; then
    echo -e "${YELLOW}⚠ .env.dev not found${NC}"
    if [ -f ".env.example" ]; then
        echo -e "${BLUE}→ Creating .env.dev from .env.example${NC}"
        cp .env.example .env.dev
        echo -e "${GREEN}✓ Created .env.dev${NC}"
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Environment file exists${NC}"

# Check if Caddyfile.dev exists
if [ ! -f "Caddyfile.dev" ]; then
    echo -e "${RED}✗ Caddyfile.dev not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Caddyfile.dev exists${NC}"

# Stop any existing containers
echo ""
echo -e "${BLUE}→ Stopping existing containers...${NC}"
docker-compose -f docker-compose.dev-caddy.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Cleaned up existing containers${NC}"

# Start services
echo ""
echo -e "${BLUE}→ Starting development environment...${NC}"
docker-compose -f docker-compose.dev-caddy.yml up -d

# Wait for services to be ready
echo ""
echo -e "${BLUE}→ Waiting for services to start...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${BLUE}→ Checking service health...${NC}"

# Check Caddy
if curl -s http://localhost/caddy-health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Caddy is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Caddy health check pending...${NC}"
fi

# Check Vite dev server
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Vite dev server is running${NC}"
else
    echo -e "${YELLOW}⚠ Vite dev server starting...${NC}"
fi

# Check PostgreSQL
if docker exec valuecanvas-postgres-dev pg_isready -U valuecanvas > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL is starting...${NC}"
fi

# Check Redis
if docker exec valuecanvas-redis-dev redis-cli -a dev_redis_password ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is ready${NC}"
else
    echo -e "${YELLOW}⚠ Redis is starting...${NC}"
fi

# Show service status
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Development Environment Ready                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🚀 Access Points:${NC}"
echo -e "   ${BLUE}Main Application:${NC}    http://localhost"
echo -e "   ${BLUE}Vite Dev Server:${NC}     http://localhost:3000"
echo -e "   ${BLUE}Static Files:${NC}        http://localhost:8080"
echo -e "   ${BLUE}Caddy Admin API:${NC}    http://localhost:2019"
echo -e "   ${BLUE}PostgreSQL:${NC}          localhost:5432"
echo -e "   ${BLUE}Redis:${NC}               localhost:6379"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo -e "   ${CYAN}View logs:${NC}           docker-compose -f docker-compose.dev-caddy.yml logs -f"
echo -e "   ${CYAN}Stop services:${NC}       docker-compose -f docker-compose.dev-caddy.yml down"
echo -e "   ${CYAN}Restart:${NC}             docker-compose -f docker-compose.dev-caddy.yml restart"
echo -e "   ${CYAN}Rebuild:${NC}             docker-compose -f docker-compose.dev-caddy.yml up -d --build"
echo -e "   ${CYAN}Reload Caddy:${NC}        caddy reload --config Caddyfile.dev --adapter caddyfile"
echo -e "   ${CYAN}Caddy config:${NC}        curl http://localhost:2019/config/"
echo ""
echo -e "${GREEN}✨ Hot Module Replacement (HMR) is enabled${NC}"
echo -e "${GREEN}✨ Edit files in ./src and see changes instantly${NC}"
echo ""

# Ask if user wants to follow logs
read -p "$(echo -e ${YELLOW}Follow logs? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.dev-caddy.yml logs -f
fi
