#!/bin/bash

# Supabase Setup Script
# Sets up Supabase with 18-table schema and enables RLS

set -e

echo "🔧 ValueCanvas Supabase Setup"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${RED}❌ SUPABASE_PROJECT_ID not set${NC}"
    exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo -e "${RED}❌ SUPABASE_DB_PASSWORD not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}"
echo ""

# Link to Supabase project
echo "🔗 Linking to Supabase project..."
supabase link --project-ref "$SUPABASE_PROJECT_ID"

# Run migrations
echo ""
echo "📦 Running database migrations..."
echo ""

# Count migrations
MIGRATION_COUNT=$(ls -1 ../../supabase/migrations/*.sql 2>/dev/null | wc -l)
echo "  Found $MIGRATION_COUNT migration files"
echo ""

# Push all migrations to Supabase
echo "  → Applying migrations to remote database..."
cd ../..
supabase db push || {
    echo -e "${RED}❌ Failed to apply migrations${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check your internet connection"
    echo "  2. Verify project is linked: supabase link --project-ref $SUPABASE_PROJECT_ID"
    echo "  3. Check migration files for syntax errors"
    echo ""
    exit 1
}
cd infrastructure/supabase

echo -e "${GREEN}✅ All migrations applied successfully${NC}"
echo ""

# Verify RLS is enabled
echo "🔒 Verifying Row Level Security..."
echo ""

RLS_CHECK=$(supabase db execute --sql "
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
")

if [ -z "$RLS_CHECK" ]; then
    echo -e "${GREEN}✅ RLS enabled on all tables${NC}"
else
    echo -e "${YELLOW}⚠️  RLS not enabled on some tables:${NC}"
    echo "$RLS_CHECK"
    echo ""
    echo "Enabling RLS on all tables..."
    
    supabase db execute --sql "
    DO \$\$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN 
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        LOOP
            EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
        END LOOP;
    END \$\$;
    "
    
    echo -e "${GREEN}✅ RLS enabled on all tables${NC}"
fi

echo ""

# Verify table count
echo "📊 Verifying table count..."
TABLE_COUNT=$(supabase db execute --sql "
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
" | tail -1)

echo "  Tables created: $TABLE_COUNT"

if [ "$TABLE_COUNT" -ge 18 ]; then
    echo -e "${GREEN}✅ All tables created${NC}"
else
    echo -e "${YELLOW}⚠️  Expected at least 18 tables, found $TABLE_COUNT${NC}"
fi

echo ""

# Create service role if needed
echo "🔑 Setting up service roles..."
supabase db execute --sql "
-- Create service role for backend
CREATE ROLE IF NOT EXISTS service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
"

echo -e "${GREEN}✅ Service roles configured${NC}"
echo ""

# Generate types
echo "📝 Generating TypeScript types..."
supabase gen types typescript --local > ../../src/types/supabase.ts
echo -e "${GREEN}✅ Types generated${NC}"
echo ""

# Test connection
echo "🧪 Testing database connection..."
supabase db execute --sql "SELECT version();" > /dev/null
echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Summary
echo "=============================="
echo -e "${GREEN}✅ Supabase setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update .env with Supabase credentials"
echo "  2. Test application connection"
echo "  3. Run seed data (if needed)"
echo ""
echo "Supabase Dashboard: https://app.supabase.com/project/$SUPABASE_PROJECT_ID"
echo ""
