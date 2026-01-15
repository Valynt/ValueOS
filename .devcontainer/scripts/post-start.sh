#!/bin/bash
###############################################################################
# Dev Container - Post Start Script
# Runs every time the container starts
#
# Design principles:
# - Fast execution (< 5 seconds)
# - Never fail (all checks are advisory)
# - Cross-platform compatible
# - Minimal output unless issues found
###############################################################################

# Don't use set -e here - this script should never fail container start
set +e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN='' BLUE='' YELLOW='' RED='' NC=''
fi

###############################################################################
# Logging Functions
###############################################################################

log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

###############################################################################
# Health Check Functions
###############################################################################

check_disk_space() {
    local workspace_path="${PROJECT_ROOT}"
    local disk_usage=0
    
    # Try to get disk usage (cross-platform)
    if command -v df &>/dev/null; then
        disk_usage=$(df "$workspace_path" 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo "0")
    fi
    
    # Validate we got a number
    if ! [[ "$disk_usage" =~ ^[0-9]+$ ]]; then
        disk_usage=0
    fi
    
    if [ "$disk_usage" -ge 95 ]; then
        log_error "Disk space critical: ${disk_usage}% used"
        echo "       Run: docker system prune -f"
        return 1
    elif [ "$disk_usage" -ge 85 ]; then
        log_warn "Disk space low: ${disk_usage}% used"
        return 0
    fi
    
    return 0
}

check_node_modules() {
    if [ ! -d "${PROJECT_ROOT}/node_modules" ]; then
        log_warn "node_modules missing - run 'npm install'"
        return 1
    fi
    return 0
}

check_env_file() {
    if [ ! -f "${PROJECT_ROOT}/.env" ] && [ ! -f "${PROJECT_ROOT}/.env.local" ]; then
        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            log_warn ".env missing - run 'cp .env.example .env'"
        fi
        return 1
    fi
    return 0
}

check_docker_socket() {
    if [ -S /var/run/docker.sock ]; then
        if docker ps &>/dev/null 2>&1; then
            return 0
        fi
    fi
    log_warn "Docker not accessible (some features may not work)"
    return 1
}

###############################################################################
# Main
###############################################################################

main() {
    cd "$PROJECT_ROOT"
    
    echo ""
    echo "========================================"
    echo "  ValueOS Dev Container - Ready"
    echo "========================================"
    echo ""
    
    local issues=0
    
    # Run quick health checks
    check_disk_space || issues=$((issues + 1))
    check_node_modules || issues=$((issues + 1))
    check_env_file || issues=$((issues + 1))
    check_docker_socket || true  # Don't count as issue
    
    # Summary
    if [ $issues -eq 0 ]; then
        log_success "All checks passed"
    else
        echo ""
        log_warn "$issues issue(s) found - see warnings above"
    fi
    
    echo ""
    echo "Quick Start:"
    echo "  npm run dx        - Start full environment"
    echo "  npm run dev       - Start frontend only"
    echo "  npm run dx:doctor - Run diagnostics"
    echo ""
    echo "========================================"
    echo ""
    
    # Always exit successfully - don't block container start
    exit 0
}

main "$@"
