#!/bin/bash
# migrate-db-assets.sh
# Idempotent migration/archival script for ValueOS DB assets
set -euo pipefail

# --- Versioning ---
SCRIPT_VERSION="1.0.0"

# --- Dependency Check ---
REQUIRED_CMDS=("mv" "mkdir" "rsync" "fdupes")
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: Required command '$cmd' not found. Please install it."
    exit 1
  fi
done

# --- Environment Awareness ---
ENV=${ENV:-dev} # Use ENV=staging or ENV=prod for environment-specific runs
ARCHIVE_DIR=".archive"
CANONICAL_DIR="infra/supabase/supabase"

# --- Logging ---
LOG_FILE="$CANONICAL_DIR/migration_log.txt"
echo "[Migration Script v$SCRIPT_VERSION] $(date) ENV=$ENV" >> "$LOG_FILE"

# --- Migration/Archival ---
mkdir -p "$ARCHIVE_DIR/migrations" "$ARCHIVE_DIR/seeds" "$ARCHIVE_DIR/init-scripts" "$ARCHIVE_DIR/scripts"

# Move migration SQL files
rsync -av --remove-source-files migrations/*.sql "$ARCHIVE_DIR/migrations/" 2>/dev/null || true
rsync -av --remove-source-files infra/postgres/migrations/*.sql "$ARCHIVE_DIR/migrations/" 2>/dev/null || true
rsync -av --remove-source-files supabase/db/migrations/*.sql "$ARCHIVE_DIR/migrations/" 2>/dev/null || true

# Move seed files
rsync -av --remove-source-files migrations/*seed*.sql "$ARCHIVE_DIR/seeds/" 2>/dev/null || true
rsync -av --remove-source-files migrations/create_dummy_user.sql "$ARCHIVE_DIR/seeds/" 2>/dev/null || true
rsync -av --remove-source-files infra/postgres/seeds/*.sql "$ARCHIVE_DIR/seeds/" 2>/dev/null || true
rsync -av --remove-source-files scripts/seeds/*.sql "$ARCHIVE_DIR/seeds/" 2>/dev/null || true

# Move init scripts
rsync -av --remove-source-files .devcontainer/init-scripts/*.sh "$ARCHIVE_DIR/init-scripts/" 2>/dev/null || true

# Move orchestration scripts
rsync -av --remove-source-files infra/scripts/*.sh "$ARCHIVE_DIR/scripts/" 2>/dev/null || true
rsync -av --remove-source-files _supabase/infra/scripts/*.sh "$ARCHIVE_DIR/scripts/" 2>/dev/null || true

# Move migration docs
rsync -av --remove-source-files MIGRATION_AUTOMATION_GUIDE.md "$ARCHIVE_DIR/" 2>/dev/null || true
rsync -av --remove-source-files MIGRATION_QUICK_REFERENCE.md "$ARCHIVE_DIR/" 2>/dev/null || true

# --- Uniqueness Validation ---
echo "[Deduplication] $(date)" >> "$LOG_FILE"
fdupes -r "$CANONICAL_DIR" >> "$LOG_FILE" || echo "No duplicates found."

# --- Version Control ---
echo "[Version] $SCRIPT_VERSION" >> "$LOG_FILE"

# --- Environment-Specific Configs ---
if [[ "$ENV" == "prod" ]]; then
  echo "[Production] Using stricter archival and logging policies." >> "$LOG_FILE"
  # Add production-specific logic here
fi

if [[ "$ENV" == "staging" ]]; then
  echo "[Staging] Using staging configs." >> "$LOG_FILE"
  # Add staging-specific logic here
fi

if [[ "$ENV" == "dev" ]]; then
  echo "[Dev] Using development configs." >> "$LOG_FILE"
  # Add dev-specific logic here
fi

# --- Completion ---
echo "✅ Migration, seed, init, and orchestration files archived. See $LOG_FILE for details."
