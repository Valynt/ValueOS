#!/bin/bash

# Performance Regression Testing Script
# Runs performance tests and compares against baselines

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://backend-service.valuecanvas.svc.cluster.local:8000}"
BASELINES_DIR="${BASELINES_DIR:-tests/baselines}"
RESULTS_DIR="${RESULTS_DIR:-test-results}"
REGRESSION_THRESHOLD="${REGRESSION_THRESHOLD:-10}"  # 10% degradation threshold

# Performance metrics
CURRENT_METRICS=""
BASELINE_METRICS=""

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

log_perf() {
    echo -e "${PURPLE}⚡ $1${NC}"
}

# Setup directories
setup_directories() {
    mkdir -p "$BASELINES_DIR"
    mkdir -p "$RESULTS_DIR"
}

# Run HTTP load test
run_load_test() {
    local endpoint="$1"
    local duration="${2:-30}"
    local concurrency="${3:-10}"

    log_perf "Running load test on $endpoint"
    log_info "Duration: ${duration}s, Concurrency: $concurrency"

    # Use hey for load testing (install if needed)
    if ! command -v hey &> /dev/null; then
        log_warning "hey not found, installing..."
        curl -L https://hey-release.s3.us-east-1.amazonaws.com/hey_linux_amd64 -o hey
        chmod +x hey
        sudo mv hey /usr/local/bin/
    fi

    # Run load test and capture output
    local results_file="$RESULTS_DIR/load-test-$(date +%s).txt"
    hey -z "${duration}s" -c "$concurrency" -m GET "$API_BASE_URL$endpoint" > "$results_file"

    echo "$results_file"
}

# Parse hey results
parse_load_test_results() {
    local results_file="$1"

    # Extract key metrics from hey output
    local total_requests=$(grep "requests" "$results_file" | awk '{print $2}' | tr -d ',')
    local response_time_avg=$(grep "Average" "$results_file" | head -1 | awk '{print $2}' | sed 's/ms//')
    local response_time_95p=$(grep "95%" "$results_file" | awk '{print $2}' | sed 's/ms//')
    local response_time_99p=$(grep "99%" "$results_file" | awk '{print $2}' | sed 's/ms//')
    local requests_per_sec=$(grep "requests/sec" "$results_file" | awk '{print $1}')

    # Return as JSON
    cat << EOF
{
  "total_requests": $total_requests,
  "response_time_avg_ms": $response_time_avg,
  "response_time_95p_ms": $response_time_95p,
  "response_time_99p_ms": $response_time_99p,
  "requests_per_sec": $requests_per_sec
}
EOF
}

# Run performance tests
run_performance_tests() {
    log_perf "Running performance test suite..."

    # Test health endpoint
    log_info "Testing health endpoint performance..."
    local health_results=$(run_load_test "/health" 30 20)
    local health_metrics=$(parse_load_test_results "$health_results")

    # Test API endpoints
    log_info "Testing API endpoint performance..."
    local api_results=$(run_load_test "/api/v1/agents" 30 15)
    local api_metrics=$(parse_load_test_results "$api_results")

    # Combine results
    CURRENT_METRICS=$(cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "health_endpoint": $health_metrics,
  "api_endpoint": $api_metrics
}
EOF
)

    echo "$CURRENT_METRICS" > "$RESULTS_DIR/current-performance-metrics.json"
    log_success "Performance tests completed"
}

# Load baseline metrics
load_baseline() {
    local baseline_file="$BASELINES_DIR/performance-baseline.json"

    if [ -f "$baseline_file" ]; then
        BASELINE_METRICS=$(cat "$baseline_file")
        log_info "Loaded baseline metrics from $baseline_file"
        return 0
    else
        log_warning "No baseline metrics found at $baseline_file"
        return 1
    fi
}

# Save current metrics as baseline
save_baseline() {
    local baseline_file="$BASELINES_DIR/performance-baseline.json"

    echo "$CURRENT_METRICS" > "$baseline_file"
    log_success "Saved current metrics as new baseline: $baseline_file"
}

