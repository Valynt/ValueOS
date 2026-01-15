#!/bin/bash
###############################################################################
# Dev Container - Update Content Script
# Runs when container content is updated (e.g., after git pull)
#
# Design principles:
# - Incremental updates only (check timestamps)
# - Reproducible dependency installation
# - Fast when nothing changed
###############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/update-content.log"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    GREEN='' BLUE='' YELLOW='' NC=''
fi

###############################################################################
# Logging Functions
###############################################################################

log_info() {
    echo -e "${BLUE}▶${NC} $1"
    echo "[$(date -Iseconds)] INFO: $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    echo "[$(date -Iseconds)] SUCCESS: $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    echo "[$(date -Iseconds)] WARN: $1" >> "$LOG_FILE" 2>/dev/null || true
}

###############################################################################
# Update Functions
###############################################################################

# Check if file A is newer than file/directory B
is_newer() {
    local source=$1
    local target=$2
    
    [ ! -e "$target" ] && return 0
    [ "$source" -nt "$target" ] && return 0
    return 1
}

update_dependencies() {
    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Check if lockfile changed (most reliable indicator)
    local needs_update=false
    
    if [ ! -d "node_modules" ]; then
        needs_update=true
        log_info "node_modules missing, installing..."
    elif [ -f "package-lock.json" ] && is_newer "package-lock.json" "node_modules"; then
        needs_update=true
        log_info "package-lock.json changed, updating..."
    elif is_newer "package.json" "node_modules"; then
        needs_update=true
        log_info "package.json changed, updating..."
    fi
    
    if [ "$needs_update" = true ]; then
        # Use npm ci for reproducible installs when lockfile exists
        if [ -f "package-lock.json" ]; then
            if npm ci --prefer-offline --no-audit --no-fund 2>/dev/null; then
                log_success "Dependencies updated (npm ci)"
            else
                log_warn "npm ci failed, trying npm install..."
                npm install --prefer-offline --no-audit --no-fund
                log_success "Dependencies updated (npm install)"
            fi
        else
            npm install --prefer-offline --no-audit --no-fund
            log_success "Dependencies installed"
        fi
        
        # Touch node_modules to update timestamp
        touch node_modules
    else
        log_success "Dependencies up to date"
    fi
}

update_prisma_client() {
    local schema_paths=(
        "${PROJECT_ROOT}/scripts/prisma/schema.prisma"
        "${PROJECT_ROOT}/prisma/schema.prisma"
    )
    
    for schema_path in "${schema_paths[@]}"; do
        if [ -f "$schema_path" ]; then
            local prisma_dir="${PROJECT_ROOT}/node_modules/.prisma"
            
            if is_newer "$schema_path" "$prisma_dir"; then
                log_info "Prisma schema changed, regenerating client..."
                if npx prisma generate --schema="$schema_path" 2>/dev/null; then
                    log_success "Prisma client regenerated"
                else
                    log_warn "Prisma generation failed (non-critical)"
                fi
            fi
            return 0
        fi
    done
}

update_playwright() {
    # Only install Playwright browsers if config exists and browsers missing
    if [ -f "${PROJECT_ROOT}/playwright.config.ts" ] || [ -f "${PROJECT_ROOT}/.config/configs/playwright.config.ts" ]; then
        local playwright_cache="${HOME}/.cache/ms-playwright"
        
        if [ ! -d "$playwright_cache" ]; then
            log_info "Installing Playwright browsers..."
            if npx playwright install chromium --with-deps 2>/dev/null; then
                log_success "Playwright browsers installed"
            else
                log_warn "Playwright installation failed (non-critical)"
            fi
        fi
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    echo ""
    echo "========================================"
    echo "  Updating Container Content"
    echo "========================================"
    echo ""
    
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "=== update-content.sh started at $(date -Iseconds) ===" >> "$LOG_FILE" 2>/dev/null || true
    
    update_dependencies
    update_prisma_client
    update_playwright
    
    echo ""
    log_success "Content update complete"
    echo ""
}

main "$@"
