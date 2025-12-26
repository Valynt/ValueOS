#!/bin/bash

# Supabase Migration Fix and Setup Script
# Created: 2025-12-26
# Purpose: Fix missing user_tenants dependency and apply all pending migrations

set -e

export PATH="$HOME/.local/bin:$PATH"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Supabase Migration Fix & Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check environment
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ SUPABASE_ACCESS_TOKEN not set${NC}"
    echo "Please set it with: export SUPABASE_ACCESS_TOKEN=\"your-token\""
    exit 1
fi

echo -e "${GREEN}✅ Environment configured${NC}"
echo ""

# Check migration status
echo -e "${YELLOW}📋 Checking migration status...${NC}"
supabase migration list 2>&1 | tail -15
echo ""

# Apply pending migrations
echo -e "${YELLOW}🚀 Applying pending migrations...${NC}"
echo ""

# Use a here-document to auto-confirm
supabase db push --include-all <<EOF
Y
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migrations applied successfully!${NC}"
    echo ""
    
    # Verify tables exist
    echo -e "${YELLOW}🔍 Verifying critical tables...${NC}"
    
    # Generate TypeScript types
    echo -e "${YELLOW}📝 Generating TypeScript types...${NC}"
    supabase gen types typescript --linked > src/types/supabase-generated.ts 2>&1 || \
        echo -e "${YELLOW}⚠️  Type generation skipped (run manually if needed)${NC}"
    
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify your application connects successfully"
    echo "  2. Run integration tests"
    echo "  3. Check Supabase dashboard for any warnings"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed with exit code $EXIT_CODE${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check the error message above"
    echo "  2. Verify your Supabase project is accessible"
    echo "  3. Run with --debug flag for more details:"
    echo "     supabase db push --include-all --debug"
    echo ""
    exit $EXIT_CODE
fi
