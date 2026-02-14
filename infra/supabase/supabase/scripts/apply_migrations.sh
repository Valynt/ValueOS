#!/bin/bash
set -euo pipefail

# apply_migrations.sh
# Master migration script for ValueOS database schema
# Applies all versioned SQL migrations in sequential order with validation

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="${PROJECT_ROOT}/infra/supabase/supabase/migrations"

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-54323}"
DB_USER="${DB_USER:-valueos}"
DB_PASSWORD="${DB_PASSWORD:-valueos_dev}"
DB_NAME="${DB_NAME:-valueos_dev}"

# Retry configuration
DB_RETRY_COUNT=${DB_RETRY_COUNT:-5}
DB_RETRY_DELAY=${DB_RETRY_DELAY:-2}
MIGRATION_RETRY_COUNT=${MIGRATION_RETRY_COUNT:-3}
MIGRATION_RETRY_DELAY=${MIGRATION_RETRY_DELAY:-5}

# Flags
DRY_RUN=false
FORCE=false
VERBOSE=false

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

log_info() {
    echo "ℹ️  [INFO] $*"
}

log_success() {
    echo "✅ [SUCCESS] $*"
}

log_error() {
    echo "❌ [ERROR] $*" >&2
}

log_warning() {
    echo "⚠️  [WARNING] $*"
}

show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Apply database migrations for ValueOS

OPTIONS:
    --dry-run           Show what would be done without applying
    --force             Force apply even if risky
    --verbose           Enable verbose output
    --help, -h          Show this help message

ENVIRONMENT VARIABLES:
    DB_HOST             Database host (default: localhost)
    DB_PORT             Database port (default: 54323)
    DB_USER             Database user (default: valueos)
    DB_PASSWORD         Database password (default: valueos_dev)
    DB_NAME             Database name (default: valueos_dev)
    DB_RETRY_COUNT      Number of connection retries (default: 5)
    DB_RETRY_DELAY      Delay between retries in seconds (default: 2)

EXAMPLES:
    # Apply all pending migrations
    $0

    # Dry run to see what would be applied
    $0 --dry-run

    # Apply with custom database
    DB_NAME=valueos_prod $0

EOF
}

# Retry a command with exponential backoff
retry_command() {
    local retries=$1
    local delay=$2
    shift 2
    local command=("$@")
    local count=0

    until "${command[@]}"; do
        exit_code=$?
        count=$((count + 1))

        if [ $count -ge $retries ]; then
            log_error "Command failed after $retries attempts"
            return $exit_code
        fi

        log_warning "Attempt $count/$retries failed. Retrying in $delay seconds..."
        sleep $delay
        delay=$((delay * 2))  # Exponential backoff
    done
}

# Check if database is accessible
check_database_connection() {
    log_info "Checking database connection..."

    if retry_command "$DB_RETRY_COUNT" "$DB_RETRY_DELAY" \
        env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log_success "Database connection established"
        return 0
    else
        log_error "Failed to connect to database"
        return 1
    fi
}

# Get list of applied migrations
get_applied_migrations() {
    env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT name FROM public.schema_migrations ORDER BY name" 2>/dev/null | xargs || echo ""
}

# Calculate checksum of migration file
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | awk '{print $1}'
}

# Apply a single migration
apply_migration() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file")
    local checksum
    checksum=$(calculate_checksum "$migration_file")

    log_info "Applying migration: $migration_name"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would apply: $migration_name"
        return 0
    fi

    local start_time
    start_time=$(date +%s%3N)

    # Record migration start
    env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-EOSQL
        INSERT INTO public.migration_history (migration_name, action, status, started_at)
        VALUES ('$migration_name', 'apply', 'pending', NOW());
EOSQL

    # Apply migration in transaction
    if env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-EOSQL
        BEGIN;
        \i $migration_file
        INSERT INTO public.schema_migrations (name, checksum, applied_at)
        VALUES ('$migration_name', '$checksum', NOW());
        COMMIT;
EOSQL
    then
        local end_time
        end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))

        # Update migration history
        env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-EOSQL
            UPDATE public.migration_history
            SET status = 'success', completed_at = NOW(), metadata = jsonb_build_object('execution_time_ms', $execution_time)
            WHERE migration_name = '$migration_name' AND status = 'pending';

            UPDATE public.schema_migrations
            SET execution_time_ms = $execution_time
            WHERE name = '$migration_name';
EOSQL

        log_success "Migration applied: $migration_name (${execution_time}ms)"
        return 0
    else
        local error_code=$?

        # Record failure
        env PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-EOSQL
            UPDATE public.migration_history
            SET status = 'failure', completed_at = NOW(), error_message = 'Migration failed with exit code $error_code'
            WHERE migration_name = '$migration_name' AND status = 'pending';
EOSQL

        log_error "Migration failed: $migration_name"
        return $error_code
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                set -x
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    log_info "Starting migration process..."
    log_info "Database: $DB_NAME@$DB_HOST:$DB_PORT"

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE: No changes will be applied"
    fi

    # Check database connection
    if ! check_database_connection; then
        log_error "Cannot proceed without database connection"
        exit 1
    fi

    # Check migrations directory
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi

    # Get applied migrations
    local applied_migrations
    applied_migrations=$(get_applied_migrations)

    log_info "Applied migrations: $(echo "$applied_migrations" | wc -w)"

    # Find pending migrations
    local pending_count=0
    local failed_count=0

    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ ! -f "$migration_file" ]; then
            continue
        fi

        local migration_name
        migration_name=$(basename "$migration_file")

        # Check if already applied
        if echo "$applied_migrations" | grep -q "$migration_name"; then
            if [ "$VERBOSE" = true ]; then
                log_info "Skipping already applied: $migration_name"
            fi
            continue
        fi

        # Apply migration
        pending_count=$((pending_count + 1))

        if retry_command "$MIGRATION_RETRY_COUNT" "$MIGRATION_RETRY_DELAY" apply_migration "$migration_file"; then
            log_success "Successfully applied: $migration_name"
        else
            failed_count=$((failed_count + 1))
            log_error "Failed to apply: $migration_name"

            if [ "$FORCE" != true ]; then
                log_error "Stopping migration process due to failure"
                exit 1
            fi
        fi
    done

    # Summary
    echo ""
    log_info "Migration Summary:"
    log_info "  Pending migrations: $pending_count"
    log_info "  Failed migrations: $failed_count"

    if [ $failed_count -gt 0 ]; then
        log_error "Some migrations failed"
        exit 1
    fi

    if [ $pending_count -eq 0 ]; then
        log_success "No pending migrations - database is up to date"
    else
        log_success "All migrations applied successfully"
    fi
}

# Run main function
main "$@"
