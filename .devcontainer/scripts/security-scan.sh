#!/bin/bash
###############################################################################
# Container Security Scanning Script
# 
# Runs multiple security scanners to detect vulnerabilities
###############################################################################

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_ROOT="/workspaces/ValueOS"
SCAN_RESULTS_DIR="${HOME}/.security-scans"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Severity thresholds
FAIL_ON_CRITICAL=true
FAIL_ON_HIGH=false
FAIL_ON_MEDIUM=false

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

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

check_tool() {
    local tool=$1
    if ! command -v "$tool" &> /dev/null; then
        log_warn "$tool not found, skipping related scans"
        return 1
    fi
    return 0
}

###############################################################################
# Setup
###############################################################################

setup() {
    log_info "Setting up security scan environment..."
    
    # Create results directory
    mkdir -p "$SCAN_RESULTS_DIR"
    
    # Create scan session directory
    SCAN_SESSION_DIR="$SCAN_RESULTS_DIR/scan_$TIMESTAMP"
    mkdir -p "$SCAN_SESSION_DIR"
    
    log_info "✓ Scan results will be saved to: $SCAN_SESSION_DIR"
}

###############################################################################
# Trivy - Container Image Scanning
###############################################################################

scan_with_trivy() {
    log_section "Trivy: Container Image Vulnerability Scan"
    
    if ! check_tool trivy; then
        return 0
    fi
    
    local image_name="valuecanvas-dev:latest"
    local output_file="$SCAN_SESSION_DIR/trivy-image.json"
    
    log_info "Scanning container image: $image_name"
    
    # Scan container image
    trivy image \
        --format json \
        --output "$output_file" \
        --severity CRITICAL,HIGH,MEDIUM \
        "$image_name" 2>/dev/null || true
    
    # Generate human-readable report
    trivy image \
        --format table \
        --severity CRITICAL,HIGH,MEDIUM \
        "$image_name" | tee "$SCAN_SESSION_DIR/trivy-image.txt"
    
    # Check for critical vulnerabilities
    local critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$output_file" 2>/dev/null || echo "0")
    local high_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$output_file" 2>/dev/null || echo "0")
    
    log_info "Found: $critical_count CRITICAL, $high_count HIGH vulnerabilities"
    
    if [ "$critical_count" -gt 0 ] && [ "$FAIL_ON_CRITICAL" = true ]; then
        log_error "Critical vulnerabilities found in container image!"
        return 1
    fi
    
    log_info "✓ Trivy image scan complete"
    return 0
}

scan_filesystem_with_trivy() {
    log_section "Trivy: Filesystem Vulnerability Scan"
    
    if ! check_tool trivy; then
        return 0
    fi
    
    local output_file="$SCAN_SESSION_DIR/trivy-fs.json"
    
    log_info "Scanning filesystem: $REPO_ROOT"
    
    # Scan filesystem
    trivy fs \
        --format json \
        --output "$output_file" \
        --severity CRITICAL,HIGH,MEDIUM \
        --scanners vuln,secret,misconfig \
        "$REPO_ROOT" 2>/dev/null || true
    
    # Generate human-readable report
    trivy fs \
        --format table \
        --severity CRITICAL,HIGH,MEDIUM \
        --scanners vuln,secret,misconfig \
        "$REPO_ROOT" | tee "$SCAN_SESSION_DIR/trivy-fs.txt"
    
    log_info "✓ Trivy filesystem scan complete"
    return 0
}

###############################################################################
# TruffleHog - Secret Detection
###############################################################################

scan_with_trufflehog() {
    log_section "TruffleHog: Secret Detection"
    
    if ! check_tool trufflehog; then
        return 0
    fi
    
    local output_file="$SCAN_SESSION_DIR/trufflehog.json"
    
    log_info "Scanning for secrets in: $REPO_ROOT"
    
    # Scan for secrets
    trufflehog filesystem "$REPO_ROOT" \
        --no-update \
        --json \
        --only-verified \
        > "$output_file" 2>/dev/null || true
    
    # Count findings
    local secret_count=$(cat "$output_file" | jq -s 'length' 2>/dev/null || echo "0")
    
    if [ "$secret_count" -gt 0 ]; then
        log_warn "Found $secret_count verified secrets!"
        
        # Generate human-readable report
        cat "$output_file" | jq -r '.[] | "[\(.DetectorName)] \(.SourceMetadata.Data.Filesystem.file):\(.SourceMetadata.Data.Filesystem.line)"' \
            > "$SCAN_SESSION_DIR/trufflehog.txt"
        
        log_warn "Details saved to: $SCAN_SESSION_DIR/trufflehog.txt"
        
        if [ "$FAIL_ON_CRITICAL" = true ]; then
            log_error "Verified secrets found in repository!"
            return 1
        fi
    else
        log_info "✓ No verified secrets found"
    fi
    
    return 0
}

