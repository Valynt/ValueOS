#!/bin/bash
################################################################################
# Supabase Complete Migration Automation Script
#
# This script automates the entire Supabase migration process:
# 1. Environment validation
# 2. Database initialization (roles, shadow DB, migration tracking)
# 3. Sequential migration application with validation
# 4. Authentication setup
# 5. Post-migration validation
# 6. Seed data (optional)
#
# Usage:
#   ./supabase-migrate-all.sh [options]
#
# Options:
#   --env <file>        Environment file (default: .env)
#   --skip-init         Skip initialization scripts
#   --skip-auth         Skip authentication setup
#   --with-seeds        Apply seed data after migrations
#   --dry-run           Show what would be executed without running
#   --force             Force execution even if migrations already applied
#   --rollback <id>     Rollback to specific migration ID
#   --validate-only     Only validate without applying
#   --verbose           Enable verbose logging
#   --help              Show this help message
#
# Environment Variables Required:
#   POSTGRES_HOST       PostgreSQL host (default: localhost)
#   POSTGRES_PORT       PostgreSQL port (default: 54323)
#   POSTGRES_DB         Database name (default: postgres)
#   POSTGRES_USER       Database user (default: postgres)
#   POSTGRES_PASSWORD   Database password
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Environment validation failed
#   3 - Initialization failed
#   4 - Migration failed
#   5 - Authentication setup failed
#   6 - Validation failed
#
################################################################################

set -euo pipefail

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MIGRATIONS_DIR="${PROJECT_ROOT}/infra/supabase/supabase/migrations"
INIT_SCRIPTS_DIR="${PROJECT_ROOT}/.devcontainer/init-scripts"
AUTH_SCRIPT="${PROJECT_ROOT}/infra/supabase/init-auth.sql"
SEEDS_DIR="${PROJECT_ROOT}/scripts/seeds"
LOG_DIR="${PROJECT_ROOT}/logs/migrations"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/migration_${TIMESTAMP}.log"

# Default options
ENV_FILE="${PROJECT_ROOT}/.env"
SKIP_INIT=false
SKIP_AUTH=false
WITH_SEEDS=false
DRY_RUN=false
FORCE=false
ROLLBACK_ID=""
VALIDATE_ONLY=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

################################################################################
# Utility Functions
################################################################################

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $*" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}✗${NC} $*" | tee -a "${LOG_FILE}"
}

log_step() {
    echo -e "\n${CYAN}▶${NC} $*" | tee -a "${LOG_FILE}"
}

show_help() {
    sed -n '/^# Usage:/,/^################################################################################/p' "$0" | sed 's/^# //g' | head -n -1
    exit 0
}

################################################################################
# Environment Validation
################################################################################

validate_environment() {
    log_step "Validating environment..."

    # Create log directory
    mkdir -p "${LOG_DIR}"

    # Load environment file
    if [[ -f "${ENV_FILE}" ]]; then
        log_info "Loading environment from ${ENV_FILE}"
        set -a
        source "${ENV_FILE}"
        set +a
    else
        log_warning "Environment file not found: ${ENV_FILE}"
    fi

    # Set defaults
    export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
    export POSTGRES_PORT="${POSTGRES_PORT:-54323}"
    export POSTGRES_DB="${POSTGRES_DB:-postgres}"
    export POSTGRES_USER="${POSTGRES_USER:-postgres}"

    # Validate required variables
    if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
        log_error "POSTGRES_PASSWORD is required"
        return 2
    fi

    # Check PostgreSQL connection
    log_info "Testing PostgreSQL connection..."
    if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}"
        log_error "Please ensure PostgreSQL is running and credentials are correct"
        return 2
    fi

    log_success "Environment validated"

    # Display configuration
    if [[ "${VERBOSE}" == "true" ]]; then
        log_info "Configuration:"
        log_info "  Host: ${POSTGRES_HOST}"
        log_info "  Port: ${POSTGRES_PORT}"
        log_info "  Database: ${POSTGRES_DB}"
        log_info "  User: ${POSTGRES_USER}"
        log_info "  Migrations: ${MIGRATIONS_DIR}"
        log_info "  Log: ${LOG_FILE}"
    fi

    return 0
}

