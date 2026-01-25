#!/bin/bash
###############################################################################
# Dev Container Health Check
# Verifies container is healthy and ready for development
#
# Exit codes:
#   0 - Healthy
#   1 - Critical failure (container unusable)
#   2 - Warnings present (container usable but degraded)
#
# Usage:
#   ./healthcheck.sh              # Standard check
#   ./healthcheck.sh --verbose    # Detailed output
#   ./healthcheck.sh --json       # JSON output for automation
###############################################################################

set -uo pipefail

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_WARNING=2

# Configuration
VERBOSE=${VERBOSE:-false}
JSON_OUTPUT=${JSON_OUTPUT:-false}
CHECK_SERVICES=${CHECK_SERVICES:-false}

# Parse arguments
for arg in "$@"; do
    case $arg in
        --verbose|-v) VERBOSE=true ;;
        --json|-j) JSON_OUTPUT=true ;;
        --services|-s) CHECK_SERVICES=true ;;
    esac
done

# Determine workspace path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKSPACE_PATH="${PROJECT_ROOT}"

# Colors (disabled for non-terminal or JSON output)
if [ -t 1 ] && [ "$JSON_OUTPUT" = "false" ]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' YELLOW='' GREEN='' BLUE='' NC=''
fi

# Results collection for JSON output
declare -a CHECK_RESULTS=()

###############################################################################
# Logging Functions
###############################################################################

log_check() {
    local name=$1
    local status=$2
    local message=$3
    
    CHECK_RESULTS+=("{\"name\":\"$name\",\"status\":\"$status\",\"message\":\"$message\"}")
    
    if [ "$JSON_OUTPUT" = "true" ]; then
        return
    fi
    
    case $status in
        pass) echo -e "${GREEN}✓${NC} $name: $message" ;;
        warn) echo -e "${YELLOW}⚠${NC} $name: $message" ;;
        fail) echo -e "${RED}✗${NC} $name: $message" ;;
    esac
}

log_verbose() {
    if [ "$VERBOSE" = "true" ] && [ "$JSON_OUTPUT" = "false" ]; then
        echo -e "  ${BLUE}→${NC} $1"
    fi
}

###############################################################################
# Check Functions
###############################################################################

check_node() {
    if ! command -v node &>/dev/null; then
        log_check "node" "fail" "Node.js not found"
        return $EXIT_FAILURE
    fi
    
    local version
    version=$(node --version 2>/dev/null || echo "unknown")
    log_check "node" "pass" "$version"
    log_verbose "Path: $(which node)"
    return $EXIT_SUCCESS
}

check_npm() {
    if ! command -v npm &>/dev/null; then
        log_check "npm" "fail" "npm not found"
        return $EXIT_FAILURE
    fi
    
    local version
    version=$(npm --version 2>/dev/null || echo "unknown")
    log_check "npm" "pass" "v$version"
    return $EXIT_SUCCESS
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        log_check "docker" "warn" "Docker CLI not installed"
        return $EXIT_WARNING
    fi
    
    if ! docker ps &>/dev/null 2>&1; then
        log_check "docker" "warn" "Docker daemon not accessible"
        return $EXIT_WARNING
    fi
    
    log_check "docker" "pass" "available"
    return $EXIT_SUCCESS
}

check_workspace() {
    if [ ! -d "$WORKSPACE_PATH" ]; then
        log_check "workspace" "fail" "Directory not found: $WORKSPACE_PATH"
        return $EXIT_FAILURE
    fi
    
    if [ ! -f "$WORKSPACE_PATH/package.json" ]; then
        log_check "workspace" "warn" "No package.json found"
        return $EXIT_WARNING
    fi
    
    log_check "workspace" "pass" "$WORKSPACE_PATH"
    return $EXIT_SUCCESS
}

check_disk_space() {
    local usage=0
    
    if command -v df &>/dev/null; then
        usage=$(df "$WORKSPACE_PATH" 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo "0")
    fi
    
    # Validate numeric
    if ! [[ "$usage" =~ ^[0-9]+$ ]]; then
        log_check "disk" "warn" "Could not determine usage"
        return $EXIT_WARNING
    fi
    
    if [ "$usage" -gt 95 ]; then
        log_check "disk" "fail" "${usage}% used (critical)"
        return $EXIT_FAILURE
    elif [ "$usage" -gt 85 ]; then
        log_check "disk" "warn" "${usage}% used (high)"
        return $EXIT_WARNING
    fi
    
    log_check "disk" "pass" "${usage}% used"
    return $EXIT_SUCCESS
}

