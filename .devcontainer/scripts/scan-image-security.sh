#!/bin/bash
###############################################################################
# Automated Image Security Scanning
# 
# Scans Docker images for vulnerabilities using Trivy
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCAN_DIR="${SCAN_DIR:-${HOME}/.image-security-scans}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FAIL_ON_CRITICAL=${FAIL_ON_CRITICAL:-true}
FAIL_ON_HIGH=${FAIL_ON_HIGH:-false}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

###############################################################################
# Setup
###############################################################################

setup() {
    mkdir -p "$SCAN_DIR"
    
    # Check if Trivy is installed
    if ! command -v trivy &> /dev/null; then
        log_error "Trivy not found. Installing..."
        install_trivy
    fi
}

install_trivy() {
    log_info "Installing Trivy..."
    
    if command -v curl &> /dev/null; then
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
        log_info "✓ Trivy installed"
    else
        log_error "curl not found, cannot install Trivy"
        exit 1
    fi
}

###############################################################################
# Scan Image
###############################################################################

scan_image() {
    local image=$1
    local output_dir="$SCAN_DIR/scan_${TIMESTAMP}"
    
    mkdir -p "$output_dir"
    
    log_section "Scanning Image: $image"
    
    # Scan for vulnerabilities
    log_info "Scanning for vulnerabilities..."
    
    local json_output="$output_dir/$(echo $image | tr '/:' '_')_vulnerabilities.json"
    local text_output="$output_dir/$(echo $image | tr '/:' '_')_vulnerabilities.txt"
    
    # JSON output
    trivy image \
        --format json \
        --output "$json_output" \
        --severity CRITICAL,HIGH,MEDIUM \
        "$image"
    
    # Human-readable output
    trivy image \
        --format table \
        --severity CRITICAL,HIGH,MEDIUM \
        "$image" | tee "$text_output"
    
    # Count vulnerabilities
    local critical=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$json_output" 2>/dev/null || echo "0")
    local high=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$json_output" 2>/dev/null || echo "0")
    local medium=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="MEDIUM")] | length' "$json_output" 2>/dev/null || echo "0")
    
    log_info "Vulnerabilities found:"
    log_info "  CRITICAL: $critical"
    log_info "  HIGH: $high"
    log_info "  MEDIUM: $medium"
    
    # Check thresholds
    local should_fail=false
    
    if [ "$FAIL_ON_CRITICAL" = "true" ] && [ "$critical" -gt 0 ]; then
        log_error "CRITICAL vulnerabilities found!"
        should_fail=true
    fi
    
    if [ "$FAIL_ON_HIGH" = "true" ] && [ "$high" -gt 0 ]; then
        log_error "HIGH vulnerabilities found!"
        should_fail=true
    fi
    
    # Scan for misconfigurations
    log_info "Scanning for misconfigurations..."
    
    local misconfig_output="$output_dir/$(echo $image | tr '/:' '_')_misconfig.json"
    
    trivy image \
        --format json \
        --output "$misconfig_output" \
        --scanners misconfig \
        "$image" 2>/dev/null || true
    
    # Scan for secrets
    log_info "Scanning for secrets..."
    
    local secrets_output="$output_dir/$(echo $image | tr '/:' '_')_secrets.json"
    
    trivy image \
        --format json \
        --output "$secrets_output" \
        --scanners secret \
        "$image" 2>/dev/null || true
    
    local secrets_count=$(jq '[.Results[]?.Secrets[]?] | length' "$secrets_output" 2>/dev/null || echo "0")
    
    if [ "$secrets_count" -gt 0 ]; then
        log_warn "Found $secrets_count potential secrets in image!"
        should_fail=true
    fi
    
    # Generate report
    generate_report "$image" "$output_dir" "$critical" "$high" "$medium" "$secrets_count"
    
    if [ "$should_fail" = "true" ]; then
        log_error "❌ Image scan failed security checks"
        return 1
    else
        log_info "✅ Image scan passed"
        return 0
    fi
}

###############################################################################
# Generate Report
###############################################################################

