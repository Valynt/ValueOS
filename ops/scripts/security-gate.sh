#!/usr/bin/env bash

# Security Gate Script for ValueOS
# Implements vulnerability thresholds and automated security gates

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}🛡️  $1${NC}"
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

# Security thresholds (can be overridden by environment)
CRITICAL_THRESHOLD=${CRITICAL_THRESHOLD:-0}
HIGH_THRESHOLD=${HIGH_THRESHOLD:-5}
MEDIUM_THRESHOLD=${MEDIUM_THRESHOLD:-20}
LOW_THRESHOLD=${LOW_THRESHOLD:-50}

# Show usage
show_usage() {
    echo "Usage: $0 <scan_file> [options]"
    echo ""
    echo "Arguments:"
    echo "  scan_file    - Trivy scan results JSON file"
    echo ""
    echo "Options:"
    echo "  --critical N  - Max critical vulnerabilities (default: 0)"
    echo "  --high N      - Max high vulnerabilities (default: 5)"
    echo "  --medium N    - Max medium vulnerabilities (default: 20)"
    echo "  --low N       - Max low vulnerabilities (default: 50)"
    echo "  --output FILE - Save gate results to file"
    echo "  --fail-open   - Don't fail build on threshold breach"
    echo ""
    echo "Environment Variables:"
    echo "  CRITICAL_THRESHOLD, HIGH_THRESHOLD, MEDIUM_THRESHOLD, LOW_THRESHOLD"
    echo ""
    echo "Examples:"
    echo "  $0 trivy-results.json"
    echo "  $0 trivy-results.json --critical 0 --high 2 --output gate-results.json"
}

# Parse vulnerability counts from Trivy JSON
parse_vulnerabilities() {
    local scan_file="$1"

    if [ ! -f "$scan_file" ]; then
        log_error "Scan file not found: $scan_file"
        return 1
    fi

    # Count vulnerabilities by severity
    local critical=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .Severity' "$scan_file" | wc -l || echo 0)
    local high=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | .Severity' "$scan_file" | wc -l || echo 0)
    local medium=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM") | .Severity' "$scan_file" | wc -l || echo 0)
    local low=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW") | .Severity' "$scan_file" | wc -l || echo 0)
    local total=$((critical + high + medium + low))

    echo "$critical $high $medium $low $total"
}

# Check thresholds
check_thresholds() {
    local critical=$1
    local high=$2
    local medium=$3
    local low=$4
    local fail_open=${5:-false}

    local gate_passed=true
    local reasons=()

    # Check critical vulnerabilities
    if [ "$critical" -gt "$CRITICAL_THRESHOLD" ]; then
        gate_passed=false
        reasons+=("Critical vulnerabilities ($critical) exceed threshold ($CRITICAL_THRESHOLD)")
    fi

    # Check high vulnerabilities
    if [ "$high" -gt "$HIGH_THRESHOLD" ]; then
        gate_passed=false
        reasons+=("High vulnerabilities ($high) exceed threshold ($HIGH_THRESHOLD)")
    fi

    # Check medium vulnerabilities
    if [ "$medium" -gt "$MEDIUM_THRESHOLD" ]; then
        gate_passed=false
        reasons+=("Medium vulnerabilities ($medium) exceed threshold ($MEDIUM_THRESHOLD)")
    fi

    # Check low vulnerabilities
    if [ "$low" -gt "$LOW_THRESHOLD" ]; then
        gate_passed=false
        reasons+=("Low vulnerabilities ($low) exceed threshold ($LOW_THRESHOLD)")
    fi

    # Output results
    if [ "$gate_passed" = true ]; then
        log_success "Security gate PASSED"
        echo "✅ All vulnerability thresholds satisfied:"
        echo "   Critical: $critical (threshold: $CRITICAL_THRESHOLD)"
        echo "   High: $high (threshold: $HIGH_THRESHOLD)"
        echo "   Medium: $medium (threshold: $MEDIUM_THRESHOLD)"
        echo "   Low: $low (threshold: $LOW_THRESHOLD)"
        return 0
    else
        log_error "Security gate FAILED"
        echo "❌ Threshold breaches detected:"
        for reason in "${reasons[@]}"; do
            echo "   - $reason"
        done
        echo ""
        echo "Current counts:"
        echo "   Critical: $critical (threshold: $CRITICAL_THRESHOLD)"
        echo "   High: $high (threshold: $HIGH_THRESHOLD)"
        echo "   Medium: $medium (threshold: $MEDIUM_THRESHOLD)"
        echo "   Low: $low (threshold: $LOW_THRESHOLD)"

        if [ "$fail_open" = true ]; then
            log_warning "Fail-open mode: continuing despite gate failure"
            return 0
        else
            return 1
        fi
    fi
}

