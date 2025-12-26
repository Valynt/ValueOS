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
# Note: In Supabase, migrations are one-way. This script expects a companion 
# .rollback.sql file or it will attempt to use 'supabase db reset --to'
ROLLBACK_FILE="supabase/migrations/${MIGRATION_ID}_rollback.sql"

if [ -f "$ROLLBACK_FILE" ]; then
    echo "Found explicit rollback file: $ROLLBACK_FILE"
    echo "Applying rollback..."
    npm exec -- supabase db execute --url "$DB_URL" --file "$ROLLBACK_FILE"
else
    echo "No explicit rollback file found."
    echo "Attempting to reset database to the state before $MIGRATION_ID..."
    # This requires reaching out to the user for confirmation as it might wipe data
    echo "Manual intervention required: Use 'supabase db reset' or provide a rollback SQL."
    exit 1
fi

echo "Rollback successful for $MIGRATION_ID"
