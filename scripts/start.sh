#!/bin/bash

# ValueCanvas Local Startup Script
# Starts all services needed for local development

set -e  # Exit on error

echo "🚀 Starting ValueCanvas with LLM-MARL & Generative UI..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not installed${NC}"
    echo "   Install from: https://nodejs.org"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version)${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not installed (needed for local Supabase)${NC}"
    echo "   Install from: https://www.docker.com/products/docker-desktop"
    echo "   Or use Supabase Cloud instead"
else
    echo -e "${GREEN}✅ Docker installed${NC}"
fi

if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
    echo "   Install with: pnpm install -g supabase"
    echo "   Or use Supabase Cloud instead"
else
    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
fi

echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    if [ -f ".env.local" ]; then
        echo "   Copying .env.local to .env..."
        cp .env.local .env
        echo -e "${GREEN}✅ Created .env from .env.local${NC}"
    else
        echo -e "${RED}❌ No .env.local found either${NC}"
        echo "   Please create .env file with required variables"
        echo "   See LOCAL_SETUP_GUIDE.md for details"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

echo ""

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""

# Check if Supabase is available
if command -v supabase &> /dev/null && command -v docker &> /dev/null; then
    echo "🗄️  Starting Supabase..."
    
    # Check if Supabase is already running
    if supabase status &> /dev/null; then
        echo -e "${GREEN}✅ Supabase already running${NC}"
    else
        # Start Supabase
        supabase start
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Supabase started${NC}"
            
            # Wait a bit for Supabase to be ready
            echo "   Waiting for Supabase to be ready..."
            sleep 5
            
            # Run migrations
            echo "🔄 Running database migrations..."
            supabase db push
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Migrations applied${NC}"
            else
                echo -e "${YELLOW}⚠️  Migration failed - you may need to run manually${NC}"
            fi
        else
            echo -e "${RED}❌ Failed to start Supabase${NC}"
            echo "   Check Docker is running and try again"
            exit 1
        fi
    fi
    
    echo ""
    echo "📊 Supabase Info:"
    supabase status | grep -E "(API URL|anon key|service_role key|Studio URL)"
    echo ""
else
    echo -e "${YELLOW}⚠️  Supabase CLI or Docker not available${NC}"
    echo "   Make sure you've configured Supabase Cloud in .env"
    echo ""
fi

# Start development server
echo "🌐 Starting development server..."
echo ""
echo -e "${GREEN}✨ ValueCanvas is starting!${NC}"
echo ""
echo "📚 Documentation:"
echo "   - Setup Guide: LOCAL_SETUP_GUIDE.md"
echo "   - LLM-MARL: LLM_MARL_COMPLETE.md"
echo "   - Generative UI: GENERATIVE_UI_COMPLETE.md"
echo "   - SOF Guide: SOF_IMPLEMENTATION_GUIDE.md"
echo ""
echo "🔗 URLs:"
echo "   - Application: http://localhost:5173"
echo "   - Supabase Studio: http://localhost:54323"
echo ""
echo "Press Ctrl+C to stop"
echo ""

pnpm run dev
