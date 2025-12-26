#!/bin/bash

# Apply Pending Supabase Migrations
# This script applies all pending migrations to your cloud Supabase instance

set -e

export PATH="$HOME/.local/bin:$PATH"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Applying Pending Supabase Migrations"
echo "========================================"
echo ""

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ SUPABASE_ACCESS_TOKEN not set${NC}"
    echo "Set it with: export SUPABASE_ACCESS_TOKEN=\"your-token\""
    exit 1
fi

echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Show pending migrations
echo -e "${YELLOW}📋 Pending migrations:${NC}"
supabase migration list 2>&1 | grep -E "^\s+[0-9]+\s+\|$" | head -15 || true
echo ""

# Apply migrations
echo -e "${YELLOW}🔄 Applying migrations...${NC}"
echo ""

# Run the push command
if supabase db push --include-all 2>&1; then
    echo ""
    echo -e "${GREEN}✅ All migrations applied successfully!${NC}"
    echo ""
    
    # Generate types
    echo -e "${YELLOW}📝 Generating TypeScript types...${NC}"
    if supabase gen types typescript --linked > src/types/supabase-generated.ts 2>&1; then
        echo -e "${GREEN}✅ Types generated${NC}"
    else
        echo -e "${YELLOW}⚠️  Type generation failed (non-critical)${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo -e "${GREEN}================================${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed${NC}"
    echo "See error above for details"
    exit 1
fi
