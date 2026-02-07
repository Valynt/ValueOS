#!/usr/bin/env bash

# Build metrics collector for ValueOS CI/CD pipeline
# Exposes Prometheus metrics for build performance and deployment status

set -euo pipefail

# Metrics configuration
METRICS_FILE="${METRICS_FILE:-/tmp/build-metrics.prom}"
METRICS_PORT="${METRICS_PORT:-9090}"

# Initialize metrics file
init_metrics() {
    cat > "$METRICS_FILE" <<EOF
# HELP valueos_build_duration_seconds Time spent building images
# TYPE valueos_build_duration_seconds gauge
# HELP valueos_build_success_total Total successful builds
# TYPE valueos_build_success_total counter
# HELP valueos_build_failure_total Total failed builds
# HELP valueos_build_failure_total counter
# HELP valueos_build_last_success_timestamp Unix timestamp of last successful build
# TYPE valueos_build_last_success_timestamp gauge
# HELP valueos_build_last_failure_timestamp Unix timestamp of last failed build
# TYPE valueos_build_last_failure_timestamp gauge
# HELP valueos_deployment_duration_seconds Time spent deploying to environments
# TYPE valueos_deployment_duration_seconds gauge
# HELP valueos_deployment_success_total Total successful deployments
# TYPE valueos_deployment_success_total counter
# HELP valueos_deployment_failure_total Total failed deployments
# TYPE valueos_deployment_failure_total counter
# HELP valueos_vulnerability_count_total Number of vulnerabilities found
# TYPE valueos_vulnerability_count_total gauge
# HELP valueos_image_size_bytes Size of built images in bytes
# TYPE valueos_image_size_bytes gauge
EOF
}

# Record build start
record_build_start() {
    local build_id="$1"
    local target="$2"
    local timestamp=$(date +%s)

    echo "valueos_build_start_timestamp{build_id=\"$build_id\",target=\"$target\"} $timestamp" >> "$METRICS_FILE"
}

# Record build completion
record_build_end() {
    local build_id="$1"
    local target="$2"
    local status="$3"
    local duration="$4"
    local timestamp=$(date +%s)

    # Record duration
    echo "valueos_build_duration_seconds{build_id=\"$build_id\",target=\"$target\",status=\"$status\"} $duration" >> "$METRICS_FILE"

    # Record success/failure
    if [ "$status" = "success" ]; then
        echo "valueos_build_success_total{target=\"$target\"} 1" >> "$METRICS_FILE"
        echo "valueos_build_last_success_timestamp{target=\"$target\"} $timestamp" >> "$METRICS_FILE"
    else
        echo "valueos_build_failure_total{target=\"$target\"} 1" >> "$METRICS_FILE"
        echo "valueos_build_last_failure_timestamp{target=\"$target\"} $timestamp" >> "$METRICS_FILE"
    fi
}

# Record deployment metrics
record_deployment() {
    local environment="$1"
    local status="$2"
    local duration="$3"
    local timestamp=$(date +%s)

    echo "valueos_deployment_duration_seconds{environment=\"$environment\",status=\"$status\"} $duration" >> "$METRICS_FILE"

    if [ "$status" = "success" ]; then
        echo "valueos_deployment_success_total{environment=\"$environment\"} 1" >> "$METRICS_FILE"
    else
        echo "valueos_deployment_failure_total{environment=\"$environment\"} 1" >> "$METRICS_FILE"
    fi
}

# Record vulnerability scan results
record_vulnerabilities() {
    local image="$1"
    local critical="$2"
    local high="$3"
    local medium="$4"
    local low="$5"

    echo "valueos_vulnerability_count_total{image=\"$image\",severity=\"critical\"} $critical" >> "$METRICS_FILE"
    echo "valueos_vulnerability_count_total{image=\"$image\",severity=\"high\"} $high" >> "$METRICS_FILE"
    echo "valueos_vulnerability_count_total{image=\"$image\",severity=\"medium\"} $medium" >> "$METRICS_FILE"
    echo "valueos_vulnerability_count_total{image=\"$image\",severity=\"low\"} $low" >> "$METRICS_FILE"
}

# Record image size
record_image_size() {
    local image="$1"
    local size="$2"

    echo "valueos_image_size_bytes{image=\"$image\"} $size" >> "$METRICS_FILE"
}

# Extract vulnerability counts from Trivy report
extract_vulnerabilities() {
    local trivy_report="$1"
    local image="$2"

    if [ ! -f "$trivy_report" ]; then
        echo "Trivy report not found: $trivy_report"
        return 1
    fi

    # Count vulnerabilities by severity
    local critical=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' "$trivy_report" | wc -l || echo "0")
    local high=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | .VulnerabilityID' "$trivy_report" | wc -l || echo "0")
    local medium=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM") | .VulnerabilityID' "$trivy_report" | wc -l || echo "0")
    local low=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW") | .VulnerabilityID' "$trivy_report" | wc -l || echo "0")

    record_vulnerabilities "$image" "$critical" "$high" "$medium" "$low"
}

