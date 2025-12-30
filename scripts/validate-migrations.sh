#!/bin/bash
###############################################################################
# Database Migration Validation Script
# Validates migration files and provides deployment checklist
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Database Migration Validation Report               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

MIGRATION_DIR="supabase/migrations"

# Check if migration directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}✗ Migration directory not found: $MIGRATION_DIR${NC}"
    exit 1
fi

# Count migrations
MIGRATION_COUNT=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l)
echo -e "${BLUE}📊 Migration Statistics${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total migrations: $MIGRATION_COUNT"
echo ""

# List migrations
echo -e "${BLUE}📋 Migration Files${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | while read -r file; do
    filename=$(basename "$file")
    size=$(du -h "$file" | cut -f1)
    echo -e "${GREEN}✓${NC} $filename ($size)"
done
echo ""

# Check for squashed schema
if [ -f "$MIGRATION_DIR/20241227000000_squashed_schema.sql" ]; then
    echo -e "${YELLOW}⚠ NOTICE: Squashed schema detected${NC}"
    echo "  This suggests previous migrations were consolidated."
    echo "  Ensure this is the baseline for production deployment."
    echo ""
fi

# Validate SQL syntax (basic check)
echo -e "${BLUE}🔍 Syntax Validation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SYNTAX_ERRORS=0
for file in "$MIGRATION_DIR"/*.sql; do
    filename=$(basename "$file")
    
    # Check for common SQL syntax issues
    if grep -q "DROP TABLE.*IF NOT EXISTS" "$file"; then
        echo -e "${RED}✗ $filename: Invalid syntax 'DROP TABLE IF NOT EXISTS'${NC}"
        ((SYNTAX_ERRORS++))
    fi
    
    # Check for missing semicolons (basic check)
    if ! tail -1 "$file" | grep -q ";"; then
        echo -e "${YELLOW}⚠ $filename: May be missing final semicolon${NC}"
    fi
done

if [ $SYNTAX_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ No obvious syntax errors detected${NC}"
else
    echo -e "${RED}✗ Found $SYNTAX_ERRORS syntax issues${NC}"
fi
echo ""

# Check for RLS policies
echo -e "${BLUE}🔒 Row-Level Security (RLS) Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RLS_COUNT=0
for file in "$MIGRATION_DIR"/*.sql; do
    if grep -q "ENABLE ROW LEVEL SECURITY" "$file"; then
        ((RLS_COUNT++))
    fi
done

if [ $RLS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ RLS policies found in $RLS_COUNT migration(s)${NC}"
else
    echo -e "${YELLOW}⚠ No RLS policies detected - verify multi-tenant isolation${NC}"
fi
echo ""

# Check for indexes
echo -e "${BLUE}⚡ Index Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INDEX_COUNT=0
for file in "$MIGRATION_DIR"/*.sql; do
    count=$(grep -c "CREATE.*INDEX" "$file" || true)
    INDEX_COUNT=$((INDEX_COUNT + count))
done

if [ $INDEX_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ Found $INDEX_COUNT index definitions${NC}"
else
    echo -e "${YELLOW}⚠ No indexes detected - may impact performance${NC}"
fi
echo ""

# Pre-deployment checklist
echo -e "${BLUE}📋 Pre-Deployment Checklist${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Before running migrations in production:"
echo ""
echo "[ ] 1. Backup production database"
echo "       Command: npm run db:backup"
echo ""
echo "[ ] 2. Test migrations on staging environment"
echo "       Command: npm run env:staging && supabase db push"
echo ""
echo "[ ] 3. Verify RLS policies are enabled"
echo "       Command: npm run test:rls"
echo ""
echo "[ ] 4. Check for breaking schema changes"
echo "       Review: Migration files for DROP/ALTER statements"
echo ""
echo "[ ] 5. Prepare rollback plan"
echo "       Document: Current schema version and rollback SQL"
echo ""
echo "[ ] 6. Schedule maintenance window (if needed)"
echo "       Notify: Users of potential downtime"
echo ""
echo "[ ] 7. Monitor migration execution"
echo "       Watch: Database logs and error rates"
echo ""
echo "[ ] 8. Verify data integrity post-migration"
echo "       Run: Data validation queries"
echo ""

# Deployment commands
echo -e "${BLUE}🚀 Deployment Commands${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# Staging deployment:"
echo "npm run env:staging"
echo "supabase db push"
echo ""
echo "# Production deployment:"
echo "npm run env:production"
echo "npm run db:backup  # CRITICAL: Backup first!"
echo "supabase db push"
echo ""
echo "# Rollback (if needed):"
echo "npm run db:restore"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $SYNTAX_ERRORS -eq 0 ] && [ $RLS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Migrations appear ready for deployment${NC}"
    echo "Complete the pre-deployment checklist before proceeding."
    exit 0
else
    echo -e "${YELLOW}⚠️  Review warnings before deployment${NC}"
    echo "Address any issues identified above."
    exit 0
fi