# Generate security gate report
generate_report() {
    local critical=$1
    local high=$2
    local medium=$3
    local low=$4
    local total=$5
    local gate_result=$6
    local output_file="$7"

    local report=$(cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scan_results": {
    "critical": $critical,
    "high": $high,
    "medium": $medium,
    "low": $low,
    "total": $total
  },
  "thresholds": {
    "critical": $CRITICAL_THRESHOLD,
    "high": $HIGH_THRESHOLD,
    "medium": $MEDIUM_THRESHOLD,
    "low": $LOW_THRESHOLD
  },
  "gate_result": "$gate_result",
  "breaches": [
EOF
)

    # Add breaches if any
    local breaches=()
    if [ "$critical" -gt "$CRITICAL_THRESHOLD" ]; then
        breaches+=("{\"severity\": \"critical\", \"count\": $critical, \"threshold\": $CRITICAL_THRESHOLD}")
    fi
    if [ "$high" -gt "$HIGH_THRESHOLD" ]; then
        breaches+=("{\"severity\": \"high\", \"count\": $high, \"threshold\": $HIGH_THRESHOLD}")
    fi
    if [ "$medium" -gt "$MEDIUM_THRESHOLD" ]; then
        breaches+=("{\"severity\": \"medium\", \"count\": $medium, \"threshold\": $MEDIUM_THRESHOLD}")
    fi
    if [ "$low" -gt "$LOW_THRESHOLD" ]; then
        breaches+=("{\"severity\": \"low\", \"count\": $low, \"threshold\": $LOW_THRESHOLD}")
    fi

    # Add breaches to report
    local breach_items=""
    if [ ${#breaches[@]} -gt 0 ]; then
        for breach in "${breaches[@]}"; do
            if [ -n "$breach_items" ]; then
                breach_items+=","
            fi
            breach_items+="$breach"
        done
    fi

    report+="$breach_items"

    report+="$(cat <<EOF
  ]
}
EOF
)"

    if [ -n "$output_file" ]; then
        echo "$report" > "$output_file"
        log_success "Security gate report saved to: $output_file"
    else
        echo "$report"
    fi
}

# Main execution
main() {
    local scan_file=""
    local output_file=""
    local fail_open=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --critical)
                CRITICAL_THRESHOLD="$2"
                shift 2
                ;;
            --high)
                HIGH_THRESHOLD="$2"
                shift 2
                ;;
            --medium)
                MEDIUM_THRESHOLD="$2"
                shift 2
                ;;
            --low)
                LOW_THRESHOLD="$2"
                shift 2
                ;;
            --output)
                output_file="$2"
                shift 2
                ;;
            --fail-open)
                fail_open=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                if [ -z "$scan_file" ]; then
                    scan_file="$1"
                else
                    log_error "Unknown option: $1"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [ -z "$scan_file" ]; then
        log_error "No scan file specified"
        show_usage
        exit 1
    fi

    log_info "Running security gate with thresholds:"
    echo "  Critical: $CRITICAL_THRESHOLD"
    echo "  High: $HIGH_THRESHOLD"
    echo "  Medium: $MEDIUM_THRESHOLD"
    echo "  Low: $LOW_THRESHOLD"
    echo ""

    # Parse vulnerabilities
    local counts=($(parse_vulnerabilities "$scan_file"))
    local critical=${counts[0]}
    local high=${counts[1]}
    local medium=${counts[2]}
    local low=${counts[3]}
    local total=${counts[4]}

    log_info "Vulnerability summary:"
    echo "  Critical: $critical"
    echo "  High: $high"
    echo "  Medium: $medium"
    echo "  Low: $low"
    echo "  Total: $total"
    echo ""

    # Check thresholds
    local gate_result="passed"
    if ! check_thresholds "$critical" "$high" "$medium" "$low" "$fail_open"; then
        gate_result="failed"
    fi

    # Generate report
    generate_report "$critical" "$high" "$medium" "$low" "$total" "$gate_result" "$output_file"

    # Exit with appropriate code
    if [ "$gate_result" = "passed" ]; then
        exit 0
    else
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
