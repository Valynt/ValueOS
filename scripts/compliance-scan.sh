#!/usr/bin/env bash

# Compliance scanning script for PCI DSS and SOC2
# Validates container images and infrastructure against compliance requirements

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compliance frameworks
COMPLIANCE_FRAMEWORKS=${COMPLIANCE_FRAMEWORKS:-"pci,soc2"}
SCAN_TARGET="${SCAN_TARGET:-}"

# Logging functions
log_info() {
    echo -e "${BLUE}🔒 $1${NC}"
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

# PCI DSS compliance checks
check_pci_dss() {
    local image="$1"
    local report_file="/tmp/pci-compliance-${image//[:\/]/_}-$(date +%s).json"

    log_info "Running PCI DSS compliance checks for $image"

    # Initialize compliance results
    local compliance_results='{"framework": "PCI DSS", "image": "'$image'", "timestamp": '$(date +%s)', "checks": []}'

    # Check 1: Root user usage
    local root_check=$(docker inspect "$image" --format='{{.Config.User}}' 2>/dev/null || echo "root")
    local root_compliant="false"
    if [ "$root_check" != "" ] && [ "$root_check" != "root" ] && [ "$root_check" != "0" ]; then
        root_compliant="true"
        log_success "✓ Non-root user configured: $root_check"
    else
        log_error "✗ Container runs as root user"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"PCI-1\", \"description\": \"Non-root user\", \"compliant\": $root_compliant, \"details\": \"User: $root_check\"}]")

    # Check 2: Sensitive data in environment variables
    local sensitive_vars=$(docker inspect "$image" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -iE "(password|secret|key|token)" || echo "")
    local sensitive_compliant="true"
    local sensitive_count=0

    if [ -n "$sensitive_vars" ]; then
        sensitive_count=$(echo "$sensitive_vars" | wc -l)
        sensitive_compliant="false"
        log_error "✗ Found $sensitive_count potentially sensitive environment variables"
    else
        log_success "✓ No sensitive data in environment variables"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"PCI-2\", \"description\": \"No sensitive data in environment\", \"compliant\": $sensitive_compliant, \"details\": \"Sensitive vars found: $sensitive_count\"}]")

    # Check 3: Encrypted communication ports
    local ports=$(docker inspect "$image" --format='{{range .Config.ExposedPorts}}{{println .}}{{end}}' 2>/dev/null || echo "")
    local encryption_compliant="true"
    local unencrypted_ports=""

    if [ -n "$ports" ]; then
        while IFS= read -r port; do
            port_num=$(echo "$port" | sed 's/\/tcp//g' | sed 's/\/udp//g' | tr -d '{}')
            if [ "$port_num" = "80" ] || [ "$port_num" = "8080" ]; then
                encryption_compliant="false"
                unencrypted_ports="$unencrypted_ports $port_num"
            fi
        done <<< "$ports"

        if [ "$encryption_compliant" = "true" ]; then
            log_success "✓ No unencrypted communication ports detected"
        else
            log_error "✗ Unencrypted ports detected:$unencrypted_ports"
        fi
    else
        log_success "✓ No exposed ports"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"PCI-3\", \"description\": \"Encrypted communication\", \"compliant\": $encryption_compliant, \"details\": \"Unencrypted ports: $unencrypted_ports\"}]")

    # Check 4: Base image security
    local base_image=$(docker inspect "$image" --format='{{.Config.Image}}' 2>/dev/null || echo "unknown")
    local base_compliant="true"

    if [[ "$base_image" =~ (latest|stable|main) ]]; then
        base_compliant="false"
        log_error "✗ Using mutable base image tag: $base_image"
    else
        log_success "✓ Using specific base image version: $base_image"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"PCI-4\", \"description\": \"Immutable base image\", \"compliant\": $base_compliant, \"details\": \"Base image: $base_image\"}]")

    # Check 5: Security scanning integration
    local security_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -i security || echo "")
    local scanning_compliant="false"

    if [ -n "$security_labels" ]; then
        scanning_compliant="true"
        log_success "✓ Security labels found"
    else
        log_warning "⚠ No security labels detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"PCI-5\", \"description\": \"Security scanning integration\", \"compliant\": $scanning_compliant, \"details\": \"Security labels: $security_labels\"}]")

    # Calculate overall compliance
    local compliant_checks=$(echo "$compliance_results" | jq '.checks | map(select(.compliant == true)) | length')
    local total_checks=$(echo "$compliance_results" | jq '.checks | length')
    local compliance_percentage=$((compliant_checks * 100 / total_checks))
    local overall_compliant="false"

    if [ "$compliance_percentage" -ge 80 ]; then
        overall_compliant="true"
    fi

    # Add summary
    compliance_results=$(echo "$compliance_results" | jq ". + {\"summary\": {\"compliant_checks\": $compliant_checks, \"total_checks\": $total_checks, \"compliance_percentage\": $compliance_percentage, \"overall_compliant\": $overall_compliant}}")

    # Save report
    echo "$compliance_results" > "$report_file"

    # Display results
    log_info "PCI DSS Compliance Results for $image:"
    log_info "  Compliant Checks: $compliant_checks/$total_checks"
    log_info "  Compliance Percentage: $compliance_percentage%"
    log_info "  Overall Status: $(if [ "$overall_compliant" = "true" ]; then echo "COMPLIANT"; else echo "NON-COMPLIANT"; fi)"

    echo "$report_file"
}

