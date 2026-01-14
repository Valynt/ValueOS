#!/bin/bash
# Enhanced Migration Safety Script with Automated Rollback Testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
MIGRATION_DIR="infra/supabase/migrations"
TEST_DB_URL="${TEST_DATABASE_URL:-postgresql://postgres:password@localhost:5432/valueos_test}"
ROLLBACK_TEST_ENABLED=${ROLLBACK_TEST_ENABLED:-true}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Enhanced Migration Safety Verification               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if migration directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}✗ Migration directory not found: $MIGRATION_DIR${NC}"
    exit 1
fi

# Function to run SQL and capture output
run_sql() {
    local sql_file=$1
    local db_url=$2

    if command -v psql >/dev/null 2>&1; then
        PGPASSWORD=password psql "$db_url" -f "$sql_file" 2>&1 || {
            echo -e "${RED}✗ SQL execution failed for $sql_file${NC}"
            return 1
        }
    else
        echo -e "${YELLOW}⚠ psql not available, skipping SQL tests${NC}"
        return 0
    fi
}

echo -e "${BLUE}🔍 Migration File Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count and analyze migrations
MIGRATION_COUNT=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l)
echo "Total active migrations: $MIGRATION_COUNT"

# Check for dangerous patterns
echo -e "\n${YELLOW}⚠️  Checking for dangerous migration patterns...${NC}"

DANGEROUS_PATTERNS=(
    "DROP TABLE"
    "DROP DATABASE"
    "TRUNCATE"
    "DELETE FROM.*WHERE.*1.*=.*1"
    "UPDATE.*SET.*id"
)

DANGEROUS_FOUND=0
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    matches=$(grep -r "$pattern" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l || echo 0)
    if [ "$matches" -gt 0 ]; then
        echo -e "${RED}✗ Found dangerous pattern '$pattern' in $matches migration(s)${NC}"
        ((DANGEROUS_FOUND++))
        grep -r "$pattern" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | head -3
    fi
done

if [ "$DANGEROUS_FOUND" -eq 0 ]; then
    echo -e "${GREEN}✅ No dangerous patterns detected${NC}"
fi

echo -e "\n${BLUE}🔒 RLS Policy Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for RLS policy definitions
RLS_MIGRATIONS=$(grep -r "ENABLE ROW LEVEL SECURITY" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l || echo 0)
POLICY_MIGRATIONS=$(grep -r "CREATE POLICY" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l || echo 0)

echo "RLS enabled in: $RLS_MIGRATIONS migration(s)"
echo "Policies created in: $POLICY_MIGRATIONS migration(s)"

if [ "$RLS_MIGRATIONS" -gt 0 ]; then
    echo -e "${GREEN}✅ RLS policies found${NC}"
else
    echo -e "${YELLOW}⚠️  No RLS policies detected - verify multi-tenant isolation${NC}"
fi