# Compare metrics
compare_metrics() {
    local current="$1"
    local baseline="$2"
    local threshold="$3"

    log_perf "Comparing current performance against baseline..."

    # Extract key metrics for comparison
    local current_rps=$(echo "$current" | jq -r '.health_endpoint.requests_per_sec')
    local baseline_rps=$(echo "$baseline" | jq -r '.health_endpoint.requests_per_sec')

    local current_avg=$(echo "$current" | jq -r '.health_endpoint.response_time_avg_ms')
    local baseline_avg=$(echo "$baseline" | jq -r '.health_endpoint.response_time_avg_ms')

    local current_95p=$(echo "$current" | jq -r '.health_endpoint.response_time_95p_ms')
    local baseline_95p=$(echo "$baseline" | jq -r '.health_endpoint.response_time_95p_ms')

    # Calculate percentage changes
    local rps_change=$(awk "BEGIN {printf \"%.2f\", (($current_rps - $baseline_rps) / $baseline_rps) * 100}")
    local avg_change=$(awk "BEGIN {printf \"%.2f\", (($current_avg - $baseline_avg) / $baseline_avg) * 100}")
    local p95_change=$(awk "BEGIN {printf \"%.2f\", (($current_95p - $baseline_95p) / $baseline_95p) * 100}")

    # Display comparison
    echo ""
    log_perf "Performance Comparison Results:"
    echo "┌─────────────────┬──────────────┬──────────────┬─────────────┐"
    echo "│ Metric         │ Baseline     │ Current      │ Change %    │"
    echo "├─────────────────┼──────────────┼──────────────┼─────────────┤"
    printf "│ Requests/sec   │ %-12s │ %-12s │ %-10s │\n" "$baseline_rps" "$current_rps" "${rps_change}%"
    printf "│ Avg Response   │ %-12s │ %-12s │ %-10s │\n" "${baseline_avg}ms" "${current_avg}ms" "${avg_change}%"
    printf "│ 95p Response   │ %-12s │ %-12s │ %-10s │\n" "${baseline_95p}ms" "${current_95p}ms" "${p95_change}%"
    echo "└─────────────────┴──────────────┴──────────────┴─────────────┘"
    echo ""

    # Check for regressions
    local regression_detected=false

    if awk "BEGIN {exit !($rps_change < -$threshold)}"; then
        log_error "🚨 REGRESSION: Requests/sec decreased by ${rps_change}% (threshold: -${threshold}%)"
        regression_detected=true
    fi

    if awk "BEGIN {exit !($avg_change > $threshold)}"; then
        log_error "🚨 REGRESSION: Average response time increased by ${avg_change}% (threshold: ${threshold}%)"
        regression_detected=true
    fi

    if awk "BEGIN {exit !($p95_change > $threshold)}"; then
        log_error "🚨 REGRESSION: 95th percentile response time increased by ${p95_change}% (threshold: ${threshold}%)"
        regression_detected=true
    fi

    # Show improvements
    if awk "BEGIN {exit !($rps_change > $threshold)}"; then
        log_success "🚀 IMPROVEMENT: Requests/sec increased by ${rps_change}%"
    fi

    if awk "BEGIN {exit !($avg_change < -$threshold)}"; then
        log_success "🚀 IMPROVEMENT: Average response time decreased by ${avg_change}%"
    fi

    if awk "BEGIN {exit !($p95_change < -$threshold)}"; then
        log_success "🚀 IMPROVEMENT: 95th percentile response time decreased by ${p95_change}%"
    fi

    if [ "$regression_detected" = false ]; then
        log_success "✅ No performance regressions detected (threshold: ±${threshold}%)"
        return 0
    else
        log_error "💥 Performance regressions detected!"
        return 1
    fi
}

# Generate performance report
generate_performance_report() {
    local regression_detected="$1"
    local report_file="$RESULTS_DIR/performance-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "regression_detected": $regression_detected,
  "regression_threshold_percent": $REGRESSION_THRESHOLD,
  "current_metrics": $CURRENT_METRICS,
  "baseline_metrics": $BASELINE_METRICS,
  "configuration": {
    "api_base_url": "$API_BASE_URL",
    "baselines_dir": "$BASELINES_DIR",
    "results_dir": "$RESULTS_DIR"
  }
}
EOF

    log_info "Performance report saved to: $report_file"
}

# Main performance testing function
run_performance_regression_test() {
    log_perf "🧪 Starting Performance Regression Testing"
    log_info "Configuration:"
    log_info "  API Base URL: $API_BASE_URL"
    log_info "  Regression Threshold: ±${REGRESSION_THRESHOLD}%"
    log_info "  Baselines Directory: $BASELINES_DIR"
    log_info "  Results Directory: $RESULTS_DIR"

    local start_time=$(date +%s)

    # Setup
    setup_directories

    # Run performance tests
    run_performance_tests

    # Load baseline
    if ! load_baseline; then
        log_warning "No baseline found. Run with --baseline to create initial baseline."
        return 0
    fi

    # Compare against baseline
    local regression_detected=false
    if ! compare_metrics "$CURRENT_METRICS" "$BASELINE_METRICS" "$REGRESSION_THRESHOLD"; then
        regression_detected=true
    fi

    # Generate report
    generate_performance_report "$regression_detected"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    if [ "$regression_detected" = false ]; then
        log_success "🎉 Performance regression test passed! (${duration}s)"
        return 0
    else
        log_error "💥 Performance regression test failed! (${duration}s)"
        return 1
    fi
}

# Main execution
main() {
    local command="${1:-test}"

    case "$command" in
        test)
            run_performance_regression_test
            ;;
        baseline)
            log_info "Creating new performance baseline..."
            setup_directories
            run_performance_tests
            save_baseline
            ;;
        compare)
            if [ $# -lt 3 ]; then
                echo "Usage: $0 compare <current_metrics_file> <baseline_metrics_file>"
                exit 1
            fi
            local current_file="$2"
            local baseline_file="$3"
            if [ ! -f "$current_file" ] || [ ! -f "$baseline_file" ]; then
                log_error "Metrics files not found"
                exit 1
            fi
            CURRENT_METRICS=$(cat "$current_file")
            BASELINE_METRICS=$(cat "$baseline_file")
            compare_metrics "$CURRENT_METRICS" "$BASELINE_METRICS" "$REGRESSION_THRESHOLD"
            ;;
        *)
            echo "Usage: $0 [test|baseline|compare]"
            echo "Commands:"
            echo "  test     - Run performance regression test (default)"
            echo "  baseline - Create new performance baseline"
            echo "  compare  - Compare two metrics files"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
