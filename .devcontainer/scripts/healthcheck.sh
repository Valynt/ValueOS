#!/bin/bash
###############################################################################
# Enhanced Dev Container Health Check
# Verifies container is healthy and ready for development
###############################################################################

set -e

# Exit codes
EXIT_SUCCESS=0
EXIT_FAILURE=1
EXIT_WARNING=2

# Configuration
VERBOSE=${VERBOSE:-false}
CHECK_SERVICES=${CHECK_SERVICES:-true}

# Colors (only if terminal supports it)
if [ -t 1 ]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    RED=''
    YELLOW=''
    GREEN=''
    NC=''
fi

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo "  $1"
    fi
}

###############################################################################
# Core System Checks
###############################################################################

check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        return $EXIT_FAILURE
    fi
    
    local version=$(node --version)
    log_verbose "Node.js: $version"
    return $EXIT_SUCCESS
}

check_npm() {
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        return $EXIT_FAILURE
    fi
    
    local version=$(npm --version)
    log_verbose "npm: $version"
    return $EXIT_SUCCESS
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_warn "Docker CLI not found"
        return $EXIT_WARNING
    fi
    
    if ! docker ps &> /dev/null 2>&1; then
        log_warn "Docker daemon not accessible"
        return $EXIT_WARNING
    fi
    
    log_verbose "Docker: accessible"
    return $EXIT_SUCCESS
}

check_workspace() {
    if [ ! -d "/workspace" ]; then
        log_error "Workspace directory not found"
        return $EXIT_FAILURE
    fi
    
    log_verbose "Workspace: /workspace"
    return $EXIT_SUCCESS
}

###############################################################################
# Resource Checks
###############################################################################

check_disk_space() {
    local usage=$(df /workspace 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ -z "$usage" ]; then
        log_warn "Could not check disk space"
        return $EXIT_WARNING
    fi
    
    if [ "$usage" -gt 90 ]; then
        log_error "Disk usage critical: ${usage}%"
        return $EXIT_FAILURE
    elif [ "$usage" -gt 80 ]; then
        log_warn "Disk usage high: ${usage}%"
        return $EXIT_WARNING
    fi
    
    log_verbose "Disk space: ${usage}% used"
    return $EXIT_SUCCESS
}

check_memory() {
    if ! command -v free &> /dev/null; then
        log_verbose "Memory check skipped (free not available)"
        return $EXIT_SUCCESS
    fi
    
    local mem_available=$(free 2>/dev/null | grep Mem | awk '{print int($7/$2 * 100)}')
    
    if [ -z "$mem_available" ]; then
        log_verbose "Memory check skipped"
        return $EXIT_SUCCESS
    fi
    
    if [ "$mem_available" -lt 10 ]; then
        log_error "Memory critical: ${mem_available}% available"
        return $EXIT_FAILURE
    elif [ "$mem_available" -lt 20 ]; then
        log_warn "Memory low: ${mem_available}% available"
        return $EXIT_WARNING
    fi
    
    log_verbose "Memory: ${mem_available}% available"
    return $EXIT_SUCCESS
}

###############################################################################
# Service Checks (Optional)
###############################################################################

check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-5}
    
    if ! command -v curl &> /dev/null; then
        log_verbose "Service check skipped (curl not available)"
        return $EXIT_SUCCESS
    fi
    
    if curl -sf --max-time "$timeout" "$url" > /dev/null 2>&1; then
        log_verbose "Service $name: healthy"
        return $EXIT_SUCCESS
    else
        log_verbose "Service $name: not responding"
        return $EXIT_WARNING
    fi
}

check_services() {
    if [ "$CHECK_SERVICES" != "true" ]; then
        return $EXIT_SUCCESS
    fi
    
    # Check common development services (non-critical)
    check_service "Frontend" "http://localhost:3000" 2 || true
    check_service "Backend" "http://localhost:8000/health" 2 || true
    
    return $EXIT_SUCCESS
}

###############################################################################
# Main Health Check
###############################################################################

main() {
    local exit_code=$EXIT_SUCCESS
    local warnings=0
    local errors=0
    
    # Core checks (critical)
    check_node || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    check_npm || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    check_workspace || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    
    # Docker check (warning only)
    check_docker || warnings=$((warnings + 1))
    
    # Resource checks
    check_disk_space || { 
        local result=$?
        if [ $result -eq $EXIT_FAILURE ]; then
            errors=$((errors + 1))
            exit_code=$EXIT_FAILURE
        else
            warnings=$((warnings + 1))
        fi
    }
    
    check_memory || {
        local result=$?
        if [ $result -eq $EXIT_FAILURE ]; then
            errors=$((errors + 1))
            exit_code=$EXIT_FAILURE
        else
            warnings=$((warnings + 1))
        fi
    }
    
    # Service checks (non-critical)
    check_services || true
    
    # Summary
    if [ $exit_code -eq $EXIT_SUCCESS ]; then
        if [ $warnings -gt 0 ]; then
            log_info "Container is healthy (${warnings} warnings)"
        else
            log_info "Container is healthy"
        fi
    else
        log_error "Container health check failed (${errors} errors, ${warnings} warnings)"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"