################################################################################
# Database Initialization
################################################################################

run_initialization() {
    if [[ "${SKIP_INIT}" == "true" ]]; then
        log_info "Skipping initialization (--skip-init)"
        return 0
    fi

    log_step "Running initialization scripts..."

    local init_scripts=(
        "00-create-supabase-roles.sh"
        "01-create-shadow-db.sh"
        "02-create-migrations-table.sh"
    )

    for script in "${init_scripts[@]}"; do
        local script_path="${INIT_SCRIPTS_DIR}/${script}"

        if [[ ! -f "${script_path}" ]]; then
            log_error "Initialization script not found: ${script_path}"
            return 3
        fi

        log_info "Executing: ${script}"

        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "[DRY RUN] Would execute: ${script_path}"
            continue
        fi

        # Make script executable
        chmod +x "${script_path}"

        # Execute script
        if bash "${script_path}" >> "${LOG_FILE}" 2>&1; then
            log_success "Completed: ${script}"
        else
            log_error "Failed: ${script}"
            return 3
        fi
    done

    log_success "Initialization completed"
    return 0
}

################################################################################
# Migration Application
################################################################################

get_applied_migrations() {
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT migration_id FROM schema_migrations ORDER BY applied_at;" 2>/dev/null | grep -v '^$' | tr -d ' ' || true
}

get_migration_checksum() {
    local file=$1
    sha256sum "${file}" | awk '{print $1}'
}

apply_migration() {
    local migration_file=$1
    local migration_id=$(basename "${migration_file}" .sql)

    log_info "Applying migration: ${migration_id}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would apply: ${migration_file}"
        return 0
    fi

    # Calculate checksum
    local checksum=$(get_migration_checksum "${migration_file}")

    # Begin transaction
    local sql_script="
    BEGIN;

    -- Apply migration
    $(cat "${migration_file}")

    -- Record migration
    INSERT INTO schema_migrations (migration_id, checksum, applied_at)
    VALUES ('${migration_id}', '${checksum}', NOW())
    ON CONFLICT (migration_id) DO NOTHING;

    COMMIT;
    "

    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 <<< "${sql_script}" >> "${LOG_FILE}" 2>&1; then
        log_success "Applied: ${migration_id}"
        return 0
    else
        log_error "Failed to apply: ${migration_id}"
        log_error "Check log file for details: ${LOG_FILE}"
        return 4
    fi
}

