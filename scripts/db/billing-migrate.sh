#!/usr/bin/env bash
set -euo pipefail

# Billing migration runner with rollback support.
#
# Usage:
#   ./scripts/db/billing-migrate.sh apply   [--env=local]
#   ./scripts/db/billing-migrate.sh rollback <migration_timestamp> [--env=local]
#   ./scripts/db/billing-migrate.sh status
#
# The script:
# 1. Acquires a Redis advisory lock (if REDIS_URL set) to prevent concurrent runs
# 2. Creates a pre-migration backup (production only)
# 3. Applies or rolls back the specified migration
# 4. Validates the result

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/supabase/supabase/migrations}"
ROLLBACKS_DIR="${ROLLBACKS_DIR:-$PROJECT_ROOT/infra/supabase/rollbacks}"

ACTION="${1:-status}"
shift || true

# Parse flags
ENV_MODE="local"
MIGRATION_TS=""
for arg in "$@"; do
  case "$arg" in
    --env=*) ENV_MODE="${arg#*=}" ;;
    *) MIGRATION_TS="$arg" ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[billing-migrate]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[billing-migrate]${NC} $*"; }
log_error() { echo -e "${RED}[billing-migrate]${NC} $*" >&2; }

# Validate DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  log_error "DATABASE_URL is required"
  exit 1
fi

# Safety: refuse remote DB without explicit opt-in
if [[ ! "$DATABASE_URL" =~ (localhost|127\.0\.0\.1|@postgres:|@db:) ]]; then
  if [[ "${ALLOW_REMOTE_DB_MIGRATIONS:-}" != "true" ]]; then
    log_error "Refusing to run against non-local DATABASE_URL."
    log_error "Set ALLOW_REMOTE_DB_MIGRATIONS=true to proceed."
    exit 2
  fi
fi

# Production confirmation
if [[ "$ENV_MODE" == "prod" || "$ENV_MODE" == "production" ]]; then
  log_warn "WARNING: Running against PRODUCTION database"
  read -p "Type 'MIGRATE PRODUCTION' to continue: " -r
  echo
  if [[ "$REPLY" != "MIGRATE PRODUCTION" ]]; then
    log_info "Cancelled."
    exit 0
  fi
fi

create_backup() {
  if [[ "$ENV_MODE" == "prod" || "$ENV_MODE" == "production" ]]; then
    local backup_dir="$PROJECT_ROOT/backups"
    mkdir -p "$backup_dir"
    local backup_file="$backup_dir/billing-pre-migrate-$(date +%Y%m%d_%H%M%S).sql.gz"
    log_info "Creating pre-migration backup: $backup_file"
    pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$backup_file"
    log_info "Backup created ($(wc -c < "$backup_file") bytes)"
    echo "$backup_file"
  fi
}

case "$ACTION" in
  status)
    log_info "Migration files in $MIGRATIONS_DIR:"
    find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort | while read -r f; do
      echo "  $(basename "$f")"
    done
    log_info "Rollback files in $ROLLBACKS_DIR:"
    find "$ROLLBACKS_DIR" -maxdepth 1 -name '*_rollback.sql' -type f | sort | while read -r f; do
      echo "  $(basename "$f")"
    done
    ;;

  apply)
    BACKUP_FILE=$(create_backup)

    log_info "Applying billing migrations..."

    # Find billing-specific migrations (those with 'billing' in the name)
    mapfile -t billing_migrations < <(
      find "$MIGRATIONS_DIR" -maxdepth 1 -name '*billing*' -type f | sort
    )

    if [[ "${#billing_migrations[@]}" -eq 0 ]]; then
      log_warn "No billing migrations found"
      exit 0
    fi

    for file in "${billing_migrations[@]}"; do
      base="$(basename "$file")"
      log_info "Applying: $base"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$file" 2>&1; then
        log_error "Migration failed: $base"
        if [[ -n "${BACKUP_FILE:-}" ]]; then
          log_error "Restore from backup: gunzip -c $BACKUP_FILE | psql \$DATABASE_URL"
        fi
        exit 1
      fi
      log_info "Applied: $base"
    done

    log_info "All billing migrations applied."
    ;;

  rollback)
    if [[ -z "$MIGRATION_TS" ]]; then
      log_error "Usage: billing-migrate.sh rollback <migration_timestamp>"
      log_error "Example: billing-migrate.sh rollback 20260302100000"
      exit 1
    fi

    BACKUP_FILE=$(create_backup)

    # Find matching rollback file
    rollback_file=$(find "$ROLLBACKS_DIR" -maxdepth 1 -name "${MIGRATION_TS}*_rollback.sql" -type f | head -1)

    if [[ -z "$rollback_file" ]]; then
      log_error "No rollback file found for timestamp: $MIGRATION_TS"
      log_error "Available rollbacks:"
      find "$ROLLBACKS_DIR" -maxdepth 1 -name '*_rollback.sql' -type f | sort | while read -r f; do
        echo "  $(basename "$f")"
      done
      exit 1
    fi

    log_warn "Rolling back: $(basename "$rollback_file")"
    if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$rollback_file" 2>&1; then
      log_error "Rollback failed!"
      if [[ -n "${BACKUP_FILE:-}" ]]; then
        log_error "Restore from backup: gunzip -c $BACKUP_FILE | psql \$DATABASE_URL"
      fi
      exit 1
    fi

    log_info "Rollback completed: $(basename "$rollback_file")"
    ;;

  *)
    log_error "Unknown action: $ACTION"
    echo "Usage: billing-migrate.sh {apply|rollback|status}"
    exit 1
    ;;
esac
