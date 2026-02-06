#!/bin/bash
###############################################################################
# ValueOS DevContainer Startup Script
#
# This is the single entry point for starting the development environment.
# It ensures all invariants are met before marking the environment as ready.
#
# Usage: bash scripts/dev/start-dev-env.sh [--seed] [--studio] [--skip-migrations]
#
# Exit Codes:
#   0 - Success
#   1 - Preflight failed
#   2 - Docker Compose failed
#   3 - Database not healthy
#   4 - Migrations failed
#   5 - Application not healthy
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DC_CMD="$PROJECT_ROOT/scripts/dc"
LOG_FILE="$PROJECT_ROOT/.dev-env-startup.log"

# Timeouts (in seconds)
DB_TIMEOUT=60
GATEWAY_TIMEOUT=90
HEALTH_CHECK_INTERVAL=2

# Parse arguments
SEED=false
ENABLE_STUDIO=false
SKIP_MIGRATIONS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --seed)
            SEED=true
            shift
            ;;
        --studio)
            ENABLE_STUDIO=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--seed] [--studio] [--skip-migrations] [--verbose]"
            echo ""
            echo "Options:"
            echo "  --seed             Run database seed after migrations"
            echo "  --studio           Enable Supabase Studio on port 54323"
            echo "  --skip-migrations  Skip database migrations"
            echo "  --verbose          Show detailed output"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    case $level in
        INFO)
            echo -e "${BLUE}▶${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}✓${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}✗${NC} $message"
            ;;
        STEP)
            echo -e "\n${CYAN}${BOLD}[$message]${NC}"
            ;;
    esac
}

# Error handler
cleanup_on_error() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log ERROR "Startup failed with exit code $exit_code"
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║              STARTUP FAILED - See details above                ║${NC}"
        echo -e "${RED}╠════════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${RED}║  Run diagnostics: bash scripts/dev/diagnostics.sh             ║${NC}"
        echo -e "${RED}║  View logs: cat $LOG_FILE                  ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    fi
}
trap cleanup_on_error EXIT

###############################################################################
# Step 1: Preflight Checks
###############################################################################
log STEP "1/6 Preflight Checks"

# Detect if we're inside a devcontainer (services managed externally)
INSIDE_DEVCONTAINER=false
if [[ -f "/.dockerenv" ]] || [[ -n "${CODESPACES:-}" ]] || [[ -n "${REMOTE_CONTAINERS:-}" ]] || [[ -n "${DEVCONTAINER:-}" ]]; then
    INSIDE_DEVCONTAINER=true
fi

# Check Docker availability and Mode
if [[ "$INSIDE_DEVCONTAINER" == "true" ]]; then
    log INFO "Running in Devcontainer Mode"
    log INFO "Skipping Docker orchestration (services managed by devcontainer)"
    DOCKER_AVAILABLE=false

    # Safety check for node_modules (masked by bind mount)
    if [[ ! -d "node_modules" ]] || [[ -z "$(ls -A node_modules)" ]]; then
         log WARN "node_modules missing or empty. Running pnpm install..."
         if command -v pnpm &> /dev/null; then
             pnpm install
             log SUCCESS "Dependencies installed"
         else
             log ERROR "pnpm not found. Cannot install dependencies."
             exit 1
         fi
    fi
elif command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    log SUCCESS "Docker available"
    DOCKER_AVAILABLE=true
else
    # Not in devcontainer and no Docker - this is an error
    log WARN "Not running inside devcontainer - running host preflight"
    if [[ -f "$SCRIPT_DIR/host-preflight.sh" ]]; then
        bash "$SCRIPT_DIR/host-preflight.sh" || exit 1
    fi
    log ERROR "Docker CLI not found"
    exit 1
fi

# Check required files
if [[ ! -x "$DC_CMD" ]]; then
    log ERROR "Compose entrypoint not found or not executable: $DC_CMD"
    exit 1
fi
log SUCCESS "Compose entrypoint found"

###############################################################################
# Step 2: Start Docker Compose Services
###############################################################################
log STEP "2/6 Starting Docker Services"

if [[ "$DOCKER_AVAILABLE" == "true" ]]; then
    COMPOSE_CMD="$DC_CMD"

    # Start services with wait
    log INFO "Starting services (this may take a minute on first run)..."
    if $VERBOSE; then
        $COMPOSE_CMD up -d --wait 2>&1 | tee -a "$LOG_FILE"
    else
        $COMPOSE_CMD up -d --wait >> "$LOG_FILE" 2>&1
    fi

    if [[ $? -ne 0 ]]; then
        log ERROR "Docker Compose failed to start services"
        $COMPOSE_CMD logs --tail=50 >> "$LOG_FILE" 2>&1
        exit 2
    fi
    log SUCCESS "Docker services started"
else
    log INFO "Docker not available - services should be started by devcontainer"
    log SUCCESS "Skipped (managed by host)"
fi

###############################################################################
# Step 3: Wait for Database Health
###############################################################################
log STEP "3/6 Waiting for Database"

wait_for_db() {
    local elapsed=0
    while [[ $elapsed -lt $DB_TIMEOUT ]]; do
        if [[ "$DOCKER_AVAILABLE" == "true" ]]; then
            # Use docker compose exec when Docker is available
            if $COMPOSE_CMD exec -T postgres pg_isready -U postgres -d valuecanvas_dev &> /dev/null; then
                return 0
            fi
        else
            # Use network connectivity check when inside devcontainer
            if pg_isready -h postgres -U postgres -d valuecanvas_dev &> /dev/null 2>&1; then
                return 0
            elif nc -z postgres 5432 &> /dev/null 2>&1; then
                # Fallback to netcat if pg_isready not available
                return 0
            elif curl -s --max-time 2 "http://backend:8000/health" &> /dev/null 2>&1; then
                # If backend responds, dependencies are up
                return 0
            fi
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        if $VERBOSE; then
            echo -ne "\r  Waiting for database... ${elapsed}s/${DB_TIMEOUT}s"
        fi
    done
    return 1
}

