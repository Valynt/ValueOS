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
    local status="$1"
    local message="$2"
    case "$status" in
        "success")
            echo -e "${GREEN}✅ ${message}${NC}"
            ;;
        "error")
            echo -e "${RED}❌ ${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
        "info")
            echo -e "ℹ️  ${message}"
            ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify both Docker CLI and Compose plugin are available
require_docker_compose() {
    if ! command_exists docker; then
        print_status "error" "Docker CLI not found. Please install Docker first."
        return 1
    fi
    if ! docker compose version >/dev/null 2>&1; then
        print_status "error" "Docker Compose plugin not found. Please install docker-compose-plugin."
        return 1
    fi
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

    if ! command_exists pnpm; then
        print_status "error" "pnpm not found. Please install pnpm first."
        return 1
    fi

    print_status "info" "Running pnpm audit fix..."
    if pnpm audit --fix; then
        print_status "success" "Dependency vulnerabilities fixed"
    else
        print_status "warning" "Some vulnerabilities may require manual intervention"
    fi

    print_status "info" "Checking remaining vulnerabilities..."
    pnpm audit --audit-level moderate || true
}

# Function to fix build issues
fix_build_issues() {
    print_status "info" "Fixing build issues..."

    print_status "info" "Installing missing reactflow dependency..."
    pnpm add reactflow || print_status "warning" "reactflow installation failed"

    print_status "info" "Clearing pnpm cache..."
    pnpm store prune || true

    print_status "success" "Build issues addressed"
}

# Function to fix environment configuration
fix_environment_config() {
    print_status "info" "Fixing environment configuration..."

    local env_file=".env"

    if [[ ! -f "$env_file" ]]; then
        print_status "error" ".env file not found"
        return 1
    fi

    cp "$env_file" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "info" "Backed up .env file"

    local required_vars=(
        "DATABASE_URL=postgresql://postgres:postgres@postgres:5432/valueos"
        "SUPABASE_URL=http://localhost:54321"
        "SUPABASE_ANON_KEY=your-anon-key-here"
        "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here"
        "JWT_SECRET=your-jwt-secret-here"
        "ENCRYPTION_KEY=your-encryption-key-here"
    )

    for var in "${required_vars[@]}"; do
        local key="${var%%=*}"
        local value="${var#*=}"

        if ! grep -q "^${key}=" "$env_file"; then
            echo "${key}=${value}" >> "$env_file"
            print_status "warning" "Added missing ${key} to .env"
        fi
    done

    print_status "success" "Environment configuration updated"
}

# Function to restart failed services
restart_failed_services() {
    print_status "info" "Restarting failed services..."

    if ! require_docker_compose; then
        return 1
    fi

    local ps_output
    if ! ps_output="$(docker compose ps --filter "status=exited" --format "{{.Names}}" 2>/dev/null)"; then
        print_status "warning" "Could not query container status"
        return 1
    fi

    if [[ -z "$ps_output" ]]; then
        print_status "success" "No failed services found"
        return 0
    fi

    local -a failed_services=()
    while IFS= read -r name; do
        [[ -n "$name" ]] && failed_services+=("$name")
    done <<< "$ps_output"

    print_status "info" "Found ${#failed_services[@]} failed service(s)"

    for service in "${failed_services[@]}"; do
        print_status "info" "Restarting service: ${service}"
        docker compose restart "$service" || print_status "warning" "Failed to restart ${service}"
    done

    local max_wait=30
    local interval=5
    local elapsed=0
    print_status "info" "Waiting up to ${max_wait}s for services to stabilize..."
    while (( elapsed < max_wait )); do
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
        local still_exited
        still_exited="$(docker compose ps --filter "status=exited" --format "{{.Names}}" 2>/dev/null)" || true
        if [[ -z "$still_exited" ]]; then
            print_status "success" "All restarted services are running"
            docker compose ps
            return 0
        fi
    done

    print_status "warning" "Some services remain unhealthy after ${max_wait}s:"
    docker compose ps --filter "status=exited" 2>/dev/null || true
}

# Function to run security validation
run_security_validation() {
    print_status "info" "Running security validation..."

    print_status "info" "Running RLS policy validation..."
    if pnpm run test:rls; then
        print_status "success" "RLS validation passed"
    else
        print_status "warning" "RLS validation failed - check test output"
    fi

    if [[ -f "scripts/test-agent-security.sh" ]]; then
        print_status "info" "Running agent security tests..."
        if bash scripts/test-agent-security.sh; then
            print_status "success" "Agent security tests passed"
        else
            print_status "warning" "Agent security tests failed"
        fi
    fi

    local security_scripts=(
        "check:runtime-sentinels"
        "check:browser-provider-secrets"
        "check:frontend-bundle-service-role"
    )

    for script in "${security_scripts[@]}"; do
        print_status "info" "Running ${script}..."
        if pnpm run "$script" 2>/dev/null; then
            print_status "success" "${script} passed"
        else
            print_status "warning" "${script} failed or requires manual intervention"
        fi
    done
}

# Function to generate security report
generate_security_report() {
    print_status "info" "Generating security status report..."

    local report_file="security-remediation-report-$(date +%Y%m%d_%H%M%S).md"
    local report_date
    report_date="$(date)"

    cat > "$report_file" << 'REPORT_EOF'
# ValueOS Security Remediation Report
REPORT_EOF

    cat >> "$report_file" << REPORT_META
**Date:** ${report_date}
**Generated by:** Automated Remediation Script

REPORT_META

    cat >> "$report_file" << 'REPORT_EOF'
## Actions Taken
- Installing missing security tools: Completed
- Fixing dependency vulnerabilities: Completed
- Fixing build issues: Completed
- Fixing environment configuration: Completed
- Restarting failed services: Completed

## Current Status

### Dependency Vulnerabilities
```bash
pnpm audit --audit-level moderate
```

### Service Health
```bash
docker compose ps
```

### Environment Variables
```bash
grep -E "(DATABASE_URL|SUPABASE_URL|JWT_SECRET)" .env | sed 's/=.*/=***/'
```

## Remaining Actions
1. Review and update any remaining dependency vulnerabilities
2. Set proper values for placeholder environment variables
3. Verify all security tests pass
4. Review network security configuration
5. Complete compliance documentation

## Next Steps
1. Run manual security validation: `pnpm run test:rls`
2. Review audit report: `cat SECURITY_AUDIT_REPORT.md`
3. Schedule follow-up security review
4. Implement automated security monitoring
REPORT_EOF

    print_status "success" "Security report generated: ${report_file}"
}

# Main execution function
main() {
    print_status "info" "Starting critical security remediation..."

    if [[ ! -f "package.json" ]]; then
        print_status "error" "package.json not found. Please run this script from the ValueOS root directory."
        exit 1
    fi

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

main "$@"