run_migrations() {
    log_step "Applying database migrations..."

    # Get list of applied migrations
    local applied_migrations=$(get_applied_migrations)

    # Get all migration files sorted by name (timestamp)
    local migration_files=($(find "${MIGRATIONS_DIR}" -name "*.sql" -type f | sort))

    if [[ ${#migration_files[@]} -eq 0 ]]; then
        log_warning "No migration files found in ${MIGRATIONS_DIR}"
        return 0
    fi

    log_info "Found ${#migration_files[@]} migration files"

    local applied_count=0
    local skipped_count=0

    for migration_file in "${migration_files[@]}"; do
        local migration_id=$(basename "${migration_file}" .sql)

        # Check if already applied
        if echo "${applied_migrations}" | grep -q "^${migration_id}$"; then
            if [[ "${FORCE}" == "true" ]]; then
                log_warning "Re-applying migration (--force): ${migration_id}"
            else
                log_info "Skipping (already applied): ${migration_id}"
                ((skipped_count++))
                continue
            fi
        fi

        # Apply migration
        if ! apply_migration "${migration_file}"; then
            log_error "Migration failed: ${migration_id}"
            return 4
        fi

        ((applied_count++))
    done

    log_success "Migrations completed: ${applied_count} applied, ${skipped_count} skipped"
    return 0
}

################################################################################
# Authentication Setup
################################################################################

setup_authentication() {
    if [[ "${SKIP_AUTH}" == "true" ]]; then
        log_info "Skipping authentication setup (--skip-auth)"
        return 0
    fi

    log_step "Setting up Supabase authentication..."

    if [[ ! -f "${AUTH_SCRIPT}" ]]; then
        log_error "Authentication script not found: ${AUTH_SCRIPT}"
        return 5
    fi

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would execute: ${AUTH_SCRIPT}"
        return 0
    fi

    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${AUTH_SCRIPT}" >> "${LOG_FILE}" 2>&1; then
        log_success "Authentication setup completed"
        return 0
    else
        log_error "Authentication setup failed"
        return 5
    fi
}

################################################################################
# Seed Data
################################################################################

apply_seeds() {
    if [[ "${WITH_SEEDS}" != "true" ]]; then
        return 0
    fi

    log_step "Applying seed data..."

    local seed_file="${SEEDS_DIR}/create_dummy_user.sql"

    if [[ ! -f "${seed_file}" ]]; then
        log_warning "Seed file not found: ${seed_file}"
        return 0
    fi

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would apply seeds: ${seed_file}"
        return 0
    fi

    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${seed_file}" >> "${LOG_FILE}" 2>&1; then
        log_success "Seed data applied"
        return 0
    else
        log_warning "Seed data application failed (non-critical)"
        return 0
    fi
}

################################################################################
# Validation
################################################################################

validate_migrations() {
    log_step "Validating migrations..."

    # Check schema_migrations table
    local migration_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d ' ' || echo "0")

    log_info "Applied migrations: ${migration_count}"

    # Check RLS policies
    local rls_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    log_info "RLS policies: ${rls_count}"

    # Check critical tables
    local tables=("users" "tenants" "opportunities" "value_cases")
    local missing_tables=()

    for table in "${tables[@]}"; do
        if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1 FROM ${table} LIMIT 1;" > /dev/null 2>&1; then
            missing_tables+=("${table}")
        fi
    done

    if [[ ${#missing_tables[@]} -gt 0 ]]; then
        log_warning "Missing tables: ${missing_tables[*]}"
    fi

    # Display recent migrations
    if [[ "${VERBOSE}" == "true" ]]; then
        log_info "Recent migrations:"
        PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT migration_id, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;" 2>/dev/null || true
    fi

    log_success "Validation completed"
    return 0
}

################################################################################
# Rollback
################################################################################

rollback_to_migration() {
    local target_id=$1

    log_step "Rolling back to migration: ${target_id}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would rollback to: ${target_id}"
        return 0
    fi

    log_warning "Rollback functionality requires manual intervention"
    log_warning "Please restore database from backup taken before ${target_id}"

    return 0
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENV_FILE="$2"
                shift 2
                ;;
            --skip-init)
                SKIP_INIT=true
                shift
                ;;
            --skip-auth)
                SKIP_AUTH=true
                shift
                ;;
            --with-seeds)
                WITH_SEEDS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --rollback)
                ROLLBACK_ID="$2"
                shift 2
                ;;
            --validate-only)
                VALIDATE_ONLY=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                ;;
        esac
    done

    # Print header
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║    Supabase Complete Migration Automation Script          ║"
    echo "║    ValueOS Development Environment                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Starting migration process at $(date)"
    log_info "Log file: ${LOG_FILE}"

    # Validate environment
    if ! validate_environment; then
        log_error "Environment validation failed"
        exit 2
    fi

    # Handle rollback
    if [[ -n "${ROLLBACK_ID}" ]]; then
        rollback_to_migration "${ROLLBACK_ID}"
        exit $?
    fi

    # Handle validate-only
    if [[ "${VALIDATE_ONLY}" == "true" ]]; then
        validate_migrations
        exit $?
    fi

    # Execute migration pipeline
    local start_time=$(date +%s)

    # Step 1: Initialization
    if ! run_initialization; then
        log_error "Initialization failed"
        exit 3
    fi

    # Step 2: Apply migrations
    if ! run_migrations; then
        log_error "Migration application failed"
        exit 4
    fi

    # Step 3: Setup authentication
    if ! setup_authentication; then
        log_error "Authentication setup failed"
        exit 5
    fi

    # Step 4: Apply seeds (optional)
    apply_seeds

    # Step 5: Validate
    if ! validate_migrations; then
        log_error "Validation failed"
        exit 6
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Success summary
    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              Migration Completed Successfully              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_success "Total execution time: ${duration} seconds"
    log_success "Log file: ${LOG_FILE}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "This was a DRY RUN - no changes were made"
    fi

    return 0
}

# Execute main function
main "$@"
