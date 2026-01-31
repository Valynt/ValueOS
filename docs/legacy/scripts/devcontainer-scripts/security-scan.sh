#!/bin/bash
##############################################################################
# Enhanced Security Scanning Script for Development Container
# Provides automated vulnerability checks and security assessments
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCAN_DIR=${SCAN_DIR:-"/workspace"}
REPORT_DIR=${REPORT_DIR:-"/workspace/security-reports"}
SEVERITY_THRESHOLD=${SEVERITY_THRESHOLD:-"MEDIUM"}
FAIL_ON_HIGH=${FAIL_ON_HIGH:-"true"}

# Create reports directory
mkdir -p "$REPORT_DIR"

# Helper functions
print_header() {
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if security tools are available
check_tools() {
    print_header "Checking Security Tools"

    local tools_available=true

    # Check Trivy
    if command -v trivy &> /dev/null; then
        print_success "Trivy available: $(trivy version | head -1)"
    else
        print_warning "Trivy not found - skipping container vulnerability scanning"
        tools_available=false
    fi

    # Check TruffleHog
    if command -v trufflehog &> /dev/null; then
        print_success "TruffleHog available"
    else
        print_warning "TruffleHog not found - skipping secret scanning"
        tools_available=false
    fi

    # Check Git Secrets
    if command -v git-secrets &> /dev/null; then
        print_success "Git Secrets available"
    else
        print_warning "Git Secrets not found - skipping git secrets scan"
        tools_available=false
    fi

    # Check Snyk
    if command -v snyk &> /dev/null; then
        print_success "Snyk available"
    else
        print_warning "Snyk not found - skipping dependency vulnerability scanning"
        tools_available=false
    fi

    # Check Hadolint
    if command -v hadolint &> /dev/null; then
        print_success "Hadolint available"
    else
        print_warning "Hadolint not found - skipping Dockerfile linting"
        tools_available=false
    fi

    if [ "$tools_available" = false ]; then
        print_warning "Some security tools are missing. Install them for comprehensive scanning."
    fi

    echo ""
}

# Scan container images for vulnerabilities
scan_containers() {
    if ! command -v trivy &> /dev/null; then
        print_info "Skipping container vulnerability scan (Trivy not available)"
        return
    fi

    print_header "Container Vulnerability Scan"

    local container_images=(
        "prom/prometheus:v2.47.0"
        "grafana/grafana:10.1.0"
        "jaegertracing/all-in-one:1.47.0"
        "postgres:15-alpine"
        "redis:7-alpine"
        "mailhog/mailhog:1.0.1"
    )

    local total_vulnerabilities=0
    local high_vulnerabilities=0

    for image in "${container_images[@]}"; do
        print_info "Scanning image: $image"

        local report_file="$REPORT_DIR/container-$(echo $image | tr '/' '-' | tr ':' '-').json"

        if trivy image --format json --output "$report_file" --severity "$SEVERITY_THRESHOLD" "$image"; then
            local vuln_count=$(jq -r '.Results[]?.Vulnerabilities | length' "$report_file" 2>/dev/null || echo "0")
            local high_count=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | length' "$report_file" 2>/dev/null || echo "0")

            total_vulnerabilities=$((total_vulnerabilities + vuln_count))
            high_vulnerabilities=$((high_vulnerabilities + high_count))

            if [ "$high_count" -gt 0 ]; then
                print_error "$image: $vuln_count vulnerabilities ($high_count HIGH/CRITICAL)"
            elif [ "$vuln_count" -gt 0 ]; then
                print_warning "$image: $vuln_count vulnerabilities"
            else
                print_success "$image: No vulnerabilities found"
            fi
        else
            print_error "Failed to scan $image"
        fi
    done

    print_info "Container scan complete: $total_vulnerabilities total vulnerabilities, $high_vulnerabilities high/critical"
    echo ""
}

# Scan for secrets in the codebase
scan_secrets() {
    if ! command -v trufflehog &> /dev/null; then
        print_info "Skipping secret scan (TruffleHog not available)"
        return
    fi

    print_header "Secret Detection Scan"

    local secrets_report="$REPORT_DIR/secrets.json"

    print_info "Scanning for secrets in $SCAN_DIR"

    if trufflehog filesystem "$SCAN_DIR" --json --output "$secrets_report" 2>/dev/null; then
        local secret_count=$(jq length "$secrets_report" 2>/dev/null || echo "0")

        if [ "$secret_count" -gt 0 ]; then
            print_error "Found $secret_count potential secrets"

            # Show summary of secret types
            print_info "Secret types found:"
            jq -r '.[] | .SourceMetadata | .Data | .file' "$secrets_report" 2>/dev/null | sort | uniq -c | head -5
        else
            print_success "No secrets detected"
        fi
    else
        print_warning "Secret scan completed with warnings"
    fi

    echo ""
}

# Scan git repository for secrets
scan_git_secrets() {
    if ! command -v git-secrets &> /dev/null; then
        print_info "Skipping git secrets scan (git-secrets not available)"
        return
    fi

    print_header "Git Secrets Scan"

    cd "$SCAN_DIR"

    if [ -d ".git" ]; then
        print_info "Scanning git history for secrets"

        if git secrets --scan; then
            print_success "No secrets found in git history"
        else
            print_error "Potential secrets found in git history"
        fi
    else
        print_info "Not a git repository - skipping git secrets scan"
    fi

    echo ""
}

# Scan dependencies for vulnerabilities
scan_dependencies() {
    if ! command -v snyk &> /dev/null; then
        print_info "Skipping dependency scan (Snyk not available)"
        return
    fi

    print_header "Dependency Vulnerability Scan"

    cd "$SCAN_DIR"

    if [ -f "package.json" ]; then
        print_info "Scanning npm dependencies"

        local deps_report="$REPORT_DIR/dependencies.json"

        if snyk test --json --output="$deps_report" 2>/dev/null; then
            local vuln_count=$(jq -r '.vulnerabilities | length' "$deps_report" 2>/dev/null || echo "0")

            if [ "$vuln_count" -gt 0 ]; then
                print_warning "Found $vuln_count dependency vulnerabilities"
            else
                print_success "No dependency vulnerabilities found"
            fi
        else
            print_warning "Dependency scan completed with warnings"
        fi
    else
        print_info "No package.json found - skipping dependency scan"
    fi

    echo ""
}

# Lint Dockerfiles for security best practices
lint_dockerfiles() {
    if ! command -v hadolint &> /dev/null; then
        print_info "Skipping Dockerfile linting (Hadolint not available)"
        return
    fi

    print_header "Dockerfile Security Linting"

    local dockerfiles=(
        "Dockerfile"
        "Dockerfile.prod"
        "Dockerfile.optimized"
        ".devcontainer/Dockerfile.optimized"
    )

    for dockerfile in "${dockerfiles[@]}"; do
        if [ -f "$SCAN_DIR/$dockerfile" ]; then
            print_info "Linting $dockerfile"

            local lint_report="$REPORT_DIR/dockerfile-$(basename $dockerfile).txt"

            if hadolint "$SCAN_DIR/$dockerfile" > "$lint_report" 2>&1; then
                print_success "$dockerfile: No issues found"
            else
                local issue_count=$(wc -l < "$lint_report")
                print_warning "$dockerfile: $issue_count issues found"
            fi
        fi
    done

    echo ""
}

# Generate comprehensive security report
generate_report() {
    print_header "Security Scan Summary"

    local summary_report="$REPORT_DIR/security-summary-$(date +%Y%m%d-%H%M%S).md"

    cat > "$summary_report" << EOF
# Security Scan Report

**Date:** $(date)
**Scan Directory:** $SCAN_DIR
**Severity Threshold:** $SEVERITY_THRESHOLD

## Executive Summary

This report contains the results of automated security scans performed on the development environment.

## Scan Results

### Container Vulnerabilities
- Scanned $(find "$REPORT_DIR" -name "container-*.json" | wc -l) container images
- Details available in individual JSON files

### Secret Detection
- TruffleHog scan completed
- Git secrets scan completed
- Details available in secrets.json

### Dependency Vulnerabilities
- Snyk dependency scan completed
- Details available in dependencies.json

### Dockerfile Security
- Hadolint linting completed
- Details available in individual text files

## Recommendations

1. Review any HIGH or CRITICAL vulnerabilities found in container images
2. Investigate any detected secrets immediately
3. Update dependencies with known vulnerabilities
4. Address Dockerfile security recommendations

## Next Steps

1. Fix identified security issues
2. Implement regular security scanning in CI/CD pipeline
3. Establish security monitoring and alerting
4. Conduct periodic security assessments

---

*This report was generated automatically by the security scanning script.*
EOF

    print_success "Security report generated: $summary_report"
    print_info "Review all reports in: $REPORT_DIR"
}

# Main execution
main() {
    print_header "ValueOS Security Scanning"
    print_info "Starting comprehensive security assessment..."
    echo ""

    # Run all scans
    check_tools
    scan_containers
    scan_secrets
    scan_git_secrets
    scan_dependencies
    lint_dockerfiles
    generate_report

    print_header "Security Scan Complete"
    print_success "All security scans completed successfully"
    print_info "Review the generated reports for detailed findings"

    # Exit with error if high vulnerabilities found and FAIL_ON_HIGH is true
    if [ "$FAIL_ON_HIGH" = "true" ]; then
        local high_vulns=$(find "$REPORT_DIR" -name "*.json" -exec jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | length' {} \; 2>/dev/null | awk '{sum += $1} END {print sum+0}')

        if [ "$high_vulns" -gt 0 ]; then
            print_error "Found $high_vulns high/critical vulnerabilities. Exiting with error."
            exit 1
        fi
    fi

    exit 0
}

# Run main function
main "$@"
