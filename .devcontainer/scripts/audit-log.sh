#!/bin/bash
###############################################################################
# Security Audit Logging
# 
# Logs security-relevant events:
# - Access attempts
# - Permission changes
# - Configuration modifications
# - Security violations
###############################################################################

# Configuration
AUDIT_LOG_DIR="${AUDIT_LOG_DIR:-${HOME}/.devcontainer-audit}"
AUDIT_LOG_FILE="${AUDIT_LOG_FILE:-${AUDIT_LOG_DIR}/audit.log}"
MAX_LOG_SIZE=${MAX_LOG_SIZE:-52428800}  # 50MB
RETENTION_DAYS=${RETENTION_DAYS:-90}

# Event types
EVENT_ACCESS="ACCESS"
EVENT_AUTH="AUTHENTICATION"
EVENT_PERMISSION="PERMISSION"
EVENT_CONFIG="CONFIGURATION"
EVENT_SECURITY="SECURITY_VIOLATION"
EVENT_ADMIN="ADMIN_ACTION"

###############################################################################
# Setup
###############################################################################

setup_audit_logging() {
    mkdir -p "$AUDIT_LOG_DIR"
    touch "$AUDIT_LOG_FILE"
    chmod 600 "$AUDIT_LOG_FILE"
}

###############################################################################
# Rotate Log
###############################################################################

