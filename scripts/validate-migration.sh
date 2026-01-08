#!/bin/bash

###############################################################################
# Database Migration Safety Validator
#
# Validates database migrations before execution to prevent:
# - Breaking changes
# - Data loss
# - Downtime
#
# Usage: ./validate-migration.sh <migration_file>
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MIGRATION_FILE="${1:-}"
ERRORS=0
WARNINGS=0

if [[ -z "$MIGRATION_FILE" ]]; then
  echo "Usage: $0 <migration_file>"
  exit 1
fi

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
  ((ERRORS++))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  ((WARNINGS++))
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

check_breaking_changes() {
  log_info "Checking for breaking changes..."
  
  # Check for DROP COLUMN without expansion phase
  if grep -qi "DROP COLUMN" "$MIGRATION_FILE"; then
    if ! grep -qi "-- PHASE: CONTRACT" "$MIGRATION_FILE"; then
      log_error "DROP COLUMN detected without CONTRACT phase marker. Use expand-migrate-contract pattern!"
      log_info "  Add: -- PHASE: CONTRACT"
    fi
  fi
  
  # Check for ALTER COLUMN type changes
  if grep -qi "ALTER COLUMN.*TYPE" "$MIGRATION_FILE"; then
    log_warn "Column type change detected. Ensure backward compatibility or use expand-migrate-contract!"
  fi
  
  # Check for NOT NULL without default
  if grep -qi "ALTER.*SET NOT NULL" "$MIGRATION_FILE"; then
    if ! grep -qi "DEFAULT" "$MIGRATION_FILE"; then
      log_error "Setting NOT NULL without DEFAULT value. This will fail on existing rows!"
    fi
  fi
  
  # Check for RENAME without expansion
  if  grep -qi "RENAME COLUMN\|ALTER TABLE.*RENAME TO" "$MIGRATION_FILE"; then
    if ! grep -qi "-- PHASE: EXPAND\|-- PHASE: MIGRATE\|-- PHASE: CONTRACT" "$MIGRATION_FILE"; then
      log_warn "RENAME detected without expand-migrate-contract pattern. Consider gradual migration!"
    fi
  fi
}

check_data_loss_risks() {
  log_info "Checking for data loss risks..."
  
  # Check for DROP TABLE
  if grep -qi "DROP TABLE" "$MIGRATION_FILE"; then
    log_error "DROP TABLE detected! Ensure data is backed up and migration is intentional!"
  fi
  
  # Check for TRUNCATE
  if grep -qi "TRUNCATE" "$MIGRATION_FILE"; then
    log_error "TRUNCATE detected! This will delete all data!"
  fi
  
  # Check for DELETE without WHERE
  if grep -qi "DELETE FROM.*;" "$MIGRATION_FILE" && ! grep -qi "WHERE" "$MIGRATION_FILE"; then
    log_error "DELETE without WHERE clause detected! This will delete all rows!"
  fi
}

check_performance_issues() {
  log_info "Checking for performance issues..."
  
  # Check for missing indexes on foreign keys
  if grep -qi "ADD CONSTRAINT.*FOREIGN KEY" "$MIGRATION_FILE"; then
    if ! grep -qi "CREATE INDEX" "$MIGRATION_FILE"; then
      log_warn "Foreign key added without index. Consider adding index for performance!"
    fi
  fi
  
  # Check for ALTER TABLE on large tables without CONCURRENTLY
  if grep -qi "DROP INDEX\|CREATE INDEX" "$MIGRATION_FILE"; then
    if ! grep -qi "CONCURRENTLY" "$MIGRATION_FILE"; then
      log_warn "INDEX operation without CONCURRENTLY. This may lock the table!"
      log_info "  Consider: CREATE INDEX CONCURRENTLY"
    fi
  fi
  
  # Check for table locks
  if grep -qi "LOCK TABLE" "$MIGRATION_FILE"; then
    log_warn "Explicit table lock detected. Ensure this is necessary!"
  fi
}