# SOC2 compliance checks
check_soc2() {
    local image="$1"
    local report_file="/tmp/soc2-compliance-${image//[:\/]/_}-$(date +%s).json"

    log_info "Running SOC2 compliance checks for $image"

    # Initialize compliance results
    local compliance_results='{"framework": "SOC2", "image": "'$image'", "timestamp": '$(date +%s)', "checks": []}'

    # Check 1: Audit logging capability
    local audit_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -iE "(audit|log)" || echo "")
    local audit_compliant="false"

    if [ -n "$audit_labels" ]; then
        audit_compliant="true"
        log_success "✓ Audit/logging labels found"
    else
        log_warning "⚠ No audit/logging configuration detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"SOC2-1\", \"description\": \"Audit logging\", \"compliant\": $audit_compliant, \"details\": \"Audit labels: $audit_labels\"}]")

    # Check 2: Access control
    local user_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -iE "(user|access|auth)" || echo "")
    local access_compliant="false"

    if [ -n "$user_labels" ]; then
        access_compliant="true"
        log_success "✓ Access control labels found"
    else
        log_warning "⚠ No access control configuration detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"SOC2-2\", \"description\": \"Access control\", \"compliant\": $access_compliant, \"details\": \"Access labels: $user_labels\"}]")

    # Check 3: Data encryption at rest
    local encryption_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -iE "(encrypt|cipher|tls)" || echo "")
    local encryption_compliant="false"

    if [ -n "$encryption_labels" ]; then
        encryption_compliant="true"
        log_success "✓ Encryption labels found"
    else
        log_warning "⚠ No encryption configuration detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"SOC2-3\", \"description\": \"Data encryption\", \"compliant\": $encryption_compliant, \"details\": \"Encryption labels: $encryption_labels\"}]")

    # Check 4: Change management
    local build_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -iE "(build|version|commit|sha)" || echo "")
    local change_compliant="false"

    if [ -n "$build_labels" ]; then
        change_compliant="true"
        log_success "✓ Change management labels found"
    else
        log_warning "⚠ No change management configuration detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"SOC2-4\", \"description\": \"Change management\", \"compliant\": $change_compliant, \"details\": \"Build labels: $build_labels\"}]")

    # Check 5: Incident response
    local incident_labels=$(docker inspect "$image" --format='{{json .Config.Labels}}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null | grep -iE "(incident|response|alert)" || echo "")
    local incident_compliant="false"

    if [ -n "$incident_labels" ]; then
        incident_compliant="true"
        log_success "✓ Incident response labels found"
    else
        log_warning "⚠ No incident response configuration detected"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"SOC2-5\", \"description\": \"Incident response\", \"compliant\": $incident_compliant, \"details\": \"Incident labels: $incident_labels\"}]")

    # Calculate overall compliance
    local compliant_checks=$(echo "$compliance_results" | jq '.checks | map(select(.compliant == true)) | length')
    local total_checks=$(echo "$compliance_results" | jq '.checks | length')
    local compliance_percentage=$((compliant_checks * 100 / total_checks))
    local overall_compliant="false"

    if [ "$compliance_percentage" -ge 80 ]; then
        overall_compliant="true"
    fi

    # Add summary
    compliance_results=$(echo "$compliance_results" | jq ". + {\"summary\": {\"compliant_checks\": $compliant_checks, \"total_checks\": $total_checks, \"compliance_percentage\": $compliance_percentage, \"overall_compliant\": $overall_compliant}}")

    # Save report
    echo "$compliance_results" > "$report_file"

    # Display results
    log_info "SOC2 Compliance Results for $image:"
    log_info "  Compliant Checks: $compliant_checks/$total_checks"
    log_info "  Compliance Percentage: $compliance_percentage%"
    log_info "  Overall Status: $(if [ "$overall_compliant" = "true" ]; then echo "COMPLIANT"; else echo "NON-COMPLIANT"; fi)"

    echo "$report_file"
}

