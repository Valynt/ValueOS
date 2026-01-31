#!/bin/bash
###############################################################################
# Common Shell Library for DevContainer Scripts
# Source this file to get shared functions and utilities
#
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
###############################################################################

# Prevent multiple sourcing
if [ -n "$_VALUEOS_COMMON_LOADED" ]; then
    return 0
fi
_VALUEOS_COMMON_LOADED=1

###############################################################################
# Configuration
###############################################################################

# Determine paths
COMMON_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_SCRIPTS_DIR="$(cd "$COMMON_LIB_DIR/.." && pwd)"
DEVCONTAINER_DIR="$(cd "$DEVCONTAINER_SCRIPTS_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DEVCONTAINER_DIR/.." && pwd)"

# Default configuration
: "${LOG_LEVEL:=info}"
: "${MAX_RETRIES:=3}"
: "${NETWORK_TIMEOUT:=30}"
: "${COMMAND_TIMEOUT:=300}"

###############################################################################
# Color Support
###############################################################################

setup_colors() {
    if [ -t 1 ] && [ "${NO_COLOR:-}" != "1" ]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        MAGENTA='\033[0;35m'
        CYAN='\033[0;36m'
        BOLD='\033[1m'
        NC='\033[0m'
    else
        RED='' GREEN='' YELLOW='' BLUE='' MAGENTA='' CYAN='' BOLD='' NC=''
    fi
}
setup_colors

###############################################################################
# Logging Functions
###############################################################################

_log() {
    local level=$1
    local color=$2
    local symbol=$3
    shift 3
    local message="$*"
    local timestamp
    timestamp=$(date '+%H:%M:%S')
    
    echo -e "${color}${symbol}${NC} ${message}"
    
    # Also log to file if LOG_FILE is set
    if [ -n "${LOG_FILE:-}" ]; then
        echo "[$(date -Iseconds)] ${level^^}: ${message}" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

log_debug() {
    [ "$LOG_LEVEL" = "debug" ] && _log "debug" "$CYAN" "·" "$@"
}

log_info() {
    _log "info" "$BLUE" "▶" "$@"
}

log_success() {
    _log "success" "$GREEN" "✓" "$@"
}

log_warn() {
    _log "warn" "$YELLOW" "⚠" "$@"
}

log_error() {
    _log "error" "$RED" "✗" "$@" >&2
}

log_fatal() {
    _log "fatal" "$RED" "✗" "$@" >&2
    exit 1
}

###############################################################################
# Utility Functions
###############################################################################

# Check if a command exists
command_exists() {
    command -v "$1" &>/dev/null
}

# Check if running in a container
is_container() {
    [ -f /.dockerenv ] || [ -n "${CONTAINER:-}" ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

# Check if running in CI
is_ci() {
    [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${GITLAB_CI:-}" ]
}

# Safe directory creation (idempotent)
ensure_dir() {
    local dir="$1"
    [ -d "$dir" ] || mkdir -p "$dir"
}

# Safe file removal
safe_rm() {
    local path="$1"
    [ -e "$path" ] && rm -rf "$path"
}

# Get absolute path
abs_path() {
    local path="$1"
    if [ -d "$path" ]; then
        (cd "$path" && pwd)
    elif [ -f "$path" ]; then
        local dir
        dir=$(dirname "$path")
        echo "$(cd "$dir" && pwd)/$(basename "$path")"
    else
        echo "$path"
    fi
}

###############################################################################
# Retry and Timeout Functions
###############################################################################

# Retry a command with exponential backoff
# Usage: retry_cmd <max_attempts> <command...>
retry_cmd() {
    local max_attempts=$1
    shift
    local delay=1
    local attempt
    
    for ((attempt=1; attempt<=max_attempts; attempt++)); do
        if "$@"; then
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            log_warn "Attempt $attempt/$max_attempts failed, retrying in ${delay}s..."
            sleep $delay
            delay=$((delay * 2))
            [ $delay -gt 30 ] && delay=30
        fi
    done
    
    log_error "All $max_attempts attempts failed"
    return 1
}

# Run command with timeout
# Usage: with_timeout <seconds> <command...>
with_timeout() {
    local timeout_secs=$1
    shift
    
    if command_exists timeout; then
        timeout "$timeout_secs" "$@"
    else
        "$@"
    fi
}

# Run command with both retry and timeout
# Usage: robust_cmd <timeout> <retries> <command...>
robust_cmd() {
    local timeout_secs=$1
    local max_retries=$2
    shift 2
    
    retry_cmd "$max_retries" with_timeout "$timeout_secs" "$@"
}

###############################################################################
# Port Management
###############################################################################

# Check if a port is in use
is_port_in_use() {
    local port=$1
    local host=${2:-127.0.0.1}
    
    if command_exists nc; then
        nc -z "$host" "$port" 2>/dev/null
    elif command_exists lsof; then
        lsof -i ":$port" &>/dev/null
    else
        # Fallback: try to connect with bash
        (echo >/dev/tcp/"$host"/"$port") 2>/dev/null
    fi
}

# Find next available port starting from given port
find_available_port() {
    local start_port=$1
    local max_port=${2:-65535}
    local port=$start_port
    
    while [ $port -le $max_port ]; do
        if ! is_port_in_use $port; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    return 1
}

# Wait for a port to become available
wait_for_port() {
    local port=$1
    local host=${2:-127.0.0.1}
    local timeout=${3:-30}
    local interval=${4:-1}
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if is_port_in_use "$port" "$host"; then
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    return 1
}

###############################################################################
# Service Health Checks
###############################################################################

# Check HTTP endpoint health
check_http_health() {
    local url=$1
    local timeout=${2:-5}
    local expected_code=${3:-200}
    
    if ! command_exists curl; then
        log_warn "curl not available for health check"
        return 1
    fi
    
    local response_code
    response_code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    
    [ "$response_code" = "$expected_code" ]
}

# Wait for HTTP endpoint to become healthy
wait_for_http() {
    local url=$1
    local timeout=${2:-60}
    local interval=${3:-2}
    local elapsed=0
    
    log_info "Waiting for $url..."
    
    while [ $elapsed -lt $timeout ]; do
        if check_http_health "$url" 5; then
            log_success "Service at $url is healthy"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log_error "Timeout waiting for $url"
    return 1
}

###############################################################################
# Docker Utilities
###############################################################################

# Check if Docker is available and running
docker_available() {
    command_exists docker && docker ps &>/dev/null 2>&1
}

# Check if a Docker container is running
container_running() {
    local name=$1
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"
}

# Wait for container to be healthy
wait_for_container() {
    local name=$1
    local timeout=${2:-60}
    local interval=${3:-2}
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "none")
        
        case "$health" in
            healthy) return 0 ;;
            unhealthy) return 1 ;;
            none)
                # No health check, just check if running
                if container_running "$name"; then
                    return 0
                fi
                ;;
        esac
        
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    return 1
}