###############################################################################
# Snyk - Dependency Scanning
###############################################################################

scan_with_snyk() {
    log_section "Snyk: Dependency Vulnerability Scan"
    
    if ! check_tool snyk; then
        return 0
    fi
    
    local output_file="$SCAN_SESSION_DIR/snyk.json"
    
    log_info "Scanning dependencies: $REPO_ROOT"
    
    cd "$REPO_ROOT"
    
    # Check if authenticated
    if ! snyk auth status &> /dev/null; then
        log_warn "Snyk not authenticated. Run: snyk auth"
        log_warn "Skipping Snyk scan"
        return 0
    fi
    
    # Scan dependencies
    snyk test \
        --json \
        --severity-threshold=high \
        > "$output_file" 2>/dev/null || true
    
    # Generate human-readable report
    snyk test \
        --severity-threshold=high \
        | tee "$SCAN_SESSION_DIR/snyk.txt" || true
    
    log_info "✓ Snyk scan complete"
    return 0
}

###############################################################################
# Docker Bench Security
###############################################################################

scan_docker_security() {
    log_section "Docker Security Best Practices"
    
    local output_file="$SCAN_SESSION_DIR/docker-security.txt"
    
    log_info "Checking Docker security configuration..."
    
    # Check Docker daemon configuration
    {
        echo "=== Docker Daemon Info ==="
        docker info --format '{{json .}}' | jq -r '.SecurityOptions[]' 2>/dev/null || echo "N/A"
        
        echo ""
        echo "=== Container Security ==="
        docker inspect valuecanvas-dev-optimized --format '{{json .HostConfig}}' 2>/dev/null | jq '{
            Privileged,
            CapAdd,
            CapDrop,
            SecurityOpt,
            ReadonlyRootfs,
            Memory,
            MemorySwap,
            CpuShares,
            PidsLimit
        }' || echo "Container not running"
        
        echo ""
        echo "=== Image Security ==="
        docker history valuecanvas-dev:latest --no-trunc 2>/dev/null | head -20 || echo "Image not found"
        
    } | tee "$output_file"
    
    log_info "✓ Docker security check complete"
    return 0
}

###############################################################################
# Git History Scan
###############################################################################

scan_git_history() {
    log_section "Git History: Secret Detection"
    
    if ! check_tool trufflehog; then
        return 0
    fi
    
    local output_file="$SCAN_SESSION_DIR/git-history.json"
    
    log_info "Scanning git history for secrets..."
    
    cd "$REPO_ROOT"
    
    # Scan git history
    trufflehog git file://. \
        --no-update \
        --json \
        --only-verified \
        --since-commit HEAD~100 \
        > "$output_file" 2>/dev/null || true
    
    # Count findings
    local secret_count=$(cat "$output_file" | jq -s 'length' 2>/dev/null || echo "0")
    
    if [ "$secret_count" -gt 0 ]; then
        log_warn "Found $secret_count secrets in git history!"
        
        # Generate human-readable report
        cat "$output_file" | jq -r '.[] | "[\(.DetectorName)] Commit: \(.SourceMetadata.Data.Git.commit)"' \
            > "$SCAN_SESSION_DIR/git-history.txt"
        
        log_warn "Details saved to: $SCAN_SESSION_DIR/git-history.txt"
        log_warn "Run: bash .devcontainer/scripts/remove-secrets.sh"
    else
        log_info "✓ No secrets found in recent git history"
    fi
    
    return 0
}

###############################################################################
# Configuration Audit
###############################################################################