if wait_for_db; then
    log SUCCESS "Database is healthy"
else
    log ERROR "Database did not become healthy within ${DB_TIMEOUT}s"
    if [[ "$DOCKER_AVAILABLE" == "true" ]]; then
        $COMPOSE_CMD logs postgres --tail=50 >> "$LOG_FILE" 2>&1
    fi
    exit 3
fi

# Ensure shadow database exists
log INFO "Ensuring shadow database exists..."
if [[ "$DOCKER_AVAILABLE" == "true" ]]; then
    $COMPOSE_CMD exec -T postgres psql -U postgres -c "SELECT 'CREATE DATABASE postgres_shadow' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'postgres_shadow')\\gexec" >> "$LOG_FILE" 2>&1 || true
else
    # Use psql directly if available, otherwise skip
    if command -v psql &> /dev/null; then
        PGPASSWORD=postgres psql -h postgres -U postgres -c "SELECT 'CREATE DATABASE postgres_shadow' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'postgres_shadow')\\gexec" >> "$LOG_FILE" 2>&1 || true
    else
        log INFO "psql not available, shadow DB creation skipped (will be created on first migration)"
    fi
fi
log SUCCESS "Shadow database ready"

###############################################################################
# Step 4: Run Migrations
###############################################################################
log STEP "4/6 Database Migrations"

if [[ "$SKIP_MIGRATIONS" == "true" ]]; then
    log WARN "Skipping migrations (--skip-migrations flag)"
else
    cd "$PROJECT_ROOT"

    log INFO "Applying migrations..."
    export PGHOST="${DB_HOST:-postgres}"
    export DB_HOST="${DB_HOST:-postgres}"
    export DB_PASSWORD="${DB_PASSWORD:-dev_password}"
    export DB_NAME="${DB_NAME:-valuecanvas_dev}"

    if bash "$SCRIPT_DIR/migrate.sh" 2>&1 | tee -a "$LOG_FILE"; then
        log SUCCESS "Migrations applied successfully"
    else
        log ERROR "Migration failed - see log for details"
        exit 4
    fi
fi

###############################################################################
# Step 5: Optional Seed
###############################################################################
log STEP "5/6 Database Seed"

if [[ "$SEED" == "true" ]] || [[ "${DEV_SEED:-0}" == "1" ]]; then
    log INFO "Seeding database..."
    cd "$PROJECT_ROOT"
    if pnpm run seed:demo >> "$LOG_FILE" 2>&1; then
        log SUCCESS "Database seeded"
    else
        log WARN "Seed failed (may already be seeded)"
    fi
else
    log INFO "Skipping seed (use --seed flag to enable)"
fi

###############################################################################
# Step 6: Verify Gateway Health
###############################################################################
log STEP "6/6 Verifying Application"

wait_for_app() {
    local elapsed=0
    while [[ $elapsed -lt $GATEWAY_TIMEOUT ]]; do
        if [[ "$DOCKER_AVAILABLE" == "true" ]]; then
            if $COMPOSE_CMD exec -T backend wget -q --spider http://localhost:8000/health &> /dev/null; then
                return 0
            fi
        else
            # Inside devcontainer - check via network aliases
            if curl -fsS --max-time 2 http://backend:8000/health &> /dev/null 2>&1; then
                return 0
            elif curl -fsS --max-time 2 http://localhost:8000/health &> /dev/null 2>&1; then
                return 0
            fi
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        if $VERBOSE; then
            echo -ne "\r  Waiting for application... ${elapsed}s/${GATEWAY_TIMEOUT}s"
        fi
    done
    return 1
}

if wait_for_app; then
    log SUCCESS "Application is healthy"
else
    log WARN "Application health check timed out (services may still be starting)"
fi

###############################################################################
# Success!
###############################################################################
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ${BOLD}ValueOS Development Environment Ready${NC}${GREEN}               ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  ${NC}Frontend:        ${CYAN}http://localhost:5173${NC}${GREEN}                      ║${NC}"
echo -e "${GREEN}║  ${NC}Backend API:     ${CYAN}http://localhost:3001${NC}${GREEN}                      ║${NC}"
echo -e "${GREEN}║  ${NC}Supabase API:    ${CYAN}http://localhost:54321${NC}${GREEN}                     ║${NC}"
if [[ "$ENABLE_STUDIO" == "true" ]]; then
echo -e "${GREEN}║  ${NC}Supabase Studio: ${CYAN}http://localhost:54323${NC}${GREEN}                     ║${NC}"
fi
echo -e "${GREEN}║  ${NC}Database:        ${CYAN}localhost:54322${NC} (postgres/postgres)${GREEN}       ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  ${NC}Start dev server: ${YELLOW}pnpm dev${NC}${GREEN}                                 ║${NC}"
echo -e "${GREEN}║  ${NC}View logs:        ${YELLOW}./scripts/dc logs -f${NC}${GREEN}                        ║${NC}"
echo -e "${GREEN}║  ${NC}Diagnostics:      ${YELLOW}bash scripts/dev/diagnostics.sh${NC}${GREEN}         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

exit 0
