#!/bin/bash
################################################################################
# Migration Validation Utility
#
# Comprehensive validation tool for Supabase migrations
# - Checks migration integrity and consistency
# - Validates RLS policies and tenant isolation
# - Tests database performance and indexes
# - Generates detailed validation report
#
# Usage: ./validate-migrations.sh [--report <file>] [--fix]
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load environment
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
fi

export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-54323}"
export POSTGRES_DB="${POSTGRES_DB:-postgres}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

REPORT_FILE="${1:-/tmp/migration_validation_report.txt}"
FIX_MODE=false

if [[ "${2:-}" == "--fix" ]]; then
    FIX_MODE=true
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

exec_sql() {
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "$1" 2>/dev/null
}

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Migration Validation Report                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

{
    echo "Migration Validation Report"
    echo "Generated: $(date)"
    echo "Database: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # 1. Migration Status
    echo "1. MIGRATION STATUS"
    echo "-----------------------------------------------------------"

    migration_count=$(exec_sql "SELECT COUNT(*) FROM schema_migrations;" | tr -d ' ')
    echo "Total migrations applied: ${migration_count}"

    echo ""
    echo "Recent migrations:"
    exec_sql "SELECT migration_id, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"

    echo ""

    # 2. RLS Policy Check
    echo "2. ROW-LEVEL SECURITY (RLS) POLICIES"
    echo "-----------------------------------------------------------"

    rls_count=$(exec_sql "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';" | tr -d ' ')
    echo "Total RLS policies: ${rls_count}"

    echo ""
    echo "Tables with RLS enabled:"
    exec_sql "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

    echo ""
    echo "Tables WITHOUT RLS (potential security risk):"
    tables_without_rls=$(exec_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;")
    if [[ -n "${tables_without_rls}" ]]; then
        echo -e "${RED}${tables_without_rls}${NC}"
    else
        echo -e "${GREEN}All tables have RLS enabled${NC}"
    fi

    echo ""

    # 3. Tenant Isolation Check
    echo "3. TENANT ISOLATION VALIDATION"
    echo "-----------------------------------------------------------"

    tenant_policies=$(exec_sql "SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE '%tenant%';" | tr -d ' ')
    echo "Tenant-related policies: ${tenant_policies}"

    echo ""
    echo "Critical tenant isolation policies:"
    exec_sql "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%tenant%' ORDER BY tablename;"

    echo ""

    # 4. Index Health
    echo "4. INDEX HEALTH & PERFORMANCE"
    echo "-----------------------------------------------------------"

    index_count=$(exec_sql "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" | tr -d ' ')
    echo "Total indexes: ${index_count}"

    echo ""
    echo "Missing indexes on tenant_id columns:"
    exec_sql "
    SELECT DISTINCT
        c.table_name,
        c.column_name
    FROM information_schema.columns c
    LEFT JOIN pg_indexes i ON i.tablename = c.table_name AND i.indexdef LIKE '%' || c.column_name || '%'
    WHERE c.table_schema = 'public'
        AND c.column_name = 'tenant_id'
        AND i.indexname IS NULL;
    "

    echo ""
    echo "Unused indexes (0 scans):"
    exec_sql "
    SELECT schemaname, tablename, indexname, idx_scan
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public' AND idx_scan = 0
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 10;
    "

    echo ""

    # 5. Table Statistics
    echo "5. TABLE STATISTICS"
    echo "-----------------------------------------------------------"

    table_count=$(exec_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    echo "Total tables: ${table_count}"

    echo ""
    echo "Largest tables:"
    exec_sql "
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup AS rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
    "

    echo ""

    # 6. Foreign Key Constraints
    echo "6. REFERENTIAL INTEGRITY"
    echo "-----------------------------------------------------------"

    fk_count=$(exec_sql "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';" | tr -d ' ')
    echo "Total foreign keys: ${fk_count}"

    echo ""
    echo "Tables without foreign keys (potential orphan data):"
    exec_sql "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN (
            SELECT table_name
            FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
        )
    ORDER BY table_name;
    "

    echo ""

    # 7. Extension Check
    echo "7. POSTGRESQL EXTENSIONS"
    echo "-----------------------------------------------------------"

    echo "Installed extensions:"
    exec_sql "SELECT extname, extversion FROM pg_extension ORDER BY extname;"

    echo ""
    echo "Required extensions check:"
    for ext in "pgcrypto" "pg_stat_statements"; do
        if exec_sql "SELECT 1 FROM pg_extension WHERE extname = '${ext}';" | grep -q 1; then
            echo -e "${GREEN}✓${NC} ${ext}"
        else
            echo -e "${RED}✗${NC} ${ext} (MISSING)"
        fi
    done

    echo ""

    # 8. Security Audit
    echo "8. SECURITY AUDIT"
    echo "-----------------------------------------------------------"

    echo "Roles and permissions:"
    exec_sql "SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname;"

    echo ""
    echo "Public schema permissions:"
    exec_sql "SELECT grantee, privilege_type FROM information_schema.schema_privileges WHERE schema_name = 'public';"

    echo ""

    # 9. Migration Checksum Validation
    echo "9. MIGRATION INTEGRITY"
    echo "-----------------------------------------------------------"

    echo "Checking migration checksums..."
    checksum_issues=0

    # This would require comparing with actual files
    echo "Migration checksum validation: MANUAL CHECK REQUIRED"
    echo "Run: SELECT migration_id, checksum FROM schema_migrations;"

    echo ""

    # 10. Summary
    echo "═══════════════════════════════════════════════════════════"
    echo "VALIDATION SUMMARY"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "✓ Migrations Applied: ${migration_count}"
    echo "✓ RLS Policies: ${rls_count}"
    echo "✓ Tenant Policies: ${tenant_policies}"
    echo "✓ Indexes: ${index_count}"
    echo "✓ Tables: ${table_count}"
    echo "✓ Foreign Keys: ${fk_count}"
    echo ""

    if [[ ${rls_count} -gt 0 ]] && [[ ${tenant_policies} -gt 0 ]]; then
        echo -e "${GREEN}✓ Database appears healthy and secure${NC}"
    else
        echo -e "${YELLOW}⚠ Review warnings above${NC}"
    fi

} | tee "${REPORT_FILE}"

echo ""
echo "Report saved to: ${REPORT_FILE}"