# Infrastructure compliance checks
check_infrastructure() {
    local report_file="/tmp/infrastructure-compliance-$(date +%s).json"

    log_info "Running infrastructure compliance checks"

    # Initialize compliance results
    local compliance_results='{"framework": "Infrastructure", "timestamp": '$(date +%s)', "checks": []}'

    # Check Kubernetes RBAC
    local rbac_check="false"
    if kubectl get clusterrolebinding > /dev/null 2>&1; then
        rbac_check="true"
        log_success "✓ RBAC is configured"
    else
        log_warning "⚠ RBAC configuration not accessible"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"INFRA-1\", \"description\": \"RBAC configuration\", \"compliant\": $rbac_check}]")

    # Check network policies
    local network_check="false"
    if kubectl get networkpolicy --all-namespaces | grep -q "NetworkPolicy" 2>/dev/null; then
        network_check="true"
        log_success "✓ Network policies are configured"
    else
        log_warning "⚠ No network policies found"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"INFRA-2\", \"description\": \"Network policies\", \"compliant\": $network_check}]")

    # Check pod security policies
    local psp_check="false"
    if kubectl get podsecuritypolicy > /dev/null 2>&1; then
        psp_check="true"
        log_success "✓ Pod security policies are configured"
    else
        log_warning "⚠ No pod security policies found"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"INFRA-3\", \"description\": \"Pod security policies\", \"compliant\": $psp_check}]")

    # Check encryption at rest
    local encryption_check="false"
    if kubectl get secrets --all-namespaces | grep -q "encrypted" 2>/dev/null; then
        encryption_check="true"
        log_success "✓ Encryption at rest detected"
    else
        log_warning "⚠ No evidence of encryption at rest"
    fi

    compliance_results=$(echo "$compliance_results" | jq ".checks += [{\"id\": \"INFRA-4\", \"description\": \"Encryption at rest\", \"compliant\": $encryption_check}]")

    # Calculate overall compliance
    local compliant_checks=$(echo "$compliance_results" | jq '.checks | map(select(.compliant == true)) | length')
    local total_checks=$(echo "$compliance_results" | jq '.checks | length')
    local compliance_percentage=$((compliant_checks * 100 / total_checks))
    local overall_compliant="false"

    if [ "$compliance_percentage" -ge 80 ]; then
        overall_compliant="true"
    fi

    # Add summary
    compliance_results=$(echo "$compliance_results" | jq ". + {\"summary\": {\"compliant_checks\": $compliant_checks, \"total_checks\": $total_checks, \"compliance_percentage\": $compliance_percentage, \"overall_compliant\": $overall_compliant}}")

    # Save report
    echo "$compliance_results" > "$report_file"

    # Display results
    log_info "Infrastructure Compliance Results:"
    log_info "  Compliant Checks: $compliant_checks/$total_checks"
    log_info "  Compliance Percentage: $compliance_percentage%"
    log_info "  Overall Status: $(if [ "$overall_compliant" = "true" ]; then echo "COMPLIANT"; else echo "NON-COMPLIANT"; fi)"

    echo "$report_file"
}

# Generate combined compliance report
generate_combined_report() {
    local output_file="${1:-compliance-report-$(date +%Y%m%d-%H%M%S).json}"

    log_info "Generating combined compliance report: $output_file"

    # Find all compliance reports
    local report_files=($(find /tmp -name "*-compliance-*.json" | sort))

    if [ ${#report_files[@]} -eq 0 ]; then
        log_warning "No compliance reports found"
        return 0
    fi

    # Generate combined report
    echo '{"compliance_report": {' > "$output_file"
    echo '"generated_at": '$(date +%s)',' >> "$output_file"
    echo '"frameworks": [' >> "$output_file"

    local first=true
    for report_file in "${report_files[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ',' >> "$output_file"
        fi

        # Extract framework data
        jq '{framework, image, summary}' "$report_file" >> "$output_file"
    done

    echo ']}' >> "$output_file"

    log_success "Combined compliance report generated: $output_file"
}

# Main execution
main() {
    local command="${1:-scan}"

    case "$command" in
        "scan")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 scan <image>"
                exit 1
            fi

            local image="$2"
            local reports=()

            # Run compliance checks based on frameworks
            IFS=',' read -ra frameworks <<< "$COMPLIANCE_FRAMEWORKS"
            for framework in "${frameworks[@]}"; do
                case "$framework" in
                    "pci")
                        local report=$(check_pci_dss "$image")
                        reports+=("$report")
                        ;;
                    "soc2")
                        local report=$(check_soc2 "$image")
                        reports+=("$report")
                        ;;
                    "infra")
                        local report=$(check_infrastructure)
                        reports+=("$report")
                        ;;
                    *)
                        log_warning "Unknown framework: $framework"
                        ;;
                esac
            done

            # Generate combined report
            generate_combined_report

            # Check if any reports failed
            local failed=false
            for report in "${reports[@]}"; do
                if [ -f "$report" ]; then
                    local compliant=$(jq -r '.summary.overall_compliant' "$report")
                    if [ "$compliant" != "true" ]; then
                        failed=true
                    fi
                fi
            done

            if [ "$failed" = true ]; then
                log_error "One or more compliance checks failed"
                exit 1
            else
                log_success "All compliance checks passed"
            fi
            ;;
        "pci")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 pci <image>"
                exit 1
            fi
            check_pci_dss "$2"
            ;;
        "soc2")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 soc2 <image>"
                exit 1
            fi
            check_soc2 "$2"
            ;;
        "infra")
            check_infrastructure
            ;;
        "report")
            generate_combined_report "$2"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  scan <image>              Run all compliance scans"
            echo "  pci <image>               Run PCI DSS compliance check"
            echo "  soc2 <image>              Run SOC2 compliance check"
            echo "  infra                     Run infrastructure compliance check"
            echo "  report [output]           Generate combined report"
            echo ""
            echo "Environment variables:"
            echo "  COMPLIANCE_FRAMEWORKS     Comma-separated list of frameworks (default: pci,soc2)"
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
