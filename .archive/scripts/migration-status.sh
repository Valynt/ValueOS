#!/bin/bash
################################################################################
# Quick Migration Status Checker
#
# Fast status check for database migrations
#
# Usage: ./migration-status.sh [--watch]
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

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_status() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║          Migration Status Dashboard                       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Database: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo "Updated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Connection test
    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection: OK${NC}"
    else
        echo -e "${RED}✗ Database connection: FAILED${NC}"
        return 1
    fi
    
    # Migration count
    local migration_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d ' ' || echo "0")
    echo -e "${GREEN}✓ Applied migrations: ${migration_count}${NC}"
    
    # RLS policies
    local rls_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
    echo -e "${GREEN}✓ RLS policies: ${rls_count}${NC}"
    
    # Table count
    local table_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
    echo -e "${GREEN}✓ Tables: ${table_count}${NC}"
    
    # Index count
    local index_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
    echo -e "${GREEN}✓ Indexes: ${index_count}${NC}"
    
    echo ""
    echo "─────────────────────────────────────────────────────────────"
    echo "Recent Migrations:"
    echo "─────────────────────────────────────────────────────────────"
    
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
    SELECT 
        SUBSTRING(migration_id, 1, 40) as migration,
        TO_CHAR(applied_at, 'YYYY-MM-DD HH24:MI:SS') as applied
    FROM schema_migrations 
    ORDER BY applied_at DESC 
    LIMIT 5;
    " 2>/dev/null || echo "No migrations found"
    
    echo ""
    echo "─────────────────────────────────────────────────────────────"
    echo "Database Size:"
    echo "─────────────────────────────────────────────────────────────"
    
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
    SELECT 
        pg_size_pretty(pg_database_size('${POSTGRES_DB}')) as total_size;
    " 2>/dev/null || echo "Unable to determine size"
    
    echo ""
}

if [[ "${1:-}" == "--watch" ]]; then
    echo "Watching migration status (Ctrl+C to exit)..."
    while true; do
        show_status
        sleep 5
    done
else
    show_status
fi
