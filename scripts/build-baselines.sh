#!/usr/bin/env bash

# Build performance baselines script
# Creates and manages performance baselines for build optimization

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASELINE_FILE="${BASELINE_FILE:-ops/baselines/build-performance.json}"
METRICS_RETENTION_DAYS=${METRICS_RETENTION_DAYS:-30}
PERFORMANCE_THRESHOLD=${PERFORMANCE_THRESHOLD:-20}  # 20% variance threshold

# Logging functions
log_info() {
    echo -e "${BLUE}📊 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create baseline directory
ensure_baseline_dir() {
    local baseline_dir=$(dirname "$BASELINE_FILE")
    if [ ! -d "$baseline_dir" ]; then
        mkdir -p "$baseline_dir"
        log_info "Created baseline directory: $baseline_dir"
    fi
}

# Collect build metrics
collect_metrics() {
    local target="$1"
    local build_id="$2"

    log_info "Collecting build metrics for $target (build: $build_id)"

    # Get system metrics
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "0")
    local memory_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}' || echo "0")
    local disk_usage=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")

    # Get Docker metrics
    local docker_images=$(docker images --format "table {{.Repository}}:{{.Tag}}" | wc -l || echo "0")
    local docker_cache_size=$(docker system df --format "{{.Type}}:{{.Size}}" | grep "Build Cache" | cut -d':' -f2 || echo "0")

    # Get network metrics
    local network_rx=$(cat /proc/net/dev | grep eth0 | awk '{print $2}' || echo "0")
    local network_tx=$(cat /proc/net/dev | grep eth0 | awk '{print $10}' || echo "0")

    # Create metrics object
    local metrics='{
        "build_id": "'$build_id'",
        "target": "'$target'",
        "timestamp": '$(date +%s)',
        "system": {
            "cpu_usage": '$cpu_usage',
            "memory_usage": '$memory_usage',
            "disk_usage": '$disk_usage'
        },
        "docker": {
            "images_count": '$docker_images',
            "cache_size": "'$docker_cache_size'"
        },
        "network": {
            "rx_bytes": '$network_rx',
            "tx_bytes": '$network_tx'
        }
    }'

    echo "$metrics"
}

# Create performance baseline
create_baseline() {
    local target="$1"
    local duration="$2"
    local image_size="$3"
    local build_id="${4:-$(date +%s)}"

    log_info "Creating performance baseline for $target"

    ensure_baseline_dir

    # Collect current metrics
    local metrics=$(collect_metrics "$target" "$build_id")

    # Load existing baselines
    local baselines='{"baselines": []}'
    if [ -f "$BASELINE_FILE" ]; then
        baselines=$(cat "$BASELINE_FILE")
    fi

    # Create new baseline entry
    local baseline='{
        "id": "'$build_id'",
        "target": "'$target'",
        "created_at": '$(date +%s)',
        "duration_seconds": '$duration',
        "image_size_bytes": '$image_size',
        "metrics": '$metrics',
        "environment": {
            "hostname": "'$(hostname)'",
            "os": "'$(uname -s)'",
            "arch": "'$(uname -m)'",
            "docker_version": "'$(docker --version | cut -d' ' -f3 | sed 's/,//')'",
            "cpu_cores": '$(nproc)',
            "memory_gb": '$(free -g | grep Mem | awk '{print $2}')'
        }
    }'

    # Add to baselines
    baselines=$(echo "$baselines" | jq ".baselines += [$baseline]")

    # Keep only recent baselines
    local cutoff_timestamp=$(date -d "$METRICS_RETENTION_DAYS days ago" +%s)
    baselines=$(echo "$baselines" | jq ".baselines = [.baselines[] | select(.created_at >= $cutoff_timestamp)]")

    # Save baselines
    echo "$baselines" > "$BASELINE_FILE"

    log_success "Baseline created for $target (ID: $build_id)"
}

