#!/bin/bash
###############################################################################
# Performance Metrics Collection
# 
# Collects and stores:
# - Container resource usage (CPU, memory, disk, network)
# - System load and performance
# - Service response times
# - Custom application metrics
###############################################################################

set -e

# Configuration
METRICS_DIR="${METRICS_DIR:-${HOME}/.devcontainer-metrics}"
METRICS_FILE="${METRICS_FILE:-${METRICS_DIR}/metrics_$(date +%Y%m%d).jsonl}"
COLLECTION_INTERVAL=${COLLECTION_INTERVAL:-60}
CONTAINER_NAME="${CONTAINER_NAME:-valuecanvas-dev-optimized}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

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

###############################################################################
# Setup
###############################################################################

setup() {
    mkdir -p "$METRICS_DIR"
    touch "$METRICS_FILE"
}

###############################################################################
# Collect Container Metrics
###############################################################################

collect_container_metrics() {
    if ! command -v docker &> /dev/null; then
        return 1
    fi
    
    if ! docker inspect "$CONTAINER_NAME" &> /dev/null; then
        return 1
    fi
    
    # Get container stats
    local stats=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}")
    
    local cpu=$(echo "$stats" | cut -d',' -f1 | sed 's/%//')
    local mem_perc=$(echo "$stats" | cut -d',' -f2 | sed 's/%//')
    local mem_usage=$(echo "$stats" | cut -d',' -f3)
    local net_io=$(echo "$stats" | cut -d',' -f4)
    local block_io=$(echo "$stats" | cut -d',' -f5)
    local pids=$(echo "$stats" | cut -d',' -f6)
    
    echo "{\"cpu\":\"$cpu\",\"memory_percent\":\"$mem_perc\",\"memory_usage\":\"$mem_usage\",\"network_io\":\"$net_io\",\"block_io\":\"$block_io\",\"pids\":\"$pids\"}"
}

###############################################################################
# Collect System Metrics
###############################################################################

