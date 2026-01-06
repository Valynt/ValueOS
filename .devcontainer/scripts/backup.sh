#!/bin/bash
###############################################################################
# Automated Backup Script for Dev Container
# 
# Backs up:
# - PostgreSQL database
# - Docker volumes
# - Configuration files
# - Git repository state
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-7}
COMPRESS=${COMPRESS:-true}

# Backup types
BACKUP_DATABASE=${BACKUP_DATABASE:-true}
BACKUP_VOLUMES=${BACKUP_VOLUMES:-true}
BACKUP_CONFIG=${BACKUP_CONFIG:-true}
BACKUP_GIT=${BACKUP_GIT:-true}

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

###############################################################################
# Setup
###############################################################################

setup() {
    log_info "Setting up backup environment..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create session directory
    SESSION_DIR="$BACKUP_DIR/backup_$TIMESTAMP"
    mkdir -p "$SESSION_DIR"
    
    # Create metadata file
    cat > "$SESSION_DIR/metadata.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "user": "$(whoami)",
  "backup_dir": "$SESSION_DIR",
  "retention_days": $RETENTION_DAYS
}
EOF
    
    log_info "✓ Backup directory: $SESSION_DIR"
}

###############################################################################
# Database Backup
###############################################################################

backup_database() {
    if [ "$BACKUP_DATABASE" != "true" ]; then
        log_info "Database backup skipped (disabled)"
        return 0
    fi
    
    log_section "Database Backup"
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        log_warn "DATABASE_URL not set, checking for local PostgreSQL..."
        
        # Try to find PostgreSQL connection info
        if [ -f "/workspace/.env" ]; then
            source /workspace/.env 2>/dev/null || true
        fi
        
        if [ -z "$DATABASE_URL" ]; then
            log_warn "No database connection found, skipping database backup"
            return 0
        fi
    fi
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_warn "pg_dump not found, skipping database backup"
        return 0
    fi
    
    log_info "Backing up PostgreSQL database..."
    
    local backup_file="$SESSION_DIR/database_$TIMESTAMP.sql"
    
    # Perform backup
    if pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null; then
        # Compress if enabled
        if [ "$COMPRESS" = "true" ]; then
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
            log_info "✓ Database backup: $(basename $backup_file) ($(du -h $backup_file | cut -f1))"
        else
            log_info "✓ Database backup: $(basename $backup_file) ($(du -h $backup_file | cut -f1))"
        fi
        
        # Add to metadata
        echo "  \"database_backup\": \"$(basename $backup_file)\"," >> "$SESSION_DIR/metadata.json"
    else
        log_error "Database backup failed"
        return 1
    fi
}

###############################################################################
# Docker Volumes Backup
###############################################################################

backup_volumes() {
    if [ "$BACKUP_VOLUMES" != "true" ]; then
        log_info "Volume backup skipped (disabled)"
        return 0
    fi
    
    log_section "Docker Volumes Backup"
    
    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found, skipping volume backup"
        return 0
    fi
    
    # List of volumes to backup
    local volumes=(
        "valuecanvas-node-modules"
        "valuecanvas-npm-cache"
        "valuecanvas-build-cache"
        "valuecanvas-playwright"
    )
    
    local backed_up=0
    
    for volume in "${volumes[@]}"; do
        # Check if volume exists
        if ! docker volume inspect "$volume" &> /dev/null; then
            log_warn "Volume $volume not found, skipping"
            continue
        fi
        
        log_info "Backing up volume: $volume..."
        
        local backup_file="$SESSION_DIR/${volume}_$TIMESTAMP.tar"
        
        # Backup volume using temporary container
        if docker run --rm \
            -v "$volume:/data:ro" \
            -v "$SESSION_DIR:/backup" \
            alpine tar cf "/backup/$(basename $backup_file)" -C /data . 2>/dev/null; then
            
            # Compress if enabled
            if [ "$COMPRESS" = "true" ]; then
                gzip "$backup_file"
                backup_file="${backup_file}.gz"
            fi
            
            log_info "✓ Volume backup: $(basename $backup_file) ($(du -h $backup_file | cut -f1))"
            backed_up=$((backed_up + 1))
        else
            log_error "Failed to backup volume: $volume"
        fi
    done
    
    log_info "✓ Backed up $backed_up volumes"
}

###############################################################################
# Configuration Files Backup
###############################################################################

