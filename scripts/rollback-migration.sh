#!/bin/bash
# scripts/rollback-migration.sh

set -e

# Configuration
MIGRATION_ID=$1
DB_URL=${DATABASE_URL}

if [ -z "$MIGRATION_ID" ]; then
    echo "Usage: $0 <migration_id>"
    echo "Example: $0 20251213000000"
    exit 1
fi

echo "WARNING: This script will attempt to roll back migration $MIGRATION_ID"
echo "This is a DESTRUCTIVE operation. Ensure you have a recent backup."
read -p "Are you sure you want to proceed? (y/N) " confirm

if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Aborted."
    exit 0
fi

# 1. Identify the rollback script
# Note: migrations are forward-only by default. This script expects a companion
# ${MIGRATION_ID}_rollback.sql in the canonical migration directory.
ROLLBACK_FILE="infra/postgres/migrations/${MIGRATION_ID}_rollback.sql"

if [ -f "$ROLLBACK_FILE" ]; then
    echo "Found explicit rollback file: $ROLLBACK_FILE"
    echo "Applying rollback..."
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROLLBACK_FILE"
else
    echo "No explicit rollback file found."
    echo "Attempting to reset database to the state before $MIGRATION_ID..."
    # This requires reaching out to the user for confirmation as it might wipe data
    echo "Manual intervention required: provide a rollback SQL in infra/postgres/migrations/."
    exit 1
fi

echo "Rollback successful for $MIGRATION_ID"
