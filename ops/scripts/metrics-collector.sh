#!/usr/bin/env bash

# Build Metrics Collector for ValueOS
# Collects and reports build metrics to monitoring systems

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Metrics configuration
METRICS_FILE="$PROJECT_ROOT/ops/metrics/build-metrics.json"
PROMETHEUS_GATEWAY="${PROMETHEUS_GATEWAY:-http://localhost:9091}"
DATADOG_API_KEY="${DATADOG_API_KEY:-}"

# Initialize metrics
init_metrics() {
    local build_id="$1"
    local target="$2"

    cat > "$METRICS_FILE" <<EOF
{
  "build_id": "$build_id",
  "target": "$target",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "start_time": "$(date -u +%s)",
  "status": "running",
  "stages": {
    "load_digests": {"start": null, "end": null, "duration": null},
    "build": {"start": null, "end": null, "duration": null},
    "security_scan": {"start": null, "end": null, "duration": null},
    "sign": {"start": null, "end": null, "duration": null},
    "push": {"start": null, "end": null, "duration": null}
  },
  "metrics": {
    "image_size_bytes": null,
    "layer_count": null,
    "vulnerabilities": {"critical": 0, "high": 0, "medium": 0, "low": 0},
    "sbom_components": null,
    "cache_hit_rate": null
  }
}
EOF

    log_success "Metrics initialized for build $build_id"
}

# Record stage start
record_stage_start() {
    local stage="$1"
    local timestamp="$(date -u +%s)"

    # Update metrics file
    if [ -f "$METRICS_FILE" ]; then
        jq ".stages.$stage.start = $timestamp" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"
    fi
}

# Record stage end
record_stage_end() {
    local stage="$1"
    local timestamp="$(date -u +%s)"

    # Update metrics file
    if [ -f "$METRICS_FILE" ]; then
        jq ".stages.$stage.end = $timestamp | .stages.$stage.duration = (.stages.$stage.end - .stages.$stage.start)" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"
    fi
}

# Record image metrics
record_image_metrics() {
    local image_ref="$1"

    if docker image inspect "$image_ref" > /dev/null 2>&1; then
        local size_bytes=$(docker image inspect --format='{{.Size}}' "$image_ref")
        local layer_count=$(docker image inspect --format='{{len .RootFS.Layers}}' "$image_ref")

        jq ".metrics.image_size_bytes = $size_bytes | .metrics.layer_count = $layer_count" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"

        log_success "Image metrics recorded: ${size_bytes} bytes, ${layer_count} layers"
    fi
}

# Record vulnerability metrics
record_vulnerability_metrics() {
    local scan_file="$1"

    if [ -f "$scan_file" ]; then
        local critical=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .Severity' "$scan_file" | wc -l || echo 0)
        local high=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | .Severity' "$scan_file" | wc -l || echo 0)
        local medium=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM") | .Severity' "$scan_file" | wc -l || echo 0)
        local low=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW") | .Severity' "$scan_file" | wc -l || echo 0)

        jq ".metrics.vulnerabilities = {\"critical\": $critical, \"high\": $high, \"medium\": $medium, \"low\": $low}" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"

        log_success "Vulnerability metrics recorded: C:$critical H:$high M:$medium L:$low"
    fi
}

# Record SBOM metrics
record_sbom_metrics() {
    local sbom_file="$1"

    if [ -f "$sbom_file" ]; then
        local component_count=$(jq -r '.components | length' "$sbom_file" 2>/dev/null || echo 0)

        jq ".metrics.sbom_components = $component_count" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"

        log_success "SBOM metrics recorded: $component_count components"
    fi
}

# Finalize metrics
finalize_metrics() {
    local status="$1"
    local end_time="$(date -u +%s)"
    local total_duration=$((end_time - $(jq -r '.start_time' "$METRICS_FILE")))

    jq ".status = \"$status\" | .end_time = $end_time | .total_duration = $total_duration" "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"

    log_success "Build metrics finalized: $status (${total_duration}s total)"
}

