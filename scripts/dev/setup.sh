#!/bin/bash

# ValueCanvas Dev Environment Setup
# Sets up dependencies and local environment (no services started by default)

set -e  # Exit on error

START_DEV_SERVER="${START_DEV_SERVER:-}"
SEED_DB="${SEED_DB:-}"

usage() {
    echo "Usage: bash scripts/dev/setup.sh [--start] [--seed]"
    echo ""
    echo "Options:"
    echo "  --start   Start the dev environment via npm run dx after setup"
    echo "  --seed    Seed the database after setup (requires a running database)"
}

for arg in "$@"; do
    case "$arg" in
        --start)
            START_DEV_SERVER="true"
            ;;
        --seed)
            SEED_DB="true"
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "❌ Unknown option: ${arg}"
            usage
            exit 1
            ;;
    esac
done

echo "🚀 ValueCanvas - Dev Environment Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

is_truthy() {
    case "${1}" in
        [Tt][Rr][Uu][Ee]|[Yy][Ee][Ss]|1) return 0 ;;
        *) return 1 ;;
    esac
}

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
echo -e "${BLUE}📋 Step 1: Checking Prerequisites${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not installed${NC}"
    echo "   Install from: https://nodejs.org (v18 or higher)"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION}${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm ${NPM_VERSION}${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    echo "   Install from: https://www.docker.com/products/docker-desktop"
    echo "   Required for Supabase local development"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "   Please start Docker Desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker installed and running${NC}"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not installed${NC}"
    echo "   Install manually: npm install -g supabase"
    exit 1
else
    SUPABASE_VERSION=$(supabase --version 2>&1 | head -n 1 || echo "unknown")
    echo -e "${GREEN}✅ Supabase CLI ${SUPABASE_VERSION}${NC}"
fi

echo ""

# ============================================================================
# Step 2: Install Dependencies
# ============================================================================
echo -e "${BLUE}📦 Step 2: Installing Node.js Dependencies${NC}"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies (this may take a few minutes)..."
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo "node_modules exists. Checking for updates..."
    npm install
    echo -e "${GREEN}✅ Dependencies up to date${NC}"
fi

echo ""

# ============================================================================
# Step 3: Set Up Environment Variables
# ============================================================================
echo -e "${BLUE}⚙️  Step 3: Setting Up Environment Variables${NC}"
echo ""

if [ ! -f ".env.local" ]; then
    echo "Creating .env.local from .env.example..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✅ Created .env.local${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.local and add your API keys${NC}"
        echo ""
        echo "   Required configuration:"
        echo "   - VITE_LLM_API_KEY (get from https://together.ai)"
        echo "   - VITE_SUPABASE_URL (set after Supabase starts)"
        echo "   - VITE_SUPABASE_ANON_KEY (set after Supabase starts)"
        echo ""
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env.local exists${NC}"
fi

# Create .env if it doesn't exist (some tools expect .env)
if [ ! -f ".env" ]; then
    cp .env.local .env
    echo -e "${GREEN}✅ Created .env from .env.local${NC}"
fi

echo ""

# ============================================================================
# Setup Complete - Show Summary
# ============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Dev Environment Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🔗 URLs:"
echo "   - Application:      http://localhost:5173"
echo "   - Supabase Studio:  http://localhost:54323"
echo "   - Supabase API:     http://localhost:54321"
echo ""
echo "📝 Next Steps:"
echo "   1. Edit .env.local and add your LLM API key (VITE_LLM_API_KEY)"
echo "   2. Run: npm run dx"
echo "   3. Open http://localhost:5173"
echo ""
echo "💡 Useful Commands:"
echo "   - Start dev server:     npm run dx"
echo "   - Run tests:            npm test"
echo "   - Supabase Studio:      open http://localhost:54323"
echo "   - Stop Supabase:        supabase stop"
echo "   - View Supabase logs:   supabase logs"
echo ""

load_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
}

if is_truthy "$SEED_DB"; then
    echo -e "${BLUE}🌱 Seeding database${NC}"
    load_env_file ".env.local"
    bash scripts/db-seed.sh "${SEED_ENVIRONMENT:-development}"
    echo ""
fi

if is_truthy "$START_DEV_SERVER"; then
    echo -e "${BLUE}🌐 Starting development environment (npm run dx)${NC}"
    echo ""
    npm run dx
else
    echo "To start the development environment later, run:"
    echo "   npm run dx"
    echo ""
fi
