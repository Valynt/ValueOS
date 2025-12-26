#!/bin/bash

# ============================================================================
# Database Backup and Restore Script
# ============================================================================
# Handles database backups and restores for all environments
# Usage: 
#   bash scripts/backup-restore.sh backup [environment]
#   bash scripts/backup-restore.sh restore [backup-file]
# ============================================================================

set -e

COMMAND=${1:-backup}
ENVIRONMENT=${2:-staging}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# Backup Functions
# ============================================================================

backup_database() {
    local env=$1
    local backup_file="${BACKUP_DIR}/${env}_${TIMESTAMP}.sql"
    
    log_info "Starting database backup for $env environment..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    case $env in
        local)
            log_info "Backing up local Supabase database..."
            if docker ps | grep -q "supabase-db"; then
                docker exec supabase-db pg_dump -U postgres postgres > "$backup_file"
                log_success "Local database backed up to: $backup_file"
            else
                log_error "Supabase database container is not running"
                return 1
            fi
            ;;
            
        staging)
            log_info "Backing up staging database..."
            if [ -z "$STAGE_DATABASE_URL" ]; then
                log_error "STAGE_DATABASE_URL is not set"
                return 1
            fi
            pg_dump "$STAGE_DATABASE_URL" > "$backup_file"
            log_success "Staging database backed up to: $backup_file"
            ;;
            
        prod)
            log_info "Backing up production database..."
            if [ -z "$DATABASE_URL" ]; then
                log_error "DATABASE_URL is not set"
                return 1
            fi
            
            # Production backup with extra safety
            log_warning "Creating production backup - this may take a while..."
            pg_dump "$DATABASE_URL" > "$backup_file"
            
            # Verify backup
            if [ -s "$backup_file" ]; then
                local size=$(du -h "$backup_file" | cut -f1)
                log_success "Production database backed up to: $backup_file (Size: $size)"
                
                # Create compressed copy
                gzip -c "$backup_file" > "${backup_file}.gz"
                log_success "Compressed backup created: ${backup_file}.gz"
            else
                log_error "Backup file is empty or creation failed"
                return 1
            fi
            ;;
            
        *)
            log_error "Invalid environment: $env"
            return 1
            ;;
    esac
    
    # List recent backups
    echo ""
    log_info "Recent backups:"
    ls -lh "$BACKUP_DIR" | tail -5
    
    return 0
}

# ============================================================================
# Restore Functions
# ============================================================================

restore_database() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "No backup file specified"
        echo "Usage: $0 restore <backup-file>"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Detect if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Decompressing backup file..."
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi
    
    log_warning "⚠️  WARNING: This will restore the database from backup"
    log_warning "⚠️  All current data will be replaced!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        return 0
    fi
    
    log_info "Starting database restore from: $backup_file"
    
    # Detect environment from backup filename
    if [[ "$backup_file" == *"local"* ]]; then
        log_info "Restoring to local database..."
        if docker ps | grep -q "supabase-db"; then
            docker exec -i supabase-db psql -U postgres postgres < "$backup_file"
            log_success "Local database restored successfully"
        else
            log_error "Supabase database container is not running"
            return 1
        fi
        
    elif [[ "$backup_file" == *"staging"* ]]; then
        log_info "Restoring to staging database..."
        if [ -z "$STAGE_DATABASE_URL" ]; then
            log_error "STAGE_DATABASE_URL is not set"
            return 1
        fi
        psql "$STAGE_DATABASE_URL" < "$backup_file"
        log_success "Staging database restored successfully"
        
    elif [[ "$backup_file" == *"prod"* ]]; then
        log_error "Production restore requires additional confirmation"
        log_warning "Please contact DevOps team for production restores"
        return 1
    else
        log_error "Could not determine environment from backup filename"
        return 1
    fi
    
    return 0
}

# ============================================================================
# List Backups
# ============================================================================

list_backups() {
    log_info "Available backups:"
    echo ""
    
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        ls -lh "$BACKUP_DIR" | grep -E "\.sql|\.gz"
    else
        log_warning "No backups found in $BACKUP_DIR"
    fi
}

# ============================================================================
# Cleanup Old Backups
# ============================================================================

cleanup_old_backups() {
    local days=${1:-30}
    
    log_info "Cleaning up backups older than $days days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "*.sql" -mtime +$days -delete
        find "$BACKUP_DIR" -name "*.gz" -mtime +$days -delete
        log_success "Old backups cleaned up"
    else
        log_warning "Backup directory does not exist"
    fi
}

# ============================================================================
# Main
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Database Backup & Restore"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

case $COMMAND in
    backup)
        backup_database "$ENVIRONMENT"
        ;;
        
    restore)
        restore_database "$ENVIRONMENT"
        ;;
        
    list)
        list_backups
        ;;
        
    cleanup)
        cleanup_old_backups "${ENVIRONMENT:-30}"
        ;;
        
    *)
        log_error "Invalid command: $COMMAND"
        echo ""
        echo "Usage:"
        echo "  $0 backup [local|staging|prod]"
        echo "  $0 restore <backup-file>"
        echo "  $0 list"
        echo "  $0 cleanup [days]"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