# Send to Prometheus Gateway
send_to_prometheus() {
    if [ -z "$PROMETHEUS_GATEWAY" ]; then
        log_warning "Prometheus gateway not configured"
        return 0
    fi

    local build_id=$(jq -r '.build_id' "$METRICS_FILE")
    local target=$(jq -r '.target' "$METRICS_FILE")
    local status=$(jq -r '.status' "$METRICS_FILE")
    local duration=$(jq -r '.total_duration' "$METRICS_FILE")
    local image_size=$(jq -r '.metrics.image_size_bytes // 0' "$METRICS_FILE")
    local vuln_critical=$(jq -r '.metrics.vulnerabilities.critical // 0' "$METRICS_FILE")
    local vuln_high=$(jq -r '.metrics.vulnerabilities.high // 0' "$METRICS_FILE")

    # Create Prometheus metrics
    local metrics_data="
# HELP valueos_build_duration_seconds Total build duration in seconds
# TYPE valueos_build_duration_seconds histogram
valueos_build_duration_seconds{build_id=\"$build_id\",target=\"$target\",status=\"$status\"} $duration

# HELP valueos_build_image_size_bytes Final image size in bytes
# TYPE valueos_build_image_size_bytes gauge
valueos_build_image_size_bytes{build_id=\"$build_id\",target=\"$target\"} $image_size

# HELP valueos_build_vulnerabilities_count Number of vulnerabilities by severity
# TYPE valueos_build_vulnerabilities_count gauge
valueos_build_vulnerabilities_count{build_id=\"$build_id\",target=\"$target\",severity=\"critical\"} $vuln_critical
valueos_build_vulnerabilities_count{build_id=\"$build_id\",target=\"$target\",severity=\"high\"} $vuln_high
"

    # Send to Prometheus Gateway
    if curl -X POST "$PROMETHEUS_GATEWAY/metrics/job/valueos-build" --data-binary "$metrics_data" > /dev/null 2>&1; then
        log_success "Metrics sent to Prometheus Gateway"
    else
        log_warning "Failed to send metrics to Prometheus Gateway"
    fi
}

# Send to Datadog
send_to_datadog() {
    if [ -z "$DATADOG_API_KEY" ]; then
        log_warning "Datadog API key not configured"
        return 0
    fi

    local build_id=$(jq -r '.build_id' "$METRICS_FILE")
    local target=$(jq -r '.target' "$METRICS_FILE")
    local status=$(jq -r '.status' "$METRICS_FILE")
    local duration=$(jq -r '.total_duration' "$METRICS_FILE")
    local image_size=$(jq -r '.metrics.image_size_bytes // 0' "$METRICS_FILE")

    local timestamp="$(date +%s)"

    # Create Datadog metrics payload
    local payload=$(cat <<EOF
{
  "series": [
    {
      "metric": "valueos.build.duration",
      "points": [[$timestamp, $duration]],
      "tags": ["build_id:$build_id", "target:$target", "status:$status"]
    },
    {
      "metric": "valueos.build.image_size",
      "points": [[$timestamp, $image_size]],
      "tags": ["build_id:$build_id", "target:$target"]
    }
  ]
}
EOF
)

    # Send to Datadog
    if curl -X POST "https://api.datadoghq.com/api/v1/series" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "$payload" > /dev/null 2>&1; then
        log_success "Metrics sent to Datadog"
    else
        log_warning "Failed to send metrics to Datadog"
    fi
}

# Main execution
main() {
    local action="$1"
    local build_id="${2:-$(date +%s)}"
    local target="${3:-unknown}"

    case "$action" in
        init)
            init_metrics "$build_id" "$target"
            ;;
        stage_start)
            record_stage_start "$3"
            ;;
        stage_end)
            record_stage_end "$3"
            ;;
        image_metrics)
            record_image_metrics "$3"
            ;;
        vuln_metrics)
            record_vulnerability_metrics "$3"
            ;;
        sbom_metrics)
            record_sbom_metrics "$3"
            ;;
        finalize)
            finalize_metrics "$3"
            send_to_prometheus
            send_to_datadog
            ;;
        *)
            echo "Usage: $0 <init|stage_start|stage_end|image_metrics|vuln_metrics|sbom_metrics|finalize> [build_id] [target|stage|file]"
            exit 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
