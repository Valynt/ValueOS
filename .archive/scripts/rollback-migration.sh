#!/bin/bash
################################################################################
# Migration Rollback Utility
#
# Safely rollback database migrations with backup and restore
#
# Usage: 
#   ./rollback-migration.sh <migration_id>
#   ./rollback-migration.sh --list
#   ./rollback-migration.sh --backup
#   ./rollback-migration.sh --restore <backup_file>
#
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/migrations"

# Load environment
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
fi

export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-54323}"
export POSTGRES_DB="${POSTGRES_DB:-postgres}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "${BACKUP_DIR}"

list_migrations() {
    echo "Applied Migrations:"
    echo "-----------------------------------------------------------"
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
    SELECT 
        migration_id,
        applied_at,
        LEFT(checksum, 8) || '...' as checksum_short
    FROM schema_migrations 
    ORDER BY applied_at DESC;
    "
}

create_backup() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="${BACKUP_DIR}/backup_${timestamp}.sql"
    
    echo -e "${YELLOW}Creating backup...${NC}"
    
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -F p \
        -f "${backup_file}"
    
    if [[ -f "${backup_file}" ]]; then
        echo -e "${GREEN}✓ Backup created: ${backup_file}${NC}"
        echo "${backup_file}"
    else
        echo -e "${RED}✗ Backup failed${NC}"
        exit 1
    fi
}

restore_backup() {
    local backup_file=$1
    
    if [[ ! -f "${backup_file}" ]]; then
        echo -e "${RED}✗ Backup file not found: ${backup_file}${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠ WARNING: This will restore the database to the backup state${NC}"
    echo -e "${YELLOW}⚠ All data changes since the backup will be LOST${NC}"
    read -p "Are you sure? (yes/no): " confirm
    
    if [[ "${confirm}" != "yes" ]]; then
        echo "Rollback cancelled"
        exit 0
    fi
    
    echo -e "${YELLOW}Restoring backup...${NC}"
    
    # Drop and recreate database
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}';
    DROP DATABASE IF EXISTS ${POSTGRES_DB};
    CREATE DATABASE ${POSTGRES_DB};
    "
    
    # Restore from backup
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -f "${backup_file}"
    
    echo -e "${GREEN}✓ Backup restored${NC}"
}

rollback_migration() {
    local target_id=$1
    
    echo -e "${YELLOW}Rolling back to migration: ${target_id}${NC}"
    
    # Create automatic backup
    local backup_file=$(create_backup)
    
    echo ""
    echo -e "${YELLOW}⚠ MANUAL ROLLBACK REQUIRED${NC}"
    echo ""
    echo "Automatic rollback is not implemented to prevent data loss."
    echo "To rollback manually:"
    echo ""
    echo "1. Review migrations after ${target_id}"
    echo "2. Write reverse migration SQL"
    echo "3. Test in shadow database first"
    echo "4. Apply reverse migration"
    echo "5. Update schema_migrations table"
    echo ""
    echo "Backup created at: ${backup_file}"
    echo "You can restore with: $0 --restore ${backup_file}"
}

case "${1:-}" in
    --list)
        list_migrations
        ;;
    --backup)
        create_backup
        ;;
    --restore)
        if [[ -z "${2:-}" ]]; then
            echo "Usage: $0 --restore <backup_file>"
            exit 1
        fi
        restore_backup "$2"
        ;;
    --help)
        sed -n '/^# Usage:/,/^################################################################################/p' "$0" | sed 's/^# //g' | head -n -1
        ;;
    "")
        echo "Usage: $0 <migration_id> | --list | --backup | --restore <file> | --help"
        exit 1
        ;;
    *)
        rollback_migration "$1"
        ;;
esac