# Compare current build to baseline
compare_to_baseline() {
    local target="$1"
    local current_duration="$2"
    local current_size="$3"

    log_info "Comparing $target build to baseline"

    if [ ! -f "$BASELINE_FILE" ]; then
        log_warning "No baseline file found, creating new baseline"
        create_baseline "$target" "$current_duration" "$current_size"
        return 0
    fi

    # Get latest baseline for target
    local latest_baseline=$(jq -r ".baselines[] | select(.target == \"$target\") | .duration_seconds" "$BASELINE_FILE" | sort -n | tail -1)

    if [ -z "$latest_baseline" ] || [ "$latest_baseline" = "null" ]; then
        log_warning "No baseline found for $target, creating new baseline"
        create_baseline "$target" "$current_duration" "$current_size"
        return 0
    fi

    # Calculate performance variance
    local variance=$(echo "scale=2; (($current_duration - $latest_baseline) / $latest_baseline) * 100" | bc -l)
    local variance_abs=$(echo "$variance" | sed 's/-//')

    log_info "Performance comparison for $target:"
    log_info "  Baseline duration: ${latest_baseline}s"
    log_info "  Current duration:  ${current_duration}s"
    log_info "  Variance: ${variance}%"

    # Check threshold
    if (( $(echo "$variance_abs > $PERFORMANCE_THRESHOLD" | bc -l) )); then
        if (( $(echo "$variance > 0" | bc -l) )); then
            log_warning "Build is ${variance}% slower than baseline"
        else
            log_success "Build is ${variance_abs}% faster than baseline"
        fi
        return 1
    else
        log_success "Build performance within acceptable range"
        return 0
    fi
}

# Analyze performance trends
analyze_trends() {
    local target="$1"
    local days="${2:-7}"

    log_info "Analyzing performance trends for $target (last $days days)"

    if [ ! -f "$BASELINE_FILE" ]; then
        log_error "No baseline file found"
        return 1
    fi

    # Get recent baselines
    local cutoff_timestamp=$(date -d "$days days ago" +%s)
    local recent_baselines=$(jq -r ".baselines[] | select(.target == \"$target\" and .created_at >= $cutoff_timestamp)" "$BASELINE_FILE")

    if [ -z "$recent_baselines" ]; then
        log_warning "No recent baselines found for $target"
        return 0
    fi

    # Calculate statistics
    local count=$(echo "$recent_baselines" | jq -s '. | length')
    local avg_duration=$(echo "$recent_baselines" | jq -s '[.[] | .duration_seconds] | add / length')
    local min_duration=$(echo "$recent_baselines" | jq -s '[.[] | .duration_seconds] | min')
    local max_duration=$(echo "$recent_baselines" | jq -s '[.[] | .duration_seconds] | max')

    # Trend analysis
    local durations=$(echo "$recent_baselines" | jq -r '.duration_seconds' | sort -n)
    local first_duration=$(echo "$durations" | head -1)
    local last_duration=$(echo "$durations" | tail -1)
    local trend="stable"

    if (( $(echo "$last_duration > $first_duration * 1.1" | bc -l) )); then
        trend="degrading"
    elif (( $(echo "$last_duration < $first_duration * 0.9" | bc -l) )); then
        trend="improving"
    fi

    log_info "Performance trend analysis for $target:"
    log_info "  Samples: $count"
    log_info "  Average duration: ${avg_duration}s"
    log_info "  Min duration: ${min_duration}s"
    log_info "  Max duration: ${max_duration}s"
    log_info "  Trend: $trend"

    # Generate trend report
    local trend_file="/tmp/performance-trend-${target}-$(date +%s).json"

    cat > "$trend_file" <<EOF
{
    "target": "$target",
    "analysis_period_days": $days,
    "generated_at": $(date +%s),
    "statistics": {
        "sample_count": $count,
        "average_duration": $avg_duration,
        "min_duration": $min_duration,
        "max_duration": $max_duration,
        "trend": "$trend"
    },
    "baselines": $recent_baselines
}
EOF

    log_success "Trend report generated: $trend_file"
    echo "$trend_file"
}