check_memory() {
    if ! command -v free &>/dev/null; then
        log_verbose "Memory check skipped (free not available)"
        return $EXIT_SUCCESS
    fi
    
    local mem_available
    mem_available=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", $7/$2 * 100}' || echo "0")
    
    if ! [[ "$mem_available" =~ ^[0-9]+$ ]]; then
        return $EXIT_SUCCESS
    fi
    
    if [ "$mem_available" -lt 5 ]; then
        log_check "memory" "fail" "${mem_available}% available (critical)"
        return $EXIT_FAILURE
    elif [ "$mem_available" -lt 15 ]; then
        log_check "memory" "warn" "${mem_available}% available (low)"
        return $EXIT_WARNING
    fi
    
    log_check "memory" "pass" "${mem_available}% available"
    return $EXIT_SUCCESS
}

check_node_modules() {
    if [ ! -d "$WORKSPACE_PATH/node_modules" ]; then
        log_check "node_modules" "warn" "Not installed (run pnpm install)"
        return $EXIT_WARNING
    fi
    
    log_check "node_modules" "pass" "installed"
    return $EXIT_SUCCESS
}

check_env_file() {
    if [ -f "$WORKSPACE_PATH/.env" ] || [ -f "$WORKSPACE_PATH/.env.local" ]; then
        log_check "env_file" "pass" "present"
        return $EXIT_SUCCESS
    fi
    
    if [ -f "$WORKSPACE_PATH/.env.example" ]; then
        log_check "env_file" "warn" "Missing (copy from .env.example)"
    else
        log_check "env_file" "warn" "Missing"
    fi
    return $EXIT_WARNING
}

check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-2}
    
    if ! command -v curl &>/dev/null; then
        return $EXIT_SUCCESS
    fi
    
    if curl -sf --max-time "$timeout" "$url" &>/dev/null; then
        log_check "service_$name" "pass" "healthy"
        return $EXIT_SUCCESS
    else
        log_check "service_$name" "warn" "not responding"
        return $EXIT_WARNING
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    local exit_code=$EXIT_SUCCESS
    local errors=0
    local warnings=0
    
    if [ "$JSON_OUTPUT" = "false" ]; then
        echo ""
        echo "ValueOS Health Check"
        echo "===================="
        echo ""
    fi
    
    # Critical checks
    check_node || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    check_npm || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    check_workspace || { errors=$((errors + 1)); exit_code=$EXIT_FAILURE; }
    
    # Resource checks
    check_disk_space || {
        local rc=$?
        if [ $rc -eq $EXIT_FAILURE ]; then
            errors=$((errors + 1))
            exit_code=$EXIT_FAILURE
        else
            warnings=$((warnings + 1))
            [ $exit_code -eq $EXIT_SUCCESS ] && exit_code=$EXIT_WARNING
        fi
    }
    
    check_memory || {
        local rc=$?
        if [ $rc -eq $EXIT_FAILURE ]; then
            errors=$((errors + 1))
            exit_code=$EXIT_FAILURE
        else
            warnings=$((warnings + 1))
            [ $exit_code -eq $EXIT_SUCCESS ] && exit_code=$EXIT_WARNING
        fi
    }
    
    # Non-critical checks
    check_docker || warnings=$((warnings + 1))
    check_node_modules || warnings=$((warnings + 1))
    check_env_file || warnings=$((warnings + 1))
    
    # Optional service checks
    if [ "$CHECK_SERVICES" = "true" ]; then
        check_service "frontend" "http://localhost:5173" 2 || true
        check_service "backend" "http://localhost:3001/health" 2 || true
    fi
    
    # Output results
    if [ "$JSON_OUTPUT" = "true" ]; then
        local results_json
        results_json=$(printf '%s\n' "${CHECK_RESULTS[@]}" | paste -sd ',' -)
        echo "{\"status\":\"$([ $exit_code -eq 0 ] && echo 'healthy' || echo 'unhealthy')\",\"errors\":$errors,\"warnings\":$warnings,\"checks\":[$results_json]}"
    else
        echo ""
        if [ $exit_code -eq $EXIT_SUCCESS ]; then
            echo -e "${GREEN}✓${NC} Container is healthy"
        elif [ $exit_code -eq $EXIT_WARNING ]; then
            echo -e "${YELLOW}⚠${NC} Container is healthy with $warnings warning(s)"
        else
            echo -e "${RED}✗${NC} Container has $errors error(s), $warnings warning(s)"
        fi
        echo ""
    fi
    
    exit $exit_code
}

main "$@"