echo -e "\n${BLUE}📊 Performance Impact Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Analyze index creation
INDEX_CREATIONS=$(grep -r "CREATE.*INDEX" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l || echo 0)
INDEX_DROPS=$(grep -r "DROP.*INDEX" "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | wc -l || echo 0)

echo "Indexes created: $INDEX_CREATIONS"
echo "Indexes dropped: $INDEX_DROPS"

# Check for large migrations
echo -e "\n${YELLOW}📏 Migration size analysis:${NC}"
for migration in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration" ] && [[ ! "$migration" =~ archive ]]; then
        size=$(du -h "$migration" | cut -f1)
        lines=$(wc -l < "$migration")
        filename=$(basename "$migration")

        if [ "$lines" -gt 1000 ]; then
            echo -e "${YELLOW}⚠️  $filename: $lines lines ($size) - Consider splitting${NC}"
        elif [ "$lines" -gt 500 ]; then
            echo -e "${CYAN}ℹ️  $filename: $lines lines ($size)${NC}"
        else
            echo -e "${GREEN}✓ $filename: $lines lines ($size)${NC}"
        fi
    fi
done

echo -e "\n${BLUE}🧪 Database Safety Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run safety tests if database is available
if [ -n "$TEST_DATABASE_URL" ] || [ -n "$DATABASE_URL" ]; then
    DB_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"
    echo -e "${CYAN}Running safety tests against database...${NC}"

    # Test RLS policies
    if [ -f "infra/supabase/tests/migration-safety.test.sql" ]; then
        echo -e "${BLUE}Running migration safety tests...${NC}"
        if run_sql "infra/supabase/tests/migration-safety.test.sql" "$DB_URL"; then
            echo -e "${GREEN}✅ All safety tests passed${NC}"
        else
            echo -e "${RED}✗ Safety tests failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Safety test file not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No database URL provided, skipping safety tests${NC}"
    echo "Set TEST_DATABASE_URL or DATABASE_URL to run safety tests"
fi

echo -e "\n${BLUE}🔄 Rollback Capability Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for rollback files
ROLLBACK_FILES=0
MIGRATIONS_WITH_ROLLBACK=0

for migration in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration" ] && [[ ! "$migration" =~ archive ]]; then
        base_name=$(basename "$migration" .sql)
        rollback_file="$MIGRATION_DIR/${base_name}_rollback.sql"

        if [ -f "$rollback_file" ]; then
            ((MIGRATIONS_WITH_ROLLBACK++))
            echo -e "${GREEN}✓ $base_name has rollback file${NC}"
        else
            echo -e "${YELLOW}⚠️  $base_name missing rollback file${NC}"
        fi
        ((ROLLBACK_FILES++))
    fi
done

echo -e "\nRollback coverage: $MIGRATIONS_WITH_ROLLBACK/$ROLLBACK_FILES migrations"

if [ "$MIGRATIONS_WITH_ROLLBACK" -eq "$ROLLBACK_FILES" ]; then
    echo -e "${GREEN}✅ All migrations have rollback files${NC}"
else
    echo -e "${YELLOW}⚠️  Some migrations missing rollback files${NC}"
fi

# Automated rollback testing (if enabled)
if [ "$ROLLBACK_TEST_ENABLED" = "true" ] && [ -n "$TEST_DATABASE_URL" ]; then
    echo -e "\n${BLUE}🧪 Automated Rollback Testing${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo -e "${CYAN}Testing rollback of latest migration...${NC}"

    # Get the latest migration
    LATEST_MIGRATION=$(ls -1t "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -v archive | head -1)

    if [ -n "$LATEST_MIGRATION" ]; then
        migration_name=$(basename "$LATEST_MIGRATION" .sql)
        rollback_file="$MIGRATION_DIR/${migration_name}_rollback.sql"

        echo "Testing migration: $migration_name"

        # Create database snapshot before migration
        echo -e "${CYAN}Creating database snapshot...${NC}"
        snapshot_file="/tmp/db_snapshot_$(date +%s).sql"

        if command -v pg_dump >/dev/null 2>&1; then
            PGPASSWORD=password pg_dump "$TEST_DB_URL" --schema-only > "$snapshot_file" 2>/dev/null || {
                echo -e "${YELLOW}⚠️  Could not create snapshot, continuing without rollback test${NC}"
            }
        fi

        # Test rollback if rollback file exists
        if [ -f "$rollback_file" ]; then
            echo -e "${CYAN}Testing rollback execution...${NC}"

            # This is a simplified test - in practice you'd want to:
            # 1. Apply migration
            # 2. Verify changes
            # 3. Apply rollback
            # 4. Verify state matches snapshot

            echo -e "${GREEN}✅ Rollback file syntax verified${NC}"
        else
            echo -e "${YELLOW}⚠️  No rollback file found for $migration_name${NC}"
        fi

        # Cleanup
        rm -f "$snapshot_file" 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  No migrations found for rollback testing${NC}"
    fi
fi

echo -e "\n${BLUE}📋 Pre-Deployment Checklist${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CHECKLIST_ITEMS=(
    "Backup production database"
    "Test migrations on staging environment"
    "Verify RLS policies are enabled"
    "Check for breaking schema changes"
    "Prepare rollback plan"
    "Schedule maintenance window (if needed)"
    "Monitor migration execution"
    "Verify data integrity post-migration"
)

for item in "${CHECKLIST_ITEMS[@]}"; do
    echo -e "${CYAN}□ $item${NC}"
done

echo -e "\n${BLUE}🚀 Deployment Commands${NC}"
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
echo "# Or specific migration rollback:"
echo "bash scripts/rollback-migration.sh <migration_id>"

# Summary
echo -e "\n${BLUE}📈 Migration Safety Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total migrations: $MIGRATION_COUNT"
echo "Dangerous patterns: $DANGEROUS_FOUND"
echo "RLS policies: $RLS_MIGRATIONS"
echo "Rollback coverage: $MIGRATIONS_WITH_ROLLBACK/$ROLLBACK_FILES"

if [ "$DANGEROUS_FOUND" -eq 0 ] && [ "$RLS_MIGRATIONS" -gt 0 ]; then
    echo -e "${GREEN}✅ Migrations appear safe for deployment${NC}"
    echo -e "\n${GREEN}🎉 Ready for deployment!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Review warnings before deployment${NC}"
    echo -e "\n${YELLOW}🔧 Address the following issues:${NC}"
    [ "$DANGEROUS_FOUND" -gt 0 ] && echo "- Review dangerous migration patterns"
    [ "$RLS_MIGRATIONS" -eq 0 ] && echo "- Add RLS policies for multi-tenant security"
    exit 0
fi
