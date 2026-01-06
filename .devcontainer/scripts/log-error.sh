#!/bin/bash
###############################################################################
# Centralized Error Logging
# 
# Provides structured error logging with:
# - JSON format support
# - Log rotation
# - Severity levels
# - Context tracking
# - Automatic cleanup
###############################################################################

# Configuration
LOG_DIR="${LOG_DIR:-${HOME}/.devcontainer-logs}"
LOG_FILE="${LOG_FILE:-${LOG_DIR}/errors.log}"
LOG_FORMAT="${LOG_FORMAT:-json}"
MAX_LOG_SIZE=${MAX_LOG_SIZE:-10485760}  # 10MB
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Severity levels
SEVERITY_DEBUG=0
SEVERITY_INFO=1
SEVERITY_WARN=2
SEVERITY_ERROR=3
SEVERITY_FATAL=4

# Current log level (only log messages at or above this level)
LOG_LEVEL=${LOG_LEVEL:-$SEVERITY_INFO}

###############################################################################
# Setup
###############################################################################

setup_logging() {
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Create log file if it doesn't exist
    touch "$LOG_FILE"
    
    # Set permissions
    chmod 600 "$LOG_FILE"
}

###############################################################################
# Log Rotation
###############################################################################

rotate_log() {
    if [ ! -f "$LOG_FILE" ]; then
        return 0
    fi
    
    local size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo "0")
    
    if [ "$size" -gt "$MAX_LOG_SIZE" ]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local rotated_file="${LOG_FILE}.${timestamp}"
        
        mv "$LOG_FILE" "$rotated_file"
        gzip "$rotated_file" &
        
        touch "$LOG_FILE"
        chmod 600 "$LOG_FILE"
    fi
}

###############################################################################
# Cleanup Old Logs
###############################################################################

cleanup_old_logs() {
    find "$LOG_DIR" -name "*.log.*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
}

###############################################################################
# Get Severity Name
###############################################################################

get_severity_name() {
    local level=$1
    
    case $level in
        $SEVERITY_DEBUG) echo "DEBUG" ;;
        $SEVERITY_INFO) echo "INFO" ;;
        $SEVERITY_WARN) echo "WARN" ;;
        $SEVERITY_ERROR) echo "ERROR" ;;
        $SEVERITY_FATAL) echo "FATAL" ;;
        *) echo "UNKNOWN" ;;
    esac
}

###############################################################################
# Log Message
###############################################################################

log_message() {
    local severity=$1
    local message=$2
    local context=${3:-"unknown"}
    local metadata=${4:-"{}"}
    
    # Check if we should log this severity
    if [ "$severity" -lt "$LOG_LEVEL" ]; then
        return 0
    fi
    
    # Setup logging
    setup_logging
    
    # Rotate if needed
    rotate_log
    
    # Cleanup old logs periodically (1% chance)
    if [ $((RANDOM % 100)) -eq 0 ]; then
        cleanup_old_logs &
    fi
    
    local timestamp=$(date -Iseconds)
    local severity_name=$(get_severity_name $severity)
    local hostname=$(hostname)
    local user=$(whoami)
    local pid=$$
    
    # Format log entry
    if [ "$LOG_FORMAT" = "json" ]; then
        # JSON format
        local log_entry=$(cat <<EOF
{"timestamp":"$timestamp","severity":"$severity_name","level":$severity,"message":"$message","context":"$context","hostname":"$hostname","user":"$user","pid":$pid,"metadata":$metadata}
EOF
)
    else
        # Plain text format
        local log_entry="[$timestamp] [$severity_name] [$context] $message"
    fi
    
    # Write to log file
    echo "$log_entry" >> "$LOG_FILE"
    
    # Also output to stderr for ERROR and FATAL
    if [ "$severity" -ge "$SEVERITY_ERROR" ]; then
        echo "$log_entry" >&2
    fi
}

###############################################################################
# Convenience Functions
###############################################################################

log_debug() {
    log_message $SEVERITY_DEBUG "$1" "${2:-debug}" "${3:-{}}"
}

log_info() {
    log_message $SEVERITY_INFO "$1" "${2:-info}" "${3:-{}}"
}

log_warn() {
    log_message $SEVERITY_WARN "$1" "${2:-warning}" "${3:-{}}"
}

log_error() {
    log_message $SEVERITY_ERROR "$1" "${2:-error}" "${3:-{}}"
}

log_fatal() {
    log_message $SEVERITY_FATAL "$1" "${2:-fatal}" "${3:-{}}"
}

###############################################################################
# Log with Stack Trace
###############################################################################

