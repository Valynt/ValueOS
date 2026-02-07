#!/bin/bash
###############################################################################
# ValueOS DevContainer Post-Create Hook (Enhanced with Failsafes)
#
# Features:
# - Setup completion marker (.setup-complete)
# - Retry logic with timeout for critical operations
# - Graceful degradation for optional steps
# - Rollback trap for cleanup on failure
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETUP_MARKER="${PROJECT_ROOT}/.setup-complete"
ROLLBACK_STATE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function for rollback
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "${RED}❌ Setup failed with exit code $exit_code${NC}"
        echo "🔄 Rolling back changes..."

        # Rollback based on recorded state
        case "$ROLLBACK_STATE" in
            "env_copied")
                echo "   Removing copied env files..."
                rm -f "${PROJECT_ROOT}/ops/env/.env.local"
                rm -f "${PROJECT_ROOT}/ops/env/.env.ports"
                ;;
            "migrations_applied")
                echo "   Warning: Migrations were applied. Manual rollback may be needed."
                ;;
            "seeded")
                echo "   Warning: Database seeded. Manual cleanup may be needed."
                ;;
        esac

        # Remove marker if setup didn't complete
        rm -f "$SETUP_MARKER"

        echo -e "${RED}Setup aborted. Check logs above for details.${NC}"
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Logging functions
log_info() {
    echo -e "${GREEN}ℹ️${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Retry function with timeout
retry_with_timeout() {
    local cmd="$1"
    local max_attempts="${2:-3}"
    local timeout="${3:-30}"
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts: $cmd"

        if timeout "$timeout" bash -c "$cmd"; then
            return 0
        else
            log_warn "Attempt $attempt failed"
            if [ $attempt -eq $max_attempts ]; then
                return 1
            fi
            sleep $((attempt * 2))  # Exponential backoff
        fi
        ((attempt++))
    done
}

echo "🚀 Starting ValueOS Post-Create Setup (Enhanced)..."
echo ""

###############################################################################
# Step 0: Check Setup Completion Marker
###############################################################################
if [ -f "$SETUP_MARKER" ]; then
    log_info "Setup already completed. Skipping..."
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         🎉 Development environment ready!                      ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║                                                                ║"
    echo "║  Start dev server:  pnpm dev                                   ║"
    echo "║                                                                ║"
    echo "║  Endpoints:                                                    ║"
    echo "║    App:    http://localhost:5173                               ║"
    echo "║    API:    http://localhost:54321                              ║"
    echo "║    Studio: http://localhost:54323                              ║"
    echo "║                                                                ║"
    echo "║  Diagnostics: bash scripts/dev/diagnostics.sh                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
fi

###############################################################################
# Step 1: Install Dependencies (Idempotent) - MOVED TO DOCKERFILE
###############################################################################
log_info "Dependencies installed in Dockerfile. Skipping pnpm install."

###############################################################################
# Step 2: Ensure local env port file exists
###############################################################################
if [ ! -f "${PROJECT_ROOT}/ops/env/.env.ports" ] && [ -f "${PROJECT_ROOT}/ops/env/.env.ports.example" ]; then
    log_info "Creating ops/env/.env.ports from ops/env/.env.ports.example..."
    cp "${PROJECT_ROOT}/ops/env/.env.ports.example" "${PROJECT_ROOT}/ops/env/.env.ports"
    ROLLBACK_STATE="env_copied"
fi

###############################################################################
# Step 3: Ensure ops/env/.env.local exists
###############################################################################
if [ ! -f "${PROJECT_ROOT}/ops/env/.env.local" ]; then
    if [ -f "${PROJECT_ROOT}/.devcontainer/.env.dev" ]; then
        log_info "Copying .env.dev to ops/env/.env.local..."
        cp "${PROJECT_ROOT}/.devcontainer/.env.dev" "${PROJECT_ROOT}/ops/env/.env.local"
        ROLLBACK_STATE="env_copied"
    elif [ -f "${PROJECT_ROOT}/ops/env/.env.example" ]; then
        log_info "Copying ops/env/.env.example to ops/env/.env.local..."
        cp "${PROJECT_ROOT}/ops/env/.env.example" "${PROJECT_ROOT}/ops/env/.env.local"
        ROLLBACK_STATE="env_copied"
    fi
fi

# Load environment variables
if [ -f "${PROJECT_ROOT}/ops/env/.env.local" ]; then
    log_info "Loading ops/env/.env.local..."
    set -a
    source "${PROJECT_ROOT}/ops/env/.env.local"
    set +a

    # Convert host-based DATABASE_URL to container network URL for migrations
    if [ -n "$DATABASE_URL" ]; then
        ORIGINAL_URL="$DATABASE_URL"
        DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/localhost:54322/db:5432/')
        log_info "Context-aware DATABASE_URL: $DATABASE_URL"
    fi
fi

###############################################################################
# Step 4: Configure Database Connection
###############################################################################
# Trust the orchestrator: app depends on db (service_healthy), so DB is ready.

# Set DB_HOST for migration scripts
export DB_HOST="${DB_HOST:-db}"
log_info "Using DB_HOST: $DB_HOST"

###############################################################################
# Step 5: Apply Migrations (with retry logic)
###############################################################################
log_info "Applying database migrations (with retry logic)..."

# Ensure migration scripts target the same DB host inside devcontainer.
export PGHOST="${DB_HOST:-db}"
export DB_HOST="${DB_HOST:-db}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export DB_NAME="${DB_NAME:-postgres}"

log_info "Using DB_HOST: $DB_HOST"
log_info "Using DB_NAME: $DB_NAME"

MIGRATION_CMD="bash \"${SCRIPT_DIR}/migrate.sh\""
if ! retry_with_timeout "$MIGRATION_CMD" 3 60; then
    log_error "Migration failed after retries. Development environment is NOT ready."
    exit 1
fi
log_info "Migrations applied successfully."
ROLLBACK_STATE="migrations_applied"

###############################################################################
# Step 6: Optional Seed (graceful degradation)
###############################################################################
if [ "${DEV_SEED:-0}" = "1" ]; then
    log_info "Seeding database..."
    cd "$PROJECT_ROOT"
    if pnpm run seed:demo; then
        log_info "Database seeded successfully."
        ROLLBACK_STATE="seeded"
    else
        log_warn "Seed failed, but continuing (graceful degradation)"
    fi
else
    log_info "Skipping database seeding (DEV_SEED not set)"
fi

###############################################################################
# Step 7: Optional UI Seed (graceful degradation)
###############################################################################
if [ "${UI_SEED:-0}" = "1" ]; then
    log_info "Seeding UI fixtures..."
    if bash "${SCRIPT_DIR}/seed-ui.sh"; then
        log_info "UI fixtures seeded successfully."
    else
        log_warn "UI seed failed, but continuing (graceful degradation)"
    fi
else
    log_info "Skipping UI seeding (UI_SEED not set)"
fi

###############################################################################
# Step 8: Mark Setup Complete
###############################################################################
touch "$SETUP_MARKER"
log_info "Setup completion marker created: $SETUP_MARKER"

###############################################################################
# Done!
###############################################################################
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🎉 Development environment ready!                      ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  Start dev server:  pnpm dev                                   ║"
echo "║                                                                ║"
echo "║  Endpoints:                                                    ║"
echo "║    App:    http://localhost:5173                               ║"
echo "║    API:    http://localhost:54321                              ║"
echo "║    Studio: http://localhost:54323                              ║"
echo "║                                                                ║"
echo "║  Diagnostics: bash scripts/dev/diagnostics.sh                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