audit_configuration() {
    log_section "Configuration Security Audit"
    
    local output_file="$SCAN_SESSION_DIR/config-audit.txt"
    
    log_info "Auditing security configuration..."
    
    {
        echo "=== File Permissions ==="
        echo "Checking sensitive files..."
        
        # Check .env permissions
        if [ -f "$REPO_ROOT/.env" ]; then
            ls -la "$REPO_ROOT/.env"
            if [ "$(stat -c %a "$REPO_ROOT/.env" 2>/dev/null || stat -f %A "$REPO_ROOT/.env")" != "600" ]; then
                echo "⚠️  WARNING: .env should have 600 permissions"
            fi
        fi
        
        # Check secrets directory
        if [ -d "$REPO_ROOT/.devcontainer/secrets" ]; then
            echo ""
            echo "Secrets directory:"
            ls -la "$REPO_ROOT/.devcontainer/secrets/"
        fi
        
        echo ""
        echo "=== Git Configuration ==="
        
        # Check .gitignore
        if grep -q "^\.env$" "$REPO_ROOT/.gitignore"; then
            echo "✓ .env is gitignored"
        else
            echo "❌ .env is NOT gitignored!"
        fi
        
        if grep -q "secrets/" "$REPO_ROOT/.devcontainer/.gitignore" 2>/dev/null; then
            echo "✓ secrets/ is gitignored"
        else
            echo "⚠️  secrets/ may not be gitignored"
        fi
        
        echo ""
        echo "=== Environment Variables ==="
        
        # Check for sensitive env vars (don't print values)
        for var in SUPABASE_ACCESS_TOKEN JWT_SECRET TOGETHER_API_KEY DB_PASSWORD; do
            if [ -n "${!var}" ]; then
                echo "✓ $var is set"
            else
                echo "⚠️  $var is not set"
            fi
        done
        
        echo ""
        echo "=== Network Configuration ==="
        
        # Check exposed ports
        docker port valuecanvas-dev-optimized 2>/dev/null || echo "Container not running"
        
    } | tee "$output_file"
    
    log_info "✓ Configuration audit complete"
    return 0
}

###############################################################################
# Generate Summary Report
###############################################################################

generate_summary() {
    log_section "Security Scan Summary"
    
    local summary_file="$SCAN_SESSION_DIR/SUMMARY.md"
    
    cat > "$summary_file" <<EOF
# Security Scan Summary

**Date:** $(date -Iseconds)
**Scan ID:** $TIMESTAMP

## Scans Performed

EOF
    
    # Add scan results
    for scan_file in "$SCAN_SESSION_DIR"/*.txt "$SCAN_SESSION_DIR"/*.json; do
        if [ -f "$scan_file" ]; then
            local filename=$(basename "$scan_file")
            echo "- $filename" >> "$summary_file"
        fi
    done
    
    cat >> "$summary_file" <<EOF

## Critical Findings

EOF
    
    # Check for critical issues
    local has_critical=false
    
    # Check Trivy results
    if [ -f "$SCAN_SESSION_DIR/trivy-image.json" ]; then
        local critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$SCAN_SESSION_DIR/trivy-image.json" 2>/dev/null || echo "0")
        if [ "$critical_count" -gt 0 ]; then
            echo "- **$critical_count CRITICAL** vulnerabilities in container image" >> "$summary_file"
            has_critical=true
        fi
    fi
    
    # Check TruffleHog results
    if [ -f "$SCAN_SESSION_DIR/trufflehog.json" ]; then
        local secret_count=$(cat "$SCAN_SESSION_DIR/trufflehog.json" | jq -s 'length' 2>/dev/null || echo "0")
        if [ "$secret_count" -gt 0 ]; then
            echo "- **$secret_count verified secrets** found in repository" >> "$summary_file"
            has_critical=true
        fi
    fi
    
    if [ "$has_critical" = false ]; then
        echo "No critical findings." >> "$summary_file"
    fi
    
    cat >> "$summary_file" <<EOF

## Recommendations

1. Review all scan results in: \`$SCAN_SESSION_DIR\`
2. Address critical vulnerabilities immediately
3. Rotate any exposed secrets
4. Update dependencies with known vulnerabilities
5. Run scans regularly (weekly recommended)

## Next Steps

\`\`\`bash
# View detailed results
ls -la $SCAN_SESSION_DIR

# View specific scan
cat $SCAN_SESSION_DIR/trivy-image.txt

# Re-run scan
bash .devcontainer/scripts/security-scan.sh
\`\`\`

---

**Scan Location:** $SCAN_SESSION_DIR
EOF
    
    # Display summary
    cat "$summary_file"
    
    log_info "✓ Summary report generated: $summary_file"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo "========================================="
    echo "  Container Security Scan"
    echo "========================================="
    echo ""
    
    local exit_code=0
    
    # Setup
    setup
    
    # Run scans
    scan_with_trivy || exit_code=$?
    scan_filesystem_with_trivy || exit_code=$?
    scan_with_trufflehog || exit_code=$?
    scan_with_snyk || exit_code=$?
    scan_docker_security || exit_code=$?
    scan_git_history || exit_code=$?
    audit_configuration || exit_code=$?
    
    # Generate summary
    generate_summary
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        log_info "✅ Security scan completed successfully"
    else
        log_error "❌ Security scan completed with issues"
    fi
    
    log_info "Results saved to: $SCAN_SESSION_DIR"
    
    exit $exit_code
}

# Run main function
main "$@"