# Get image size from Docker
get_image_size() {
    local image="$1"

    local size=$(docker images --format "{{.Size}}" "$image" | head -1)
    # Convert size string to bytes (e.g., "1.2GB" -> 1200000000)
    if [[ "$size" =~ GB$ ]]; then
        local gb_size=${size%GB}
        echo "${gb_size}000000000" | bc
    elif [[ "$size" =~ MB$ ]]; then
        local mb_size=${size%MB}
        echo "${mb_size}000000" | bc
    elif [[ "$size" =~ kB$ ]]; then
        local kb_size=${size%kB}
        echo "${kb_size}000" | bc
    else
        echo "0"
    fi
}

# Start metrics server
start_metrics_server() {
    local port="${1:-$METRICS_PORT}"

    # Simple HTTP server using Python
    cat > /tmp/metrics-server.py <<EOF
import http.server
import socketserver
import os

class MetricsHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            try:
                with open('$METRICS_FILE', 'r') as f:
                    self.wfile.write(f.read().encode())
            except FileNotFoundError:
                self.wfile.write(b'# Metrics file not found\n')
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", $port), MetricsHandler) as httpd:
    print(f"Metrics server started on port $port")
    httpd.serve_forever()
EOF

    python3 /tmp/metrics-server.py &
    echo $! > /tmp/metrics-server.pid
    echo "Metrics server started on port $port"
}

# Stop metrics server
stop_metrics_server() {
    if [ -f /tmp/metrics-server.pid ]; then
        local pid=$(cat /tmp/metrics-server.pid)
        kill "$pid" 2>/dev/null || true
        rm -f /tmp/metrics-server.pid
        echo "Metrics server stopped"
    fi
}

# Generate Grafana dashboard JSON
generate_grafana_dashboard() {
    local output_file="${1:-grafana-dashboard.json}"

    cat > "$output_file" <<EOF
{
  "dashboard": {
    "id": null,
    "title": "ValueOS Build & Deployment Metrics",
    "tags": ["valueos", "build", "deployment"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Build Duration",
        "type": "stat",
        "targets": [
          {
            "expr": "valueos_build_duration_seconds",
            "legendFormat": "{{target}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 300},
                {"color": "red", "value": 600}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Build Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "valueos_build_success_total / (valueos_build_success_total + valueos_build_failure_total) * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 90},
                {"color": "yellow", "value": 95},
                {"color": "green", "value": 98}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Vulnerability Counts",
        "type": "graph",
        "targets": [
          {
            "expr": "valueos_vulnerability_count_total",
            "legendFormat": "{{image}}-{{severity}}"
          }
        ],
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Deployment Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "valueos_deployment_duration_seconds",
            "legendFormat": "{{environment}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      },
      {
        "id": 5,
        "title": "Image Sizes",
        "type": "graph",
        "targets": [
          {
            "expr": "valueos_image_size_bytes",
            "legendFormat": "{{image}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16}
      }
    ],
    "time": {"from": "now-24h", "to": "now"},
    "refresh": "5s"
  }
}
EOF

    echo "Grafana dashboard generated: $output_file"
}

# Main execution
main() {
    local command="${1:-help}"

    case "$command" in
        "init")
            init_metrics
            ;;
        "build-start")
            record_build_start "$2" "$3"
            ;;
        "build-end")
            record_build_end "$2" "$3" "$4" "$5"
            ;;
        "deployment")
            record_deployment "$2" "$3" "$4"
            ;;
        "vulnerabilities")
            extract_vulnerabilities "$2" "$3"
            ;;
        "image-size")
            local size=$(get_image_size "$2")
            record_image_size "$2" "$size"
            ;;
        "server-start")
            start_metrics_server "$2"
            ;;
        "server-stop")
            stop_metrics_server
            ;;
        "grafana")
            generate_grafana_dashboard "$2"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  init                    Initialize metrics file"
            echo "  build-start <id> <target>    Record build start"
            echo "  build-end <id> <target> <status> <duration>  Record build completion"
            echo "  deployment <env> <status> <duration>    Record deployment"
            echo "  vulnerabilities <report> <image>    Extract vulnerability counts"
            echo "  image-size <image>      Record image size"
            echo "  server-start [port]     Start metrics server"
            echo "  server-stop             Stop metrics server"
            echo "  grafana [output]        Generate Grafana dashboard"
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