###############################################################################
# Cleanup and Trap Handling
###############################################################################

# Array to store cleanup functions
declare -a _CLEANUP_FUNCTIONS=()

# Register a cleanup function
register_cleanup() {
    _CLEANUP_FUNCTIONS+=("$1")
}

# Run all cleanup functions
run_cleanup() {
    local exit_code=$?
    
    for func in "${_CLEANUP_FUNCTIONS[@]}"; do
        $func || true
    done
    
    return $exit_code
}

# Setup cleanup trap
setup_cleanup_trap() {
    trap run_cleanup EXIT
}

###############################################################################
# Lock File Management
###############################################################################

# Acquire a lock file
acquire_lock() {
    local lock_file=$1
    local timeout=${2:-10}
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if mkdir "$lock_file" 2>/dev/null; then
            echo $$ > "$lock_file/pid"
            return 0
        fi
        
        # Check if lock holder is still alive
        if [ -f "$lock_file/pid" ]; then
            local pid
            pid=$(cat "$lock_file/pid" 2>/dev/null || echo "")
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                # Stale lock, remove it
                rm -rf "$lock_file"
                continue
            fi
        fi
        
        sleep 1
        elapsed=$((elapsed + 1))
    done
    
    return 1
}

# Release a lock file
release_lock() {
    local lock_file=$1
    rm -rf "$lock_file"
}

###############################################################################
# Version Comparison
###############################################################################

# Compare semantic versions
# Returns: 0 if v1 >= v2, 1 otherwise
version_gte() {
    local v1=$1
    local v2=$2
    
    # Remove 'v' prefix if present
    v1=${v1#v}
    v2=${v2#v}
    
    printf '%s\n%s\n' "$v2" "$v1" | sort -V -C
}

# Check if Node.js version meets minimum requirement
check_node_version() {
    local min_version=${1:-18}
    local current_version
    
    if ! command_exists node; then
        return 1
    fi
    
    current_version=$(node --version 2>/dev/null | sed 's/^v//')
    version_gte "$current_version" "$min_version"
}

###############################################################################
# Environment Validation
###############################################################################

# Validate required environment variables
require_env() {
    local missing=()
    
    for var in "$@"; do
        if [ -z "${!var:-}" ]; then
            missing+=("$var")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required environment variables: ${missing[*]}"
        return 1
    fi
    
    return 0
}

# Load environment file
load_env_file() {
    local env_file=$1
    
    if [ ! -f "$env_file" ]; then
        return 1
    fi
    
    # Export variables from env file (skip comments and empty lines)
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^[[:space:]]*# ]] && continue
        [[ -z $key ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Export if not already set
        if [ -z "${!key:-}" ]; then
            export "$key=$value"
        fi
    done < "$env_file"
}