log_error_with_trace() {
    local message=$1
    local context=${2:-"error"}
    
    # Capture stack trace
    local stack_trace=""
    local frame=0
    
    while caller $frame &> /dev/null; do
        local line=$(caller $frame)
        stack_trace="${stack_trace}${line}\n"
        frame=$((frame + 1))
    done
    
    # Create metadata with stack trace
    local metadata=$(cat <<EOF
{"stack_trace":"$stack_trace"}
EOF
)
    
    log_error "$message" "$context" "$metadata"
}

###############################################################################
# Query Logs
###############################################################################

query_logs() {
    local severity=${1:-""}
    local context=${2:-""}
    local since=${3:-""}
    
    if [ ! -f "$LOG_FILE" ]; then
        echo "No logs found"
        return 1
    fi
    
    local filter="cat"
    
    # Filter by severity
    if [ -n "$severity" ]; then
        filter="$filter | grep '\"severity\":\"$severity\"'"
    fi
    
    # Filter by context
    if [ -n "$context" ]; then
        filter="$filter | grep '\"context\":\"$context\"'"
    fi
    
    # Filter by time
    if [ -n "$since" ]; then
        filter="$filter | grep -A 999999 '\"timestamp\":\"$since\"'"
    fi
    
    eval "$filter" < "$LOG_FILE"
}

###############################################################################
# Show Recent Errors
###############################################################################

show_recent_errors() {
    local count=${1:-10}
    
    if [ ! -f "$LOG_FILE" ]; then
        echo "No logs found"
        return 1
    fi
    
    if [ "$LOG_FORMAT" = "json" ]; then
        grep '"severity":"ERROR"\|"severity":"FATAL"' "$LOG_FILE" | tail -n "$count" | jq -r '.timestamp + " [" + .severity + "] " + .message'
    else
        grep '\[ERROR\]\|\[FATAL\]' "$LOG_FILE" | tail -n "$count"
    fi
}

###############################################################################
# Show Statistics
###############################################################################

show_stats() {
    if [ ! -f "$LOG_FILE" ]; then
        echo "No logs found"
        return 1
    fi
    
    echo "Log Statistics"
    echo "=============="
    echo ""
    echo "Log file: $LOG_FILE"
    echo "Size: $(du -h "$LOG_FILE" | cut -f1)"
    echo "Lines: $(wc -l < "$LOG_FILE")"
    echo ""
    
    if [ "$LOG_FORMAT" = "json" ]; then
        echo "By Severity:"
        for level in DEBUG INFO WARN ERROR FATAL; do
            local count=$(grep -c "\"severity\":\"$level\"" "$LOG_FILE" 2>/dev/null || echo "0")
            echo "  $level: $count"
        done
        echo ""
        
        echo "By Context (top 10):"
        grep -o '"context":"[^"]*"' "$LOG_FILE" | cut -d'"' -f4 | sort | uniq -c | sort -rn | head -10
    else
        echo "By Severity:"
        for level in DEBUG INFO WARN ERROR FATAL; do
            local count=$(grep -c "\[$level\]" "$LOG_FILE" 2>/dev/null || echo "0")
            echo "  $level: $count"
        done
    fi
}

###############################################################################
# Main CLI
###############################################################################

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    # Script is being executed directly
    
    case "${1:-}" in
        log)
            shift
            log_error "$@"
            ;;
        query)
            shift
            query_logs "$@"
            ;;
        recent)
            shift
            show_recent_errors "$@"
            ;;
        stats)
            show_stats
            ;;
        *)
            cat <<EOF
Usage: $0 COMMAND [ARGS]

Commands:
  log MESSAGE [CONTEXT] [METADATA]  Log an error message
  query [SEVERITY] [CONTEXT] [SINCE] Query logs
  recent [COUNT]                     Show recent errors (default: 10)
  stats                              Show log statistics

Examples:
  # Log an error
  $0 log "Database connection failed" "database" '{"host":"localhost"}'

  # Show recent errors
  $0 recent 20

  # Query errors from specific context
  $0 query ERROR database

  # Show statistics
  $0 stats

Environment Variables:
  LOG_DIR           Log directory (default: ~/.devcontainer-logs)
  LOG_FILE          Log file path (default: \$LOG_DIR/errors.log)
  LOG_FORMAT        Log format: json or text (default: json)
  LOG_LEVEL         Minimum severity to log (default: 1/INFO)
  MAX_LOG_SIZE      Max log size before rotation (default: 10MB)
  RETENTION_DAYS    Days to keep old logs (default: 30)

Usage in Scripts:
  source $0
  log_error "Something went wrong" "my-script"
  log_warn "This is a warning" "my-script"

EOF
            exit 1
            ;;
    esac
fi
