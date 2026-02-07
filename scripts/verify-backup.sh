#!/bin/bash
# scripts/verify-backup.sh

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Verifying backup: $BACKUP_FILE"

# 1. Check if file is a valid gzip
echo "Checking GZIP integrity..."
zgrep -q "PostgreSQL database dump" "$BACKUP_FILE" || {
    echo "ERROR: File is not a valid PostgreSQL gzip dump"
    exit 1
}

# 2. Check for critical tables
echo "Checking for critical tables in dump..."
CRITICAL_TABLES="users organizations agents agent_sessions workflow_executions"
for table in $CRITICAL_TABLES; do
    if zgrep -q "CREATE TABLE public.$table" "$BACKUP_FILE"; then
        echo "  [OK] Table $table found"
    else
        echo "  [MISSING] Table $table NOT found in dump!"
        exit 1
    fi
done

# 3. Check for RLS enablement
echo "Checking for RLS enablement in dump..."
if zgrep -q "ALTER TABLE .* ENABLE ROW LEVEL SECURITY" "$BACKUP_FILE"; then
    echo "  [OK] RLS enablement found"
else
    echo "  [WARNING] No RLS enablement found in dump!"
fi

# 4. Preliminary size check
FILE_SIZE=$(stat -c%s "$BACKUP_FILE")
if [ "$FILE_SIZE" -lt 10240 ]; then # 10KB
    echo "ERROR: Backup file seems suspiciously small ($FILE_SIZE bytes)"
    exit 1
fi

echo ""
echo "Backup verification PASSED for $BACKUP_FILE"
echo "Note: This is a structural check. A full restore test is recommended for absolute certainty."