rotate_audit_log() {
    if [ ! -f "$AUDIT_LOG_FILE" ]; then
        return 0
    fi
    
    local size=$(stat -f%z "$AUDIT_LOG_FILE" 2>/dev/null || stat -c%s "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
    
    if [ "$size" -gt "$MAX_LOG_SIZE" ]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local rotated_file="${AUDIT_LOG_FILE}.${timestamp}"
        
        mv "$AUDIT_LOG_FILE" "$rotated_file"
        gzip "$rotated_file" &
        
        touch "$AUDIT_LOG_FILE"
        chmod 600 "$AUDIT_LOG_FILE"
    fi
}

###############################################################################
# Log Audit Event
###############################################################################

log_audit_event() {
    local event_type=$1
    local action=$2
    local resource=$3
    local result=$4
    local details=${5:-""}
    
    setup_audit_logging
    rotate_audit_log
    
    local timestamp=$(date -Iseconds)
    local user=$(whoami)
    local hostname=$(hostname)
    local pid=$$
    local ppid=$PPID
    
    # Get parent process info
    local parent_cmd=$(ps -p $ppid -o comm= 2>/dev/null || echo "unknown")
    
    # Get source IP if available
    local source_ip=$(echo $SSH_CLIENT | awk '{print $1}' || echo "local")
    
    # Create audit entry
    local audit_entry=$(cat <<EOF
{"timestamp":"$timestamp","event_type":"$event_type","action":"$action","resource":"$resource","result":"$result","user":"$user","hostname":"$hostname","source_ip":"$source_ip","pid":$pid,"ppid":$ppid,"parent_cmd":"$parent_cmd","details":"$details"}
EOF
)
    
    # Write to audit log
    echo "$audit_entry" >> "$AUDIT_LOG_FILE"
    
    # Also write to syslog if available
    if command -v logger &> /dev/null; then
        logger -t "valuecanvas-audit" -p auth.info "$event_type: $action on $resource by $user ($result)"
    fi
}

###############################################################################
# Convenience Functions
###############################################################################

log_access() {
    log_audit_event "$EVENT_ACCESS" "$1" "$2" "$3" "$4"
}

log_auth() {
    log_audit_event "$EVENT_AUTH" "$1" "$2" "$3" "$4"
}

log_permission_change() {
    log_audit_event "$EVENT_PERMISSION" "$1" "$2" "$3" "$4"
}

log_config_change() {
    log_audit_event "$EVENT_CONFIG" "$1" "$2" "$3" "$4"
}

log_security_violation() {
    log_audit_event "$EVENT_SECURITY" "$1" "$2" "$3" "$4"
}

log_admin_action() {
    log_audit_event "$EVENT_ADMIN" "$1" "$2" "$3" "$4"
}

###############################################################################
# Query Audit Log
###############################################################################

query_audit_log() {
    local event_type=${1:-""}
    local user=${2:-""}
    local since=${3:-""}
    local result=${4:-""}
    
    if [ ! -f "$AUDIT_LOG_FILE" ]; then
        echo "No audit log found"
        return 1
    fi
    
    local filter="cat"
    
    # Filter by event type
    if [ -n "$event_type" ]; then
        filter="$filter | grep '\"event_type\":\"$event_type\"'"
    fi
    
    # Filter by user
    if [ -n "$user" ]; then
        filter="$filter | grep '\"user\":\"$user\"'"
    fi
    
    # Filter by result
    if [ -n "$result" ]; then
        filter="$filter | grep '\"result\":\"$result\"'"
    fi
    
    # Filter by time
    if [ -n "$since" ]; then
        filter="$filter | grep -A 999999 '\"timestamp\":\"$since\"'"
    fi
    
    eval "$filter" < "$AUDIT_LOG_FILE"
}

###############################################################################
# Show Recent Events
###############################################################################

show_recent_events() {
    local count=${1:-20}
    local event_type=${2:-""}
    
    if [ ! -f "$AUDIT_LOG_FILE" ]; then
        echo "No audit log found"
        return 1
    fi
    
    if [ -n "$event_type" ]; then
        grep "\"event_type\":\"$event_type\"" "$AUDIT_LOG_FILE" | tail -n "$count" | jq -r '.timestamp + " [" + .event_type + "] " + .user + " " + .action + " " + .resource + " (" + .result + ")"'
    else
        tail -n "$count" "$AUDIT_LOG_FILE" | jq -r '.timestamp + " [" + .event_type + "] " + .user + " " + .action + " " + .resource + " (" + .result + ")"'
    fi
}

###############################################################################
# Show Statistics
###############################################################################

show_audit_stats() {
    if [ ! -f "$AUDIT_LOG_FILE" ]; then
        echo "No audit log found"
        return 1
    fi
    
    echo "Audit Log Statistics"
    echo "===================="
    echo ""
    echo "Log file: $AUDIT_LOG_FILE"
    echo "Size: $(du -h "$AUDIT_LOG_FILE" | cut -f1)"
    echo "Entries: $(wc -l < "$AUDIT_LOG_FILE")"
    echo ""
    
    echo "By Event Type:"
    for type in ACCESS AUTHENTICATION PERMISSION CONFIGURATION SECURITY_VIOLATION ADMIN_ACTION; do
        local count=$(grep -c "\"event_type\":\"$type\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
        echo "  $type: $count"
    done
    echo ""
    
    echo "By Result:"
    for result in SUCCESS FAILURE DENIED; do
        local count=$(grep -c "\"result\":\"$result\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
        echo "  $result: $count"
    done
    echo ""
    
    echo "Top Users (last 100 events):"
    tail -n 100 "$AUDIT_LOG_FILE" | jq -r '.user' | sort | uniq -c | sort -rn | head -5
    echo ""
    
    echo "Recent Security Violations:"
    grep "\"event_type\":\"SECURITY_VIOLATION\"" "$AUDIT_LOG_FILE" | tail -n 5 | jq -r '.timestamp + " " + .action + " by " + .user'
}

###############################################################################
# Generate Report
###############################################################################

generate_audit_report() {
    local output_file=${1:-"$AUDIT_LOG_DIR/audit_report_$(date +%Y%m%d).md"}
    
    if [ ! -f "$AUDIT_LOG_FILE" ]; then
        echo "No audit log found"
        return 1
    fi
    
    cat > "$output_file" <<EOF
# Security Audit Report

**Generated:** $(date -Iseconds)  
**Period:** Last 30 days  
**Log File:** $AUDIT_LOG_FILE

## Summary

**Total Events:** $(wc -l < "$AUDIT_LOG_FILE")  
**Security Violations:** $(grep -c "\"event_type\":\"SECURITY_VIOLATION\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")  
**Failed Authentications:** $(grep -c "\"event_type\":\"AUTHENTICATION\".*\"result\":\"FAILURE\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")

## Event Breakdown

### By Type
EOF
    
    for type in ACCESS AUTHENTICATION PERMISSION CONFIGURATION SECURITY_VIOLATION ADMIN_ACTION; do
        local count=$(grep -c "\"event_type\":\"$type\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
        echo "- $type: $count" >> "$output_file"
    done
    
    cat >> "$output_file" <<EOF

### By Result
EOF
    
    for result in SUCCESS FAILURE DENIED; do
        local count=$(grep -c "\"result\":\"$result\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
        echo "- $result: $count" >> "$output_file"
    done
    
    cat >> "$output_file" <<EOF

## Security Violations

EOF
    
    grep "\"event_type\":\"SECURITY_VIOLATION\"" "$AUDIT_LOG_FILE" | tail -n 10 | jq -r '"- " + .timestamp + ": " + .action + " by " + .user' >> "$output_file" || echo "None" >> "$output_file"
    
    cat >> "$output_file" <<EOF

## Failed Authentications

EOF
    
    grep "\"event_type\":\"AUTHENTICATION\".*\"result\":\"FAILURE\"" "$AUDIT_LOG_FILE" | tail -n 10 | jq -r '"- " + .timestamp + ": " + .action + " by " + .user + " from " + .source_ip' >> "$output_file" || echo "None" >> "$output_file"
    
    cat >> "$output_file" <<EOF

## Recommendations

EOF
    
    local violations=$(grep -c "\"event_type\":\"SECURITY_VIOLATION\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
    local failed_auth=$(grep -c "\"event_type\":\"AUTHENTICATION\".*\"result\":\"FAILURE\"" "$AUDIT_LOG_FILE" 2>/dev/null || echo "0")
    
    if [ "$violations" -gt 10 ]; then
        echo "- ⚠️  High number of security violations detected. Review access controls." >> "$output_file"
    fi
    
    if [ "$failed_auth" -gt 5 ]; then
        echo "- ⚠️  Multiple failed authentication attempts. Consider implementing rate limiting." >> "$output_file"
    fi
    
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "" >> "$output_file"
    echo "**Report Location:** $output_file" >> "$output_file"
    
    echo "✓ Report generated: $output_file"
}

###############################################################################
# Main CLI
###############################################################################

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    case "${1:-}" in
        log)
            shift
            log_audit_event "$@"
            ;;
        query)
            shift
            query_audit_log "$@"
            ;;
        recent)
            shift
            show_recent_events "$@"
            ;;
        stats)
            show_audit_stats
            ;;
        report)
            shift
            generate_audit_report "$@"
            ;;
        *)
            cat <<EOF
Usage: $0 COMMAND [ARGS]

Commands:
  log TYPE ACTION RESOURCE RESULT [DETAILS]  Log an audit event
  query [TYPE] [USER] [SINCE] [RESULT]       Query audit log
  recent [COUNT] [TYPE]                       Show recent events
  stats                                       Show statistics
  report [OUTPUT_FILE]                        Generate audit report

Event Types:
  ACCESS, AUTHENTICATION, PERMISSION, CONFIGURATION, SECURITY_VIOLATION, ADMIN_ACTION

Examples:
  # Log access event
  $0 log ACCESS "read file" "/etc/passwd" SUCCESS

  # Show recent security violations
  $0 recent 10 SECURITY_VIOLATION

  # Query failed authentications
  $0 query AUTHENTICATION "" "" FAILURE

  # Generate report
  $0 report

Usage in Scripts:
  source $0
  log_access "read file" "/path/to/file" "SUCCESS"
  log_security_violation "unauthorized access" "/admin" "DENIED"

EOF
            exit 1
            ;;
    esac
fi
