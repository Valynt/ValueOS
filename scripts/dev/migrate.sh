#!/bin/bash
###############################################################################
# Idempotent Database Migration Script
#
# Applies Supabase migrations. Falls back to psql if Supabase CLI has TLS issues.
#
# Usage: bash scripts/dev/migrate.sh [--dry-run] [--debug] [--psql-only]
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
SUPABASE_WORKDIR="${SUPABASE_WORKDIR:-infra/supabase}"
MIGRATIONS_DIR="${PROJECT_ROOT}/${SUPABASE_WORKDIR}/migrations"

# CRITICAL: Always force sslmode=disable for local dev (container postgres has no TLS)
export PGSSLMODE=disable
export PGPASSWORD="${DB_PASSWORD}"

# Parse arguments
DRY_RUN=false
DEBUG=false
PSQL_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --psql-only)
            PSQL_ONLY=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Validate migrations directory exists
if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
    echo -e "${YELLOW}⚠️ Warning: ${MIGRATIONS_DIR} not found. Skipping migrations.${NC}"
    exit 0
fi

echo "🔄 Applying database migrations..."
echo "   Database: ${DB_HOST}:${DB_PORT}/${DB_NAME} (sslmode=disable)"
echo "   Migrations: ${MIGRATIONS_DIR}"

cd "$PROJECT_ROOT"

###############################################################################
# Function: Apply migrations using psql directly (fallback)
###############################################################################
apply_migrations_psql() {
    echo "   Using psql to apply migrations..."

    # Use public.schema_migrations (same as Supabase CLI)
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-'EOSQL'
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            version TEXT PRIMARY KEY
        );
EOSQL

    # Get list of already applied migrations from public.schema_migrations
    APPLIED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT version FROM public.schema_migrations ORDER BY version;" 2>/dev/null || echo "")

    MIGRATION_COUNT=0
    APPLIED_COUNT=0
    SKIPPED_COUNT=0

    # Apply each migration file in order
    for migration_file in "${MIGRATIONS_DIR}"/*.sql; do
        if [[ ! -f "$migration_file" ]]; then
            continue
        fi

        filename=$(basename "$migration_file")
        # Extract version (timestamp prefix) from filename
        version="${filename%%_*}"

        if [[ -z "$version" ]] || [[ "$version" == ".gitkeep" ]]; then
            continue
        fi

        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))

        # Check if already applied
        if echo "$APPLIED" | grep -q "^${version}$"; then
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            if [[ "$DEBUG" == "true" ]]; then
                echo "   ⏭️  Skipping (already applied): $filename"
            fi
            continue
        fi

        if [[ "$DRY_RUN" == "true" ]]; then
            echo "   Would apply: $filename"
            continue
        fi

        echo "   Applying: $filename"

        # Fail fast on any SQL error and only record success after apply succeeds.
        set +e
        migration_output=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration_file" 2>&1)
        migration_exit=$?
        set -e

        if [[ $migration_exit -ne 0 ]]; then
            echo "$migration_output" | tail -40
            echo -e "${RED}❌ Migration failed: $filename${NC}"
            return 1
        fi

        if [[ "$DEBUG" == "true" ]]; then
            echo "$migration_output" | grep -v "^NOTICE:" | tail -20 || true
        fi

        # Record migration as applied (same format as Supabase CLI)
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
            "INSERT INTO public.schema_migrations (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;"
        APPLIED_COUNT=$((APPLIED_COUNT + 1))
    done

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${GREEN}✅ Dry run complete. ${MIGRATION_COUNT} migrations found.${NC}"
    elif [[ $APPLIED_COUNT -gt 0 ]]; then
        echo -e "${GREEN}✅ Applied ${APPLIED_COUNT} migration(s), skipped ${SKIPPED_COUNT} already applied.${NC}"
    else
        echo -e "${GREEN}✅ All ${SKIPPED_COUNT} migrations already applied.${NC}"
    fi

    return 0
}

###############################################################################
# Function: Apply migrations using Supabase CLI
###############################################################################
apply_migrations_supabase() {
    supabase db push \
        --db-url "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable" \
        --workdir "${SUPABASE_WORKDIR}"
}

###############################################################################
# Main: Try Supabase CLI first, fall back to psql if it fails with TLS error
###############################################################################

if [[ "$PSQL_ONLY" == "true" ]]; then
    echo "   Mode: psql-only (Supabase CLI skipped)"
    apply_migrations_psql
    exit $?
fi

# Try Supabase CLI first
if command -v supabase &> /dev/null && [[ -f "${PROJECT_ROOT}/${SUPABASE_WORKDIR}/config.toml" ]]; then
    echo "   Trying Supabase CLI..."

    # Capture output to check for TLS error
    set +e
    OUTPUT=$(apply_migrations_supabase 2>&1)
    EXIT_CODE=$?
    set -e

    if [[ $EXIT_CODE -eq 0 ]]; then
        echo "$OUTPUT"
        exit 0
    fi

    # Check if it's a TLS error - if so, fall back to psql
    if echo "$OUTPUT" | grep -qi "tls error\|ssl\|certificate"; then
        echo -e "${YELLOW}⚠️  Supabase CLI failed with TLS error, falling back to psql...${NC}"
        apply_migrations_psql
        exit $?
    fi

    # Non-TLS errors should fail loudly.
    echo "$OUTPUT"
    echo -e "${RED}❌ Supabase CLI migration failed (non-TLS error).${NC}"
    exit 1
fi

# Fall back to psql
apply_migrations_psql
exit $?
