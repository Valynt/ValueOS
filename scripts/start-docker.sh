#!/bin/bash

# ValueCanvas Docker Startup Script
# Builds and starts all Docker containers

set -e  # Exit on error

echo "🐳 Starting ValueCanvas with Docker Compose..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    echo "   Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker installed${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not installed${NC}"
    echo "   Install from: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✅ docker-compose installed${NC}"

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "   Please start Docker Desktop or Docker daemon"
    exit 1
fi
echo -e "${GREEN}✅ Docker daemon running${NC}"

echo ""

# Check .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    if [ -f ".env.example" ]; then
        echo "   Creating .env.local from .env.example..."
        cp .env.example .env.local
        echo -e "${GREEN}✅ Created .env.local${NC}"
        echo -e "${YELLOW}   ⚠️  Please edit .env.local with your credentials${NC}"
        echo ""
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env.local exists${NC}"
fi

echo ""

# Ask user if they want to rebuild
echo "📦 Build mode:"
echo "   1. Start existing containers (fast)"
echo "   2. Rebuild and start (slower, use after code changes)"
echo ""
read -p "Choose [1-2] (default: 1): " BUILD_CHOICE
BUILD_CHOICE=${BUILD_CHOICE:-1}

echo ""

if [ "$BUILD_CHOICE" == "2" ]; then
    echo "🔨 Building Docker containers..."
    docker-compose -f docker-compose.dev.yml build
    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""
fi

# Start containers
echo "🚀 Starting Docker containers..."
echo ""

# Check if user wants foreground or background
read -p "Run in background? [y/N]: " RUN_BG
RUN_BG=${RUN_BG:-n}

echo ""

if [[ "$RUN_BG" =~ ^[Yy]$ ]]; then
    # Background mode
    docker-compose -f docker-compose.dev.yml up -d
    
    echo -e "${GREEN}✅ Containers started in background${NC}"
    echo ""
    echo "📊 Container Status:"
    docker-compose -f docker-compose.dev.yml ps
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:        docker-compose -f docker-compose.dev.yml logs -f"
    echo "   Stop containers:  docker-compose -f docker-compose.dev.yml down"
    echo "   Restart:          docker-compose -f docker-compose.dev.yml restart"
    echo ""
else
    # Foreground mode
    echo -e "${GREEN}✨ Starting containers (press Ctrl+C to stop)${NC}"
    echo ""
    docker-compose -f docker-compose.dev.yml up
fi

echo ""
echo "🔗 Application URLs:"
echo "   - Frontend:  http://localhost:5173"
echo "   - Postgres:  localhost:5432"
echo "   - Redis:     localhost:6379"
echo ""