generate_report() {
    local image=$1
    local output_dir=$2
    local critical=$3
    local high=$4
    local medium=$5
    local secrets=$6
    
    local report_file="$output_dir/SCAN_REPORT.md"
    
    cat > "$report_file" <<EOF
# Image Security Scan Report

**Image:** \`$image\`  
**Scan Date:** $(date -Iseconds)  
**Scan ID:** $TIMESTAMP

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | $critical |
| HIGH | $high |
| MEDIUM | $medium |
| Secrets | $secrets |

## Vulnerability Details

See: \`$(basename $output_dir)/$(echo $image | tr '/:' '_')_vulnerabilities.txt\`

## Recommendations

EOF
    
    if [ "$critical" -gt 0 ]; then
        echo "### Critical Vulnerabilities" >> "$report_file"
        echo "" >> "$report_file"
        echo "**Action Required:** Update base image or affected packages immediately." >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if [ "$high" -gt 0 ]; then
        echo "### High Vulnerabilities" >> "$report_file"
        echo "" >> "$report_file"
        echo "**Action Required:** Plan updates for affected packages." >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if [ "$secrets" -gt 0 ]; then
        echo "### Secrets Detected" >> "$report_file"
        echo "" >> "$report_file"
        echo "**Action Required:** Remove secrets from image layers." >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    echo "## Next Steps" >> "$report_file"
    echo "" >> "$report_file"
    echo "1. Review vulnerability details" >> "$report_file"
    echo "2. Update affected packages" >> "$report_file"
    echo "3. Rebuild image" >> "$report_file"
    echo "4. Re-scan to verify fixes" >> "$report_file"
    echo "" >> "$report_file"
    echo "---" >> "$report_file"
    echo "" >> "$report_file"
    echo "**Scan Location:** \`$output_dir\`" >> "$report_file"
    
    log_info "✓ Report generated: $report_file"
}

###############################################################################
# Scan All Images
###############################################################################

scan_all_images() {
    log_section "Scanning All Local Images"
    
    # Get list of local images
    local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "<none>")
    
    local total=0
    local passed=0
    local failed=0
    
    for image in $images; do
        total=$((total + 1))
        
        if scan_image "$image"; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
        fi
        
        echo ""
    done
    
    log_section "Scan Summary"
    log_info "Total images scanned: $total"
    log_info "Passed: $passed"
    log_info "Failed: $failed"
    
    if [ "$failed" -gt 0 ]; then
        return 1
    fi
    
    return 0
}

###############################################################################
# Continuous Scanning
###############################################################################

continuous_scan() {
    local interval=${1:-3600}  # Default: 1 hour
    
    log_info "Starting continuous scanning (interval: ${interval}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        scan_all_images || true
        log_info "Next scan in ${interval}s..."
        sleep "$interval"
    done
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND [OPTIONS]

Commands:
  scan IMAGE        Scan specific image
  scan-all          Scan all local images
  continuous [SEC]  Continuous scanning (default: 3600s)

Options:
  --fail-on-critical  Fail on CRITICAL vulnerabilities (default: true)
  --fail-on-high      Fail on HIGH vulnerabilities (default: false)
  --output-dir DIR    Output directory (default: ~/.image-security-scans)

Environment Variables:
  FAIL_ON_CRITICAL    Fail on CRITICAL vulnerabilities
  FAIL_ON_HIGH        Fail on HIGH vulnerabilities
  SCAN_DIR            Output directory

Examples:
  # Scan specific image
  $0 scan valuecanvas-dev:latest

  # Scan all images
  $0 scan-all

  # Continuous scanning every 30 minutes
  $0 continuous 1800

  # Fail on HIGH vulnerabilities
  $0 --fail-on-high scan myimage:latest

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
            --fail-on-critical)
                FAIL_ON_CRITICAL=true
                shift
                ;;
            --fail-on-high)
                FAIL_ON_HIGH=true
                shift
                ;;
            --output-dir)
                SCAN_DIR="$2"
                shift 2
                ;;
            scan|scan-all|continuous)
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
        scan)
            if [ -z "$1" ]; then
                log_error "Image name required"
                show_usage
                exit 1
            fi
            scan_image "$1"
            ;;
        scan-all)
            scan_all_images
            ;;
        continuous)
            continuous_scan "$1"
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
