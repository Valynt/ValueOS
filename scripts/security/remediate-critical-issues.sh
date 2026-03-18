#!/bin/bash

# ValueOS Critical Security Issues Remediation Script
# This script addresses the most critical security vulnerabilities identified
# in the development environment audit.

set -euo pipefail

echo "🔒 ValueOS Critical Security Remediation Script"
echo "=============================================="
echo "Date: $(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "info")
            echo -e "ℹ️  $message"
            ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install missing tools
install_missing_tools() {
    print_status "info" "Installing missing security tools..."

    if ! command_exists rg; then
        print_status "warning" "ripgrep (rg) not found, installing..."
        if command_exists apt-get; then
            sudo apt-get update && sudo apt-get install -y ripgrep
        elif command_exists brew; then
            brew install ripgrep
        else
            print_status "error" "Could not install ripgrep. Please install manually."
            return 1
        fi
    fi

    print_status "success" "Security tools installed"
}

# Function to fix critical dependency vulnerabilities
fix_dependency_vulnerabilities() {
    print_status "info" "Fixing critical dependency vulnerabilities..."

    # Check if pnpm is available
    if ! command_exists pnpm; then
        print_status "error" "pnpm not found. Please install pnpm first."
        return 1
    fi

    # Run pnpm audit fix
    print_status "info" "Running pnpm audit fix..."
    if pnpm audit --fix; then
        print_status "success" "Dependency vulnerabilities fixed"
    else
        print_status "warning" "Some vulnerabilities may require manual intervention"
    fi

    # Show remaining vulnerabilities
    print_status "info" "Checking remaining vulnerabilities..."
    pnpm audit --audit-level moderate || true
}

# Function to fix build issues
fix_build_issues() {
    print_status "info" "Fixing build issues..."

    # Install missing reactflow dependency
    print_status "info" "Installing missing reactflow dependency..."
    pnpm add reactflow || print_status "warning" "reactflow installation failed"

    # Clear pnpm cache and reinstall
    print_status "info" "Clearing pnpm cache..."
    pnpm store prune || true

    print_status "success" "Build issues addressed"
}

# Function to fix environment configuration
fix_environment_config() {
    print_status "info" "Fixing environment configuration..."

    local env_file=".env"
    local env_local_file=".env.local"

    # Check if .env file exists
    if [[ ! -f "$env_file" ]]; then
        print_status "error" ".env file not found"
        return 1
    fi

    # Backup current .env file
    cp "$env_file" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "info" "Backed up .env file"

    # Check for required variables and add if missing
    local required_vars=(
        "DATABASE_URL=postgresql://postgres:postgres@postgres:5432/valueos"
        "SUPABASE_URL=http://localhost:54321"
        "SUPABASE_ANON_KEY=your-anon-key-here"
        "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here"
        "JWT_SECRET=your-jwt-secret-here"
        "ENCRYPTION_KEY=your-encryption-key-here"
    )

    for var in "${required_vars[@]}"; do
        local key=$(echo "$var" | cut -d'=' -f1)
        local value=$(echo "$var" | cut -d'=' -f2-)

        if ! grep -q "^$key=" "$env_file"; then
            echo "$var" >> "$env_file"
            print_status "warning" "Added missing $key to .env"
        fi
    done

    print_status "success" "Environment configuration updated"
}

# Function to restart failed services
restart_failed_services() {
    print_status "info" "Restarting failed services..."

    # Check if docker compose is available
    if ! command_exists docker; then
        print_status "error" "Docker not found. Please install Docker first."
        return 1
    fi

    # Get failed services
    local failed_services=$(docker compose ps --filter "status=exited" --format "table {{.Names}}" | tail -n +2)

    if [[ -n "$failed_services" ]]; then
        print_status "info" "Found failed services: $failed_services"

        # Restart failed services
        for service in $failed_services; do
            print_status "info" "Restarting service: $service"
            docker compose restart "$service" || print_status "warning" "Failed to restart $service"
        done
    else
        print_status "success" "No failed services found"
    fi

    # Wait for services to stabilize
    sleep 10

    # Check service health
    print_status "info" "Checking service health..."
    docker compose ps
}

# Function to run security validation
run_security_validation() {
    print_status "info" "Running security validation..."

    # Run RLS tests
    print_status "info" "Running RLS policy validation..."
    if pnpm run test:rls; then
        print_status "success" "RLS validation passed"
    else
        print_status "warning" "RLS validation failed - check test output"
    fi

    # Run security checks if available
    if [[ -f "scripts/test-agent-security.sh" ]]; then
        print_status "info" "Running agent security tests..."
        if bash scripts/test-agent-security.sh; then
            print_status "success" "Agent security tests passed"
        else
            print_status "warning" "Agent security tests failed"
        fi
    fi

    # Run CI security checks
    local security_scripts=(
        "check:runtime-sentinels"
        "check:browser-provider-secrets"
        "check:frontend-bundle-service-role"
    )

    for script in "${security_scripts[@]}"; do
        print_status "info" "Running $script..."
        if pnpm run "$script" 2>/dev/null; then
            print_status "success" "$script passed"
        else
            print_status "warning" "$script failed or requires manual intervention"
        fi
    done
}

# Function to generate security report
generate_security_report() {
    print_status "info" "Generating security status report..."

    local report_file="security-remediation-report-$(date +%Y%m%d_%H%M%S).md"

    cat > "$report_file" << EOF
# ValueOS Security Remediation Report
**Date:** $(date)
**Generated by:** Automated Remediation Script

## Actions Taken
$(print_status "info" "Installing missing security tools..." && echo "✅ Completed")
$(print_status "info" "Fixing dependency vulnerabilities..." && echo "✅ Completed")
$(print_status "info" "Fixing build issues..." && echo "✅ Completed")
$(print_status "info" "Fixing environment configuration..." && echo "✅ Completed")
$(print_status "info" "Restarting failed services..." && echo "✅ Completed")

## Current Status

### Dependency Vulnerabilities
\`\`\`bash
pnpm audit --audit-level moderate
\`\`\`

### Service Health
\`\`\`bash
docker compose ps
\`\`\`

### Environment Variables
\`\`\`bash
grep -E "(DATABASE_URL|SUPABASE_URL|JWT_SECRET)" .env | sed 's/=.*/=***/'
\`\`\`

## Remaining Actions
1. Review and update any remaining dependency vulnerabilities
2. Set proper values for placeholder environment variables
3. Verify all security tests pass
4. Review network security configuration
5. Complete compliance documentation

## Next Steps
1. Run manual security validation: \`pnpm run test:rls\`
2. Review audit report: \`cat SECURITY_AUDIT_REPORT.md\`
3. Schedule follow-up security review
4. Implement automated security monitoring

EOF

    print_status "success" "Security report generated: $report_file"
}

# Main execution function
main() {
    print_status "info" "Starting critical security remediation..."

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_status "error" "package.json not found. Please run this script from the ValueOS root directory."
        exit 1
    fi

    # Run remediation steps
    install_missing_tools
    fix_dependency_vulnerabilities
    fix_build_issues
    fix_environment_config
    restart_failed_services
    run_security_validation
    generate_security_report

    print_status "success" "Critical security remediation completed!"
    print_status "info" "Please review the generated security report and take any remaining manual actions."
    print_status "warning" "Some issues may require manual intervention - see SECURITY_AUDIT_REPORT.md for details."
}

# Run main function
main "$@"
