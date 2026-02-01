#!/bin/bash
###############################################################################
# Idempotent Database Migration Script
#
# Applies Supabase migrations WITHOUT requiring docker.sock access.
# Uses explicit --db-url to avoid Supabase CLI trying to spin up containers.
#
# Usage: bash scripts/dev/migrate.sh [--dry-run] [--debug]
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
# Disable SSL for local development (container postgres doesn't have TLS)
DB_SSLMODE="${DB_SSLMODE:-disable}"

# Construct database URL
DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}}"

# Parse arguments
DRY_RUN=false
DEBUG=false

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
        *)
            shift
            ;;
    esac
done

# Validate environment
if [[ ! -f "${PROJECT_ROOT}/${SUPABASE_WORKDIR}/config.toml" ]]; then
    echo -e "${YELLOW}⚠️ Warning: ${SUPABASE_WORKDIR}/config.toml not found. Skipping migrations.${NC}"
    exit 0
fi

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found.${NC}"
    echo "   Install with: pnpm add -g supabase"
    exit 1
fi

echo "🔄 Applying database migrations..."
echo "   Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "   Workdir:  ${SUPABASE_WORKDIR}"

cd "$PROJECT_ROOT"

# Build command
CMD="supabase db push --db-url \"${DATABASE_URL}\" --workdir ${SUPABASE_WORKDIR}"

if [[ "$DRY_RUN" == "true" ]]; then
    CMD="$CMD --dry-run"
    echo "   Mode: Dry run (no changes will be applied)"
fi

if [[ "$DEBUG" == "true" ]]; then
    CMD="$CMD --debug"
fi

# Execute migrations
if eval "$CMD"; then
    echo -e "${GREEN}✅ Migrations applied successfully.${NC}"
    exit 0
else
    EXIT_CODE=$?
    # Check for common "already applied" scenarios
    if [[ $EXIT_CODE -eq 0 ]] || grep -qi "already applied\|up to date" <<< "$(eval "$CMD" 2>&1)" 2>/dev/null; then
        echo -e "${GREEN}✅ Migrations already up to date.${NC}"
        exit 0
    fi
    echo -e "${RED}❌ Migration failed with exit code $EXIT_CODE${NC}"
    exit $EXIT_CODE
fi
