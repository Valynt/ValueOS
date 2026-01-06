#!/bin/bash
###############################################################################
# Restore from Backup
# 
# Restores:
# - PostgreSQL database
# - Docker volumes
# - Configuration files
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-${HOME}/.devcontainer-backups}"

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

confirm() {
    local prompt="$1"
    local response
    
    echo -e "${YELLOW}$prompt${NC}"
    read -p "Type 'yes' to continue: " response
    
    if [ "$response" != "yes" ]; then
        log_error "Operation cancelled by user"
        exit 1
    fi
}

###############################################################################
# List Available Backups
###############################################################################

list_backups() {
    log_section "Available Backups"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    local backups=($(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log_error "No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    echo "Found ${#backups[@]} backup(s):"
    echo ""
    
    local i=1
    for backup in "${backups[@]}"; do
        local timestamp=$(basename "$backup" | sed 's/backup_//')
        local size=$(du -sh "$backup" | cut -f1)
        local date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")
        
        echo "  $i) $date ($size)"
        echo "     Location: $backup"
        
        # Show contents if summary exists
        if [ -f "$backup/SUMMARY.md" ]; then
            echo "     Contents:"
            grep "^- " "$backup/SUMMARY.md" | head -5 | sed 's/^/       /'
        fi
        
        echo ""
        i=$((i + 1))
    done
}

###############################################################################
# Select Backup
###############################################################################

select_backup() {
    local backups=($(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r))
    
    echo "Select backup to restore:"
    read -p "Enter number (1-${#backups[@]}): " selection
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#backups[@]} ]; then
        log_error "Invalid selection"
        exit 1
    fi
    
    SELECTED_BACKUP="${backups[$((selection - 1))]}"
    log_info "Selected: $SELECTED_BACKUP"
}

###############################################################################
# Restore Database
###############################################################################

restore_database() {
    log_section "Restore Database"
    
    # Find database backup file
    local db_backup=$(find "$SELECTED_BACKUP" -name "database_*.sql*" | head -1)
    
    if [ -z "$db_backup" ]; then
        log_warn "No database backup found, skipping"
        return 0
    fi
    
    log_info "Found database backup: $(basename $db_backup)"
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        log_warn "DATABASE_URL not set, checking .env..."
        
        if [ -f "/workspace/.env" ]; then
            source /workspace/.env 2>/dev/null || true
        fi
        
        if [ -z "$DATABASE_URL" ]; then
            log_error "DATABASE_URL not set, cannot restore database"
            return 1
        fi
    fi
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        log_error "psql not found, cannot restore database"
        return 1
    fi
    
    confirm "⚠️  This will OVERWRITE the current database. Continue?"
    
    log_info "Restoring database..."
    
    # Decompress if needed
    local restore_file="$db_backup"
    if [[ "$db_backup" == *.gz ]]; then
        log_info "Decompressing backup..."
        restore_file="/tmp/database_restore_$$.sql"
        gunzip -c "$db_backup" > "$restore_file"
    fi
    
    # Restore database
    if psql "$DATABASE_URL" < "$restore_file" 2>/dev/null; then
        log_info "✓ Database restored successfully"
        
        # Cleanup temp file
        if [ "$restore_file" != "$db_backup" ]; then
            rm -f "$restore_file"
        fi
    else
        log_error "Database restore failed"
        
        # Cleanup temp file
        if [ "$restore_file" != "$db_backup" ]; then
            rm -f "$restore_file"
        fi
        
        return 1
    fi
}

###############################################################################
# Restore Docker Volume
###############################################################################

restore_volume() {
    local backup_file=$1
    local volume_name=$2
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found, cannot restore volume"
        return 1
    fi
    
    log_info "Restoring volume: $volume_name..."
    
    # Create volume if it doesn't exist
    docker volume create "$volume_name" &> /dev/null || true
    
    # Decompress if needed
    local restore_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Decompressing backup..."
        restore_file="/tmp/volume_restore_$$.tar"
        gunzip -c "$backup_file" > "$restore_file"
    fi
    
    # Restore volume using temporary container
    if docker run --rm \
        -v "$volume_name:/data" \
        -v "$(dirname $restore_file):/backup" \
        alpine sh -c "cd /data && tar xf /backup/$(basename $restore_file)" 2>/dev/null; then
        
        log_info "✓ Volume $volume_name restored"
        
        # Cleanup temp file
        if [ "$restore_file" != "$backup_file" ]; then
            rm -f "$restore_file"
        fi
    else
        log_error "Failed to restore volume: $volume_name"
        
        # Cleanup temp file
        if [ "$restore_file" != "$backup_file" ]; then
            rm -f "$restore_file"
        fi
        
        return 1
    fi
}

###############################################################################
# Restore All Volumes
###############################################################################

restore_volumes() {
    log_section "Restore Docker Volumes"
    
    # Find volume backups
    local volume_backups=($(find "$SELECTED_BACKUP" -name "valuecanvas-*.tar*"))
    
    if [ ${#volume_backups[@]} -eq 0 ]; then
        log_warn "No volume backups found, skipping"
        return 0
    fi
    
    log_info "Found ${#volume_backups[@]} volume backup(s)"
    
    confirm "⚠️  This will OVERWRITE existing volumes. Continue?"
    
    for backup_file in "${volume_backups[@]}"; do
        # Extract volume name from filename
        local filename=$(basename "$backup_file")
        local volume_name=$(echo "$filename" | sed 's/_[0-9]*\.tar.*//')
        
        restore_volume "$backup_file" "$volume_name" || log_warn "Failed to restore $volume_name"
    done
    
    log_info "✓ Volume restore complete"
}

###############################################################################
# Restore Configuration Files
###############################################################################

restore_config() {
    log_section "Restore Configuration Files"
    
    # Find config backup
    local config_backup=$(find "$SELECTED_BACKUP" -name "config_*.tar*" | head -1)
    
    if [ -z "$config_backup" ]; then
        log_warn "No configuration backup found, skipping"
        return 0
    fi
    
    log_info "Found configuration backup: $(basename $config_backup)"
    
    confirm "⚠️  This will OVERWRITE existing configuration files. Continue?"
    
    log_info "Restoring configuration files..."
    
    # Decompress if needed
    local restore_file="$config_backup"
    if [[ "$config_backup" == *.gz ]]; then
        log_info "Decompressing backup..."
        restore_file="/tmp/config_restore_$$.tar"
        gunzip -c "$config_backup" > "$restore_file"
    fi
    
    # Restore to workspace
    cd /workspace
    if tar xf "$restore_file" 2>/dev/null; then
        log_info "✓ Configuration files restored"
        
        # Cleanup temp file
        if [ "$restore_file" != "$config_backup" ]; then
            rm -f "$restore_file"
        fi
    else
        log_error "Configuration restore failed"
        
        # Cleanup temp file
        if [ "$restore_file" != "$config_backup" ]; then
            rm -f "$restore_file"
        fi
        
        return 1
    fi
}

###############################################################################
# Restore Specific Item
###############################################################################

restore_specific() {
    local item_type=$1
    
    case "$item_type" in
        database)
            restore_database
            ;;
        volumes)
            restore_volumes
            ;;
        config)
            restore_config
            ;;
        *)
            log_error "Unknown restore type: $item_type"
            log_info "Valid types: database, volumes, config"
            exit 1
            ;;
    esac
}

###############################################################################
# Restore All
###############################################################################

restore_all() {
    log_section "Restore All"
    
    confirm "⚠️  This will restore database, volumes, and configuration. Continue?"
    
    restore_database || log_warn "Database restore had issues"
    restore_volumes || log_warn "Volume restore had issues"
    restore_config || log_warn "Configuration restore had issues"
    
    log_info "✅ Restore complete"
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS] [COMMAND]

Restore from backup.

Commands:
  list              List available backups
  all               Restore everything (interactive)
  database          Restore database only
  volumes           Restore Docker volumes only
  config            Restore configuration files only

Options:
  --backup-dir DIR  Backup directory (default: ~/.devcontainer-backups)
  --help            Show this help message

Examples:
  # List available backups
  $0 list

  # Restore everything (interactive)
  $0 all

  # Restore only database
  $0 database

  # Restore from specific directory
  $0 --backup-dir /path/to/backups all

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
    # Parse arguments
    local command=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --help)
                show_usage
                exit 0
                ;;
            list|all|database|volumes|config)
                command="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Default command
    if [ -z "$command" ]; then
        command="list"
    fi
    
    echo "========================================="
    echo "  Restore from Backup"
    echo "========================================="
    echo ""
    
    # Execute command
    case "$command" in
        list)
            list_backups
            ;;
        all)
            list_backups
            select_backup
            restore_all
            ;;
        database|volumes|config)
            list_backups
            select_backup
            restore_specific "$command"
            ;;
    esac
}

# Run main function
main "$@"
