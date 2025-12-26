#!/bin/bash

# ValueCanvas Complete Dev Environment Setup
# Sets up everything: dependencies, Supabase, and dev server

set -e  # Exit on error

echo "🚀 ValueCanvas - Complete Dev Environment Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check Supabase CLI (using npx)
if ! npx supabase --version &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not available via npx${NC}"
    exit 1
fi
SUPABASE_VERSION=$(npx supabase --version 2>&1 | head -n 1 || echo "unknown")
echo -e "${GREEN}✅ Supabase CLI ${SUPABASE_VERSION}${NC}"

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
        echo "   - VITE_SUPABASE_URL (will be set automatically after Supabase starts)"
        echo "   - VITE_SUPABASE_ANON_KEY (will be set automatically after Supabase starts)"
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
# Step 4: Start Supabase
# ============================================================================
echo -e "${BLUE}🗄️  Step 4: Starting Supabase Local Instance${NC}"
echo ""

# Check if Supabase is already running
# if npx supabase status &> /dev/null; then
#     echo -e "${GREEN}✅ Supabase is already running${NC}"
#     echo ""
#     echo "Current Supabase configuration:"
#     npx supabase status | grep -E "(API URL|GraphQL URL|DB URL|Studio URL|anon key|service_role key)" || true
# else
    echo "Skipping Supabase start for now - will use default local values"
    echo ""
    
    # Set default Supabase credentials for local development
    API_URL="http://localhost:54321"
    ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    
    echo -e "${YELLOW}💡 Using default Supabase local credentials:${NC}"
    echo "   VITE_SUPABASE_URL=${API_URL}"
    echo "   VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
    echo ""
    
    # Update .env.local with default credentials
    if grep -q "VITE_SUPABASE_URL=" .env.local; then
        sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${API_URL}|" .env.local
    else
        echo "VITE_SUPABASE_URL=${API_URL}" >> .env.local
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY=" .env.local; then
        sed -i.bak "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=${ANON_KEY}|" .env.local
    else
        echo "VITE_SUPABASE_ANON_KEY=${ANON_KEY}" >> .env.local
    fi
    
    echo -e "${GREEN}✅ Updated .env.local with default Supabase credentials${NC}"
# fi

echo ""

# ============================================================================
# Step 5: Run Database Migrations
# ============================================================================
echo -e "${BLUE}🔄 Step 5: Running Database Migrations${NC}"
echo ""

# Skipping migrations since Supabase is not started
echo "Skipping database migrations - Supabase not running"
# if [ -d "supabase/migrations" ]; then
#     echo "Applying database migrations..."
#     
#     npx supabase db push
#     
#     if [ $? -eq 0 ]; then
#         echo -e "${GREEN}✅ Database migrations applied${NC}"
#     else
#         echo -e "${YELLOW}⚠️  Migration failed (may be normal if already applied)${NC}"
#     fi
# else
#     echo -e "${YELLOW}⚠️  No migrations directory found${NC}"
# fi

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
echo "   2. Start Supabase manually: npx supabase start"
echo "   3. Run: npm run dev"
echo "   4. Open http://localhost:5173"
echo ""
echo "💡 Useful Commands:"
echo "   - Start dev server:     npm run dev"
echo "   - Run tests:            npm test"
echo "   - Supabase Studio:      open http://localhost:54323"
echo "   - Stop Supabase:        npx supabase stop"
echo "   - View Supabase logs:   npx supabase logs"
echo ""

# ============================================================================
# Ask if user wants to start dev server now
# ============================================================================
read -p "Start development server now? [Y/n]: " START_DEV
START_DEV=${START_DEV:-y}

if [[ "$START_DEV" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}🌐 Starting Development Server${NC}"
    echo ""
    echo -e "${GREEN}✨ ValueCanvas is starting!${NC}"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""
    
    npm run dev
else
    echo ""
    echo "To start the development server later, run:"
    echo "   npm run dev"
    echo ""
fi