check_rollback_plan() {
  log_info "Checking for rollback plan..."
  
  local migration_name
  migration_name=$(basename "$MIGRATION_FILE")
  local rollback_file="${MIGRATION_FILE%.sql}_rollback.sql"
  
  if [[ ! -f "$rollback_file" ]]; then
    log_warn "No rollback file found: $rollback_file"
    log_info "  Create rollback script to reverse this migration"
  else
    log_info "✓ Rollback file exists: $rollback_file"
  fi
}

check_transaction_safety() {
  log_info "Checking transaction safety..."
  
  # Check for BEGIN/COMMIT
  local has_begin
  local has_commit
  has_begin=$(grep -ci "BEGIN\|START TRANSACTION" "$MIGRATION_FILE" || true)
  has_commit=$(grep -ci "COMMIT" "$MIGRATION_FILE" || true)
  
  if [[ $has_begin -eq 0 ]] || [[ $has_commit -eq 0 ]]; then
    log_warn "Migration should be wrapped in a transaction (BEGIN...COMMIT)"
  else
    log_info "✓ Transaction markers found"
  fi
  
  # Check for operations that can't be in transactions
  if grep -qi "CREATE DATABASE\|DROP DATABASE\|VACUUM\|CREATE INDEX CONCURRENTLY" "$MIGRATION_FILE"; then
    if [[ $has_begin -gt 0 ]]; then
      log_error "Migration contains operations that cannot run in a transaction!"
    fi
  fi
}

check_naming_conventions() {
  log_info "Checking naming conventions..."
  
  # Check for lowercase names
  if grep -qP "[A-Z]" "$MIGRATION_FILE" | grep -qi "CREATE TABLE\|ALTER TABLE"; then
    log_warn "Mixed case detected in table/column names. Use lowercase with underscores!"
  fi
  
  # Check for reserved words
  local reserved_words="user|order|group|end|table"
  if grep -qiE "CREATE TABLE ($reserved_words)|ADD COLUMN ($reserved_words)" "$MIGRATION_FILE"; then
    log_warn "Potential use of reserved SQL words detected!"
  fi
}

check_rls_policies() {
  log_info "Checking Row Level Security..."
  
  # If creating a table, check for RLS policies
  if grep -qi "CREATE TABLE" "$MIGRATION_FILE"; then
    if ! grep -qi "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" "$MIGRATION_FILE"; then
      log_warn "New table created without RLS enabled. Ensure this is intentional!"
    fi
    
    if ! grep -qi "CREATE POLICY" "$MIGRATION_FILE"; then
      log_warn "New table created without RLS policies!"
    fi
  fi
}

check_constraints() {
  log_info "Checking constraints..."
  
  # Check that foreign keys have ON DELETE/UPDATE rules
  if grep -qi "FOREIGN KEY" "$MIGRATION_FILE"; then
    if ! grep -qi "ON DELETE\|ON UPDATE" "$MIGRATION_FILE"; then
      log_warn "Foreign key without ON DELETE/UPDATE behavior specified"
    fi
  fi
  
  # Check for check constraints
  if grep -qi "CHECK\s*(" "$MIGRATION_FILE"; then
    log_info "✓ Check constraints found (good for data validation)"
  fi
}

generate_summary() {
  echo ""
  echo "===================================="
  echo "Migration Validation Summary"
  echo "===================================="
  echo "File: $MIGRATION_FILE"
  echo "Errors: $ERRORS"
  echo "Warnings: $WARNINGS"
  echo "===================================="
  
  if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}❌ Migration validation FAILED${NC}"
    echo "Fix errors before proceeding with migration!"
    return 1
  elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  Migration validation passed with warnings${NC}"
    echo "Review warnings carefully before proceeding!"
    return 0
  else
    echo -e "${GREEN}✅ Migration validation PASSED${NC}"
    echo "Migration appears safe to execute!"
    return 0
  fi
}

# Main execution
main() {
  echo "Validating migration: $MIGRATION_FILE"
  echo ""
  
  check_breaking_changes
  check_data_loss_risks
  check_performance_issues
  check_rollback_plan
  check_transaction_safety
  check_naming_conventions
  check_rls_policies
  check_constraints
  
  generate_summary
}

main