backup_config() {
    if [ "$BACKUP_CONFIG" != "true" ]; then
        log_info "Configuration backup skipped (disabled)"
        return 0
    fi
    
    log_section "Configuration Files Backup"
    
    log_info "Backing up configuration files..."
    
    # List of config files to backup
    local config_files=(
        ".env"
        ".devcontainer/devcontainer.json"
        ".devcontainer/docker-compose.secrets.yml"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
        "vite.config.ts"
        "tailwind.config.js"
        "prisma/schema.prisma"
    )
    
    local backup_file="$SESSION_DIR/config_$TIMESTAMP.tar"
    local files_to_backup=()
    
    # Check which files exist
    for file in "${config_files[@]}"; do
        if [ -f "/workspace/$file" ]; then
            files_to_backup+=("$file")
        fi
    done
    
    if [ ${#files_to_backup[@]} -eq 0 ]; then
        log_warn "No configuration files found to backup"
        return 0
    fi
    
    # Create backup
    cd /workspace
    if tar cf "$backup_file" "${files_to_backup[@]}" 2>/dev/null; then
        # Compress if enabled
        if [ "$COMPRESS" = "true" ]; then
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
        fi
        
        log_info "✓ Config backup: $(basename $backup_file) ($(du -h $backup_file | cut -f1))"
        log_info "  Files backed up: ${#files_to_backup[@]}"
    else
        log_error "Configuration backup failed"
        return 1
    fi
}

###############################################################################
# Git Repository State Backup
###############################################################################

backup_git() {
    if [ "$BACKUP_GIT" != "true" ]; then
        log_info "Git backup skipped (disabled)"
        return 0
    fi
    
    log_section "Git Repository State Backup"
    
    # Check if we're in a git repository
    if ! git -C /workspace rev-parse --git-dir &> /dev/null; then
        log_warn "Not a git repository, skipping git backup"
        return 0
    fi
    
    log_info "Backing up git repository state..."
    
    cd /workspace
    
    # Create git state file
    local state_file="$SESSION_DIR/git_state_$TIMESTAMP.txt"
    
    {
        echo "Git Repository State"
        echo "===================="
        echo ""
        echo "Date: $(date -Iseconds)"
        echo ""
        echo "Current Branch:"
        git branch --show-current
        echo ""
        echo "Last 5 Commits:"
        git log --oneline -5
        echo ""
        echo "Status:"
        git status --short
        echo ""
        echo "Remotes:"
        git remote -v
        echo ""
        echo "Stashes:"
        git stash list
    } > "$state_file"
    
    log_info "✓ Git state: $(basename $state_file)"
    
    # Create git bundle (full backup)
    local bundle_file="$SESSION_DIR/git_bundle_$TIMESTAMP.bundle"
    
    if git bundle create "$bundle_file" --all 2>/dev/null; then
        log_info "✓ Git bundle: $(basename $bundle_file) ($(du -h $bundle_file | cut -f1))"
    else
        log_warn "Git bundle creation failed"
    fi
}

###############################################################################
# Cleanup Old Backups
###############################################################################

cleanup_old_backups() {
    log_section "Cleanup Old Backups"
    
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted=0
    
    # Find and delete old backup directories
    while IFS= read -r -d '' dir; do
        rm -rf "$dir"
        deleted=$((deleted + 1))
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [ $deleted -gt 0 ]; then
        log_info "✓ Deleted $deleted old backup(s)"
    else
        log_info "✓ No old backups to delete"
    fi
}

###############################################################################
# Generate Summary
###############################################################################

generate_summary() {
    log_section "Backup Summary"
    
    local summary_file="$SESSION_DIR/SUMMARY.md"
    
    cat > "$summary_file" <<EOF
# Backup Summary

**Date:** $(date -Iseconds)  
**Location:** $SESSION_DIR  
**Retention:** $RETENTION_DAYS days

## Backup Contents

EOF
    
    # List all backup files
    echo "### Files" >> "$summary_file"
    echo "" >> "$summary_file"
    
    for file in "$SESSION_DIR"/*; do
        if [ -f "$file" ] && [ "$(basename $file)" != "SUMMARY.md" ] && [ "$(basename $file)" != "metadata.json" ]; then
            local size=$(du -h "$file" | cut -f1)
            echo "- $(basename $file) ($size)" >> "$summary_file"
        fi
    done
    
    echo "" >> "$summary_file"
    echo "## Restore Instructions" >> "$summary_file"
    echo "" >> "$summary_file"
    echo "See: \`.devcontainer/scripts/restore.sh\`" >> "$summary_file"
    echo "" >> "$summary_file"
    echo "---" >> "$summary_file"
    echo "" >> "$summary_file"
    echo "**Backup ID:** $TIMESTAMP" >> "$summary_file"
    
    # Display summary
    cat "$summary_file"
    
    log_info "✓ Summary: $summary_file"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo "========================================="
    echo "  Automated Backup"
    echo "========================================="
    echo ""
    
    local start_time=$(date +%s)
    
    # Setup
    setup
    
    # Run backups
    backup_database || log_warn "Database backup had issues"
    backup_volumes || log_warn "Volume backup had issues"
    backup_config || log_warn "Configuration backup had issues"
    backup_git || log_warn "Git backup had issues"
    
    # Cleanup
    cleanup_old_backups
    
    # Generate summary
    generate_summary
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    log_info "✅ Backup completed in ${duration}s"
    log_info "Backup location: $SESSION_DIR"
    
    # Calculate total size
    local total_size=$(du -sh "$SESSION_DIR" | cut -f1)
    log_info "Total size: $total_size"
}

# Run main function
main "$@"
