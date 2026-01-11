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

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
    echo ""
    read -p "Install Supabase CLI now? [Y/n]: " INSTALL_SUPABASE
    INSTALL_SUPABASE=${INSTALL_SUPABASE:-y}
    
    if [[ "$INSTALL_SUPABASE" =~ ^[Yy]$ ]]; then
        echo "📦 Installing Supabase CLI..."
        npm install -g supabase
        echo -e "${GREEN}✅ Supabase CLI installed${NC}"
    else
        echo -e "${RED}❌ Supabase CLI required for local development${NC}"
        echo "   Install manually: npm install -g supabase"
        exit 1
    fi
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
if supabase status &> /dev/null; then
    echo -e "${GREEN}✅ Supabase is already running${NC}"
    echo ""
    echo "Current Supabase configuration:"
    supabase status | grep -E "(API URL|GraphQL URL|DB URL|Studio URL|anon key|service_role key)" || true
else
    echo "Starting Supabase (this will pull Docker images on first run)..."
    echo "This may take 2-3 minutes on first setup..."
    echo ""
    
    supabase start
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Supabase started successfully${NC}"
        echo ""
        echo "📊 Supabase Local Configuration:"
        echo "================================"
        supabase status
        echo ""
        
        # Extract Supabase credentials
        API_URL=$(supabase status | grep "API URL" | awk '{print $3}')
        ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')
        
        echo -e "${YELLOW}💡 TIP: Update your .env.local with these values:${NC}"
        echo "   VITE_SUPABASE_URL=${API_URL}"
        echo "   VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
        echo ""
        
        # Optionally auto-update .env.local
        read -p "Auto-update .env.local with Supabase credentials? [Y/n]: " UPDATE_ENV
        UPDATE_ENV=${UPDATE_ENV:-y}
        
        if [[ "$UPDATE_ENV" =~ ^[Yy]$ ]]; then
            # Backup .env.local
            cp .env.local .env.local.backup
            
            # Update or add Supabase credentials
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
            
            # Clean up backup files
            rm -f .env.local.bak .env.local.backup
            
            echo -e "${GREEN}✅ Updated .env.local with Supabase credentials${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to start Supabase${NC}"
        echo "   Check Docker is running and try again"
        exit 1
    fi
fi

echo ""

# ============================================================================
# Step 5: Run Database Migrations
# ============================================================================
echo -e "${BLUE}🔄 Step 5: Running Database Migrations${NC}"
echo ""

if [ -d "supabase/migrations" ]; then
    echo "Applying database migrations..."
    
    supabase db push
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database migrations applied${NC}"
    else
        echo -e "${YELLOW}⚠️  Migration failed (may be normal if already applied)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No migrations directory found${NC}"
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
echo "   2. Run: npm run dev"
echo "   3. Open http://localhost:5173"
echo ""
echo "💡 Useful Commands:"
echo "   - Start dev server:     npm run dev"
echo "   - Run tests:            npm test"
echo "   - Supabase Studio:      open http://localhost:54323"
echo "   - Stop Supabase:        supabase stop"
echo "   - View Supabase logs:   supabase logs"
echo ""

# ============================================================================
# Ask if user wants to start dev server now
# ============================================================================
is_port_in_use() {
    local port="$1"
    if command -v lsof &> /dev/null; then
        lsof -iTCP:"${port}" -sTCP:LISTEN -t &> /dev/null
        return $?
    elif command -v ss &> /dev/null; then
        ss -ltn | awk '{print $4}' | grep -qE "(^|:)${port}$"
        return $?
    elif command -v netstat &> /dev/null; then
        netstat -ltn | awk '{print $4}' | grep -qE "(^|:)${port}$"
        return $?
    fi
    return 1
}

DEV_SERVER_PORT=5173
BACKEND_SERVER_PORT=3000
RUNNING_PROCESSES=()

if is_port_in_use "${DEV_SERVER_PORT}"; then
    RUNNING_PROCESSES+=("Vite (port ${DEV_SERVER_PORT})")
fi

if is_port_in_use "${BACKEND_SERVER_PORT}"; then
    RUNNING_PROCESSES+=("Backend API (port ${BACKEND_SERVER_PORT})")
fi

if [ ${#RUNNING_PROCESSES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Detected running dev processes:${NC} ${RUNNING_PROCESSES[*]}"
    echo "   Auto-start will skip launching another dev server."
    echo ""
fi

if [[ "${START_DEV_SERVER}" =~ ^(n|no|0)$ ]]; then
    START_DEV="n"
else
    read -p "Start development server now? [Y/n] (set START_DEV_SERVER=no to skip): " START_DEV
    START_DEV=${START_DEV:-y}
fi

if [[ "$START_DEV" =~ ^[Yy]$ ]]; then
    if [ ${#RUNNING_PROCESSES[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Skipping dev server start because ports are already in use.${NC}"
        echo "   Stop the running processes above or run: npm run dev"
        echo ""
    else
        echo ""
        echo -e "${BLUE}🌐 Starting Development Server${NC}"
        echo ""
        echo -e "${GREEN}✨ ValueCanvas is starting!${NC}"
        echo ""
        echo "Press Ctrl+C to stop"
        echo ""
        
        npm run dev
    fi
else
    echo ""
    echo "To start the development server later, run:"
    echo "   npm run dev"
    echo ""
fi