# Optimize build recommendations
generate_recommendations() {
    local target="$1"

    log_info "Generating build optimization recommendations for $target"

    if [ ! -f "$BASELINE_FILE" ]; then
        log_error "No baseline file found"
        return 1
    fi

    # Get latest baseline
    local latest_baseline=$(jq -r ".baselines[] | select(.target == \"$target\") | .metrics" "$BASELINE_FILE" | tail -1)

    if [ -z "$latest_baseline" ] || [ "$latest_baseline" = "null" ]; then
        log_warning "No baseline found for $target"
        return 0
    fi

    local recommendations='{"target": "'$target'", "recommendations": []}'

    # Check CPU usage
    local cpu_usage=$(echo "$latest_baseline" | jq -r '.system.cpu_usage')
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        recommendations=$(echo "$recommendations" | jq '.recommendations += ["High CPU usage detected. Consider reducing parallel builds or upgrading CPU."]')
    fi

    # Check memory usage
    local memory_usage=$(echo "$latest_baseline" | jq -r '.system.memory_usage')
    if (( $(echo "$memory_usage > 85" | bc -l) )); then
        recommendations=$(echo "$recommendations" | jq '.recommendations += ["High memory usage detected. Consider increasing RAM or optimizing build process."]')
    fi

    # Check disk usage
    local disk_usage=$(echo "$latest_baseline" | jq -r '.system.disk_usage')
    if [ "$disk_usage" -gt 90 ]; then
        recommendations=$(echo "$recommendations" | jq '.recommendations += ["Low disk space detected. Clean up build artifacts and consider disk expansion."]')
    fi

    # Check Docker cache
    local cache_size=$(echo "$latest_baseline" | jq -r '.docker.cache_size')
    if [[ "$cache_size" =~ GB$ ]]; then
        local cache_gb=$(echo "$cache_size" | sed 's/GB//')
        if (( $(echo "$cache_gb > 10" | bc -l) )); then
            recommendations=$(echo "$recommendations" | jq '.recommendations += ["Large Docker cache detected. Consider periodic cache cleanup."]')
        fi
    fi

    # Save recommendations
    local recommendations_file="/tmp/build-recommendations-${target}-$(date +%s).json"
    echo "$recommendations" > "$recommendations_file"

    # Display recommendations
    local rec_count=$(echo "$recommendations" | jq '.recommendations | length')
    log_info "Generated $rec_count recommendations for $target:"

    for i in $(seq 0 $((rec_count - 1))); do
        local rec=$(echo "$recommendations" | jq -r ".recommendations[$i]")
        log_info "  • $rec"
    done

    log_success "Recommendations saved to: $recommendations_file"
    echo "$recommendations_file"
}

# Export baselines for analysis
export_baselines() {
    local output_file="${1:-baselines-export-$(date +%Y%m%d-%H%M%S).json}"

    log_info "Exporting performance baselines to: $output_file"

    if [ ! -f "$BASELINE_FILE" ]; then
        log_error "No baseline file found"
        return 1
    fi

    # Add export metadata
    local export_data=$(cat "$BASELINE_FILE" | jq ". + {\"exported_at\": $(date +%s), \"export_version\": \"1.0\"}")

    echo "$export_data" > "$output_file"
    log_success "Baselines exported to: $output_file"
}

# Main execution
main() {
    local command="${1:-help}"

    case "$command" in
        "create")
            if [ $# -lt 4 ]; then
                log_error "Usage: $0 create <target> <duration> <image_size> [build_id]"
                exit 1
            fi
            create_baseline "$2" "$3" "$4" "${5:-$(date +%s)}"
            ;;
        "compare")
            if [ $# -lt 4 ]; then
                log_error "Usage: $0 compare <target> <duration> <image_size>"
                exit 1
            fi
            compare_to_baseline "$2" "$3" "$4"
            ;;
        "trend")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 trend <target> [days]"
                exit 1
            fi
            analyze_trends "$2" "${3:-7}"
            ;;
        "recommend")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 recommend <target>"
                exit 1
            fi
            generate_recommendations "$2"
            ;;
        "export")
            export_baselines "$2"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  create <target> <duration> <size> [id]  Create performance baseline"
            echo "  compare <target> <duration> <size>        Compare to baseline"
            echo "  trend <target> [days]                     Analyze performance trends"
            echo "  recommend <target>                        Generate optimization recommendations"
            echo "  export [output]                           Export baselines"
            echo ""
            echo "Environment variables:"
            echo "  BASELINE_FILE             Baseline file path"
            echo "  METRICS_RETENTION_DAYS    Metrics retention period (default: 30)"
            echo "  PERFORMANCE_THRESHOLD     Performance variance threshold (default: 20)"
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