collect_system_metrics() {
    # Load average
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    
    # Disk usage
    local disk=$(df /workspace 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # Memory info
    local mem_total=$(free -m 2>/dev/null | grep Mem | awk '{print $2}')
    local mem_used=$(free -m 2>/dev/null | grep Mem | awk '{print $3}')
    local mem_free=$(free -m 2>/dev/null | grep Mem | awk '{print $4}')
    local mem_available=$(free -m 2>/dev/null | grep Mem | awk '{print $7}')
    
    echo "{\"load_average\":\"$load\",\"disk_usage_percent\":\"$disk\",\"memory_total_mb\":\"$mem_total\",\"memory_used_mb\":\"$mem_used\",\"memory_free_mb\":\"$mem_free\",\"memory_available_mb\":\"$mem_available\"}"
}

###############################################################################
# Collect Service Metrics
###############################################################################

collect_service_metrics() {
    local services='[]'
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        echo "$services"
        return 0
    fi
    
    # Frontend
    local frontend_status="down"
    local frontend_response_time=0
    if curl -sf --max-time 2 -w "%{time_total}" -o /dev/null http://localhost:3000 2>/dev/null; then
        frontend_status="up"
        frontend_response_time=$(curl -sf --max-time 2 -w "%{time_total}" -o /dev/null http://localhost:3000 2>/dev/null || echo "0")
    fi
    
    # Backend
    local backend_status="down"
    local backend_response_time=0
    if curl -sf --max-time 2 -w "%{time_total}" -o /dev/null http://localhost:8000/health 2>/dev/null; then
        backend_status="up"
        backend_response_time=$(curl -sf --max-time 2 -w "%{time_total}" -o /dev/null http://localhost:8000/health 2>/dev/null || echo "0")
    fi
    
    services=$(cat <<EOF
[{"name":"frontend","status":"$frontend_status","response_time":"$frontend_response_time"},{"name":"backend","status":"$backend_status","response_time":"$backend_response_time"}]
EOF
)
    
    echo "$services"
}

###############################################################################
# Collect All Metrics
###############################################################################

collect_metrics() {
    local timestamp=$(date -Iseconds)
    local hostname=$(hostname)
    
    # Collect metrics
    local container_metrics=$(collect_container_metrics 2>/dev/null || echo '{}')
    local system_metrics=$(collect_system_metrics 2>/dev/null || echo '{}')
    local service_metrics=$(collect_service_metrics 2>/dev/null || echo '[]')
    
    # Combine into single JSON object
    local metrics=$(cat <<EOF
{"timestamp":"$timestamp","hostname":"$hostname","container":$container_metrics,"system":$system_metrics,"services":$service_metrics}
EOF
)
    
    # Write to file
    echo "$metrics" >> "$METRICS_FILE"
}

###############################################################################
# Analyze Metrics
###############################################################################

analyze_metrics() {
    local file=${1:-$METRICS_FILE}
    
    if [ ! -f "$file" ]; then
        log_error "Metrics file not found: $file"
        return 1
    fi
    
    log_info "Analyzing metrics from: $file"
    echo ""
    
    # Count entries
    local count=$(wc -l < "$file")
    echo "Total entries: $count"
    echo ""
    
    # CPU statistics
    echo "CPU Usage:"
    jq -r '.container.cpu' "$file" 2>/dev/null | awk '{
        sum += $1
        if (NR == 1 || $1 < min) min = $1
        if (NR == 1 || $1 > max) max = $1
        count++
    } END {
        if (count > 0) {
            printf "  Average: %.2f%%\n", sum/count
            printf "  Min: %.2f%%\n", min
            printf "  Max: %.2f%%\n", max
        }
    }'
    echo ""
    
    # Memory statistics
    echo "Memory Usage:"
    jq -r '.container.memory_percent' "$file" 2>/dev/null | awk '{
        sum += $1
        if (NR == 1 || $1 < min) min = $1
        if (NR == 1 || $1 > max) max = $1
        count++
    } END {
        if (count > 0) {
            printf "  Average: %.2f%%\n", sum/count
            printf "  Min: %.2f%%\n", min
            printf "  Max: %.2f%%\n", max
        }
    }'
    echo ""
    
    # Disk usage
    echo "Disk Usage:"
    jq -r '.system.disk_usage_percent' "$file" 2>/dev/null | tail -1 | awk '{printf "  Current: %s%%\n", $1}'
    echo ""
    
    # Service uptime
    echo "Service Status:"
    local frontend_up=$(jq -r '.services[] | select(.name=="frontend") | select(.status=="up")' "$file" 2>/dev/null | wc -l)
    local backend_up=$(jq -r '.services[] | select(.name=="backend") | select(.status=="up")' "$file" 2>/dev/null | wc -l)
    
    if [ "$count" -gt 0 ]; then
        printf "  Frontend uptime: %.1f%%\n" $(echo "scale=1; $frontend_up * 100 / $count" | bc)
        printf "  Backend uptime: %.1f%%\n" $(echo "scale=1; $backend_up * 100 / $count" | bc)
    fi
}

###############################################################################
# Generate Report
###############################################################################

generate_report() {
    local file=${1:-$METRICS_FILE}
    local output="${file%.jsonl}_report.md"
    
    if [ ! -f "$file" ]; then
        log_error "Metrics file not found: $file"
        return 1
    fi
    
    log_info "Generating report: $output"
    
    cat > "$output" <<EOF
# Performance Metrics Report

**Generated:** $(date -Iseconds)  
**Source:** $file  
**Entries:** $(wc -l < "$file")

## Container Metrics

### CPU Usage
EOF
    
    # CPU chart (simple text-based)
    echo "" >> "$output"
    echo "\`\`\`" >> "$output"
    jq -r '.timestamp + " " + .container.cpu' "$file" 2>/dev/null | tail -20 >> "$output"
    echo "\`\`\`" >> "$output"
    
    cat >> "$output" <<EOF

### Memory Usage

\`\`\`
EOF
    
    jq -r '.timestamp + " " + .container.memory_percent' "$file" 2>/dev/null | tail -20 >> "$output"
    
    cat >> "$output" <<EOF
\`\`\`

## System Metrics

### Load Average

\`\`\`
EOF
    
    jq -r '.timestamp + " " + .system.load_average' "$file" 2>/dev/null | tail -20 >> "$output"
    
    cat >> "$output" <<EOF
\`\`\`

## Service Health

EOF
    
    # Service status summary
    jq -r '.services[] | .name + ": " + .status' "$file" 2>/dev/null | tail -10 >> "$output"
    
    echo "" >> "$output"
    echo "---" >> "$output"
    echo "" >> "$output"
    echo "**Report generated by:** collect-metrics.sh" >> "$output"
    
    log_info "✓ Report saved: $output"
}

###############################################################################
# Continuous Collection
###############################################################################

collect_continuous() {
    log_info "Starting continuous metrics collection..."
    log_info "Interval: ${COLLECTION_INTERVAL}s"
    log_info "Output: $METRICS_FILE"
    log_info "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        collect_metrics
        log_info "Metrics collected at $(date +%H:%M:%S)"
        sleep "$COLLECTION_INTERVAL"
    done
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND [OPTIONS]

Commands:
  collect           Collect metrics once
  continuous        Collect metrics continuously
  analyze [FILE]    Analyze metrics file
  report [FILE]     Generate markdown report

Options:
  --interval N      Collection interval in seconds (default: 60)
  --output FILE     Output file path
  --container NAME  Container name (default: valuecanvas-dev-optimized)

Environment Variables:
  METRICS_DIR           Metrics directory (default: ~/.devcontainer-metrics)
  METRICS_FILE          Metrics file path
  COLLECTION_INTERVAL   Collection interval in seconds
  CONTAINER_NAME        Container name to monitor

Examples:
  # Collect metrics once
  $0 collect

  # Collect continuously every 30 seconds
  $0 --interval 30 continuous

  # Analyze today's metrics
  $0 analyze

  # Generate report
  $0 report

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local command=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --interval)
                COLLECTION_INTERVAL="$2"
                shift 2
                ;;
            --output)
                METRICS_FILE="$2"
                shift 2
                ;;
            --container)
                CONTAINER_NAME="$2"
                shift 2
                ;;
            collect|continuous|analyze|report)
                command="$1"
                shift
                break
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Setup
    setup
    
    # Execute command
    case "$command" in
        collect)
            collect_metrics
            log_info "✓ Metrics collected"
            ;;
        continuous)
            collect_continuous
            ;;
        analyze)
            analyze_metrics "$@"
            ;;
        report)
            generate_report "$@"
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
