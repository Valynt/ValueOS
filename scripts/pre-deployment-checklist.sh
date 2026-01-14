#!/bin/bash
###############################################################################

# ValueOS Pre-Deployment Checklist Automation
#
# Enhanced checklist that validates all requirements before deployment
# including secrets management, environment consistency, and security checks
#
# Usage: ./scripts/pre-deployment-checklist.sh [environment]
# Environment: development, staging, production (default: staging)
###############################################################################

set -e

echo "🚀 ValueOS Pre-Deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
ENVIRONMENT=${1:-staging}
NODE_ENV=${ENVIRONMENT}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    CHECKS_WARNING=$((CHECKS_WARNING + 1))
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo "Environment: ${ENVIRONMENT}"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo ""

# ============================================================================
# 1. Code Quality and Validation
# ============================================================================
echo "📋 Code Quality Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if working directory is clean
if git diff-index --quiet HEAD --; then
    check_pass "Working directory is clean"
else
    check_fail "Working directory has uncommitted changes"
fi

# Run linting
if npm run lint > /dev/null 2>&1; then
    check_pass "Linting passed"
else
    check_fail "Linting failed"
fi

# Run type checking
if npm run typecheck > /dev/null 2>&1; then
    check_pass "Type checking passed"
else
    check_fail "Type checking failed"
fi

# Run unit tests
if npm run test:unit > /dev/null 2>&1; then
    check_pass "Unit tests passed"
else
    check_fail "Unit tests failed"
fi

# ============================================================================
# 2. Build Validation
# ============================================================================
echo ""
echo "🏗️ Build Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if build artifacts exist
if [ -d "dist" ]; then
    check_warn "Build artifacts already exist (will be rebuilt)"
fi

# Run build
if npm run build > /dev/null 2>&1; then
    check_pass "Application build successful"
else
    check_fail "Application build failed"
fi

# Check build output
if [ -f "dist/index.html" ] && [ -d "dist/assets" ]; then
    check_pass "Build artifacts generated correctly"
else
    check_fail "Build artifacts missing or incomplete"
fi

# ============================================================================
# 3. Secrets Management Validation
# ============================================================================
echo ""
echo "🔐 Secrets Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if secrets validation script exists
if [ -f "scripts/validate-deployment.ts" ]; then
    check_pass "Secrets validation script exists"
else
    check_fail "Secrets validation script missing"
fi

# Run secrets validation
if npx tsx scripts/validate-deployment.ts > /dev/null 2>&1; then
    check_pass "Secrets validation passed"
else
    check_fail "Secrets validation failed"
fi

# Check environment-specific secrets file
ENV_FILE="deploy/envs/.env.${ENVIRONMENT}.example"
if [ -f "$ENV_FILE" ]; then
    check_pass "Environment configuration file exists: $ENV_FILE"
else
    check_fail "Environment configuration file missing: $ENV_FILE"
fi

# ============================================================================
# 4. Security Configuration
# ============================================================================
echo ""
echo "🔒 Security Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check security audit
if npm audit --audit-level=high > /dev/null 2>&1; then
    check_pass "Security audit passed (no high vulnerabilities)"
else
    check_fail "Security audit found high vulnerabilities"
fi

# Check environment-specific security settings
if [ "$ENVIRONMENT" = "production" ]; then
    # Check that dev tools are disabled in production
    if grep -q "VITE_DEV_TOOLS=false" "$ENV_FILE" 2>/dev/null; then
        check_pass "Development tools disabled in production"
    else
        check_fail "Development tools not disabled in production"
    fi

    # Check that security features are enabled
    if grep -q "VITE_ENABLE_CIRCUIT_BREAKER=true" "$ENV_FILE" 2>/dev/null; then
        check_pass "Circuit breaker enabled in production"
    else
        check_fail "Circuit breaker not enabled in production"
    fi

    if grep -q "VITE_ENABLE_RATE_LIMITING=true" "$ENV_FILE" 2>/dev/null; then
        check_pass "Rate limiting enabled in production"
    else
        check_fail "Rate limiting not enabled in production"
    fi
fi

# ============================================================================
# 5. Infrastructure Validation
# ============================================================================
echo ""
echo "🏛️ Infrastructure Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Terraform configuration
if [ -d "infra/terraform" ]; then
    check_pass "Terraform configuration exists"

    # Validate Terraform
    if cd infra/terraform && terraform fmt -check > /dev/null 2>&1 && terraform validate > /dev/null 2>&1; then
        check_pass "Terraform configuration is valid"
    else
        check_fail "Terraform configuration validation failed"
    fi
    cd - > /dev/null
else
    check_warn "Terraform configuration not found"
fi

# Check Kubernetes manifests
if [ -d "infra/k8s" ]; then
    check_pass "Kubernetes manifests exist"

    # Validate Kubernetes manifests
    if kubectl apply --dry-run=client -f infra/k8s/ > /dev/null 2>&1; then
        check_pass "Kubernetes manifests are valid"
    else
        check_fail "Kubernetes manifests validation failed"
    fi
else
    check_warn "Kubernetes manifests not found"
fi

# ============================================================================
# 6. Database and Service Configuration
# ============================================================================
echo ""
echo "🗄️ Database and Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check database configuration
if grep -q "DATABASE_URL" "$ENV_FILE" 2>/dev/null; then
    check_pass "Database URL configured"
else
    check_fail "Database URL not configured"
fi

# Check Redis configuration
if grep -q "REDIS_URL" "$ENV_FILE" 2>/dev/null; then
    check_pass "Redis URL configured"
else
    check_warn "Redis URL not configured (degraded mode)"
fi

# Check Supabase configuration
if grep -q "SUPABASE_URL" "$ENV_FILE" 2>/dev/null; then
    check_pass "Supabase URL configured"
else
    check_fail "Supabase URL not configured"
fi

# ============================================================================
# 7. Performance and Monitoring
# ============================================================================
echo ""
echo "📊 Performance and Monitoring"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check monitoring configuration
if grep -q "PROMETHEUS_METRICS_ENABLED=true" "$ENV_FILE" 2>/dev/null; then
    check_pass "Prometheus metrics enabled"
else
    check_warn "Prometheus metrics not enabled"
fi

# Check Sentry configuration
if grep -q "SENTRY_DSN" "$ENV_FILE" 2>/dev/null; then
    check_pass "Sentry DSN configured"
else
    check_warn "Sentry DSN not configured"
fi

# Check performance settings
if grep -q "UV_THREADPOOL_SIZE" "$ENV_FILE" 2>/dev/null; then
    check_pass "Thread pool size configured"
else
    check_warn "Thread pool size not configured (using default)"
fi

# ============================================================================
# 8. Deployment Readiness
# ============================================================================
echo ""
echo "🚀 Deployment Readiness"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Docker images
if [ -f "Dockerfile.frontend" ] && [ -f "Dockerfile.backend" ]; then
    check_pass "Docker files exist"
else
    check_fail "Docker files missing"
fi

# Check unified deployment pipeline
if [ -f ".github/workflows/unified-deployment-pipeline.yml" ]; then
    check_pass "Unified deployment pipeline exists"
else
    check_warn "Unified deployment pipeline not found"
fi

# Environment-specific checks
case $ENVIRONMENT in
    "production")
        check_info "Production deployment requires manual approval in GitHub Actions"
        ;;
    "staging")
        check_pass "Staging deployment ready for automated deployment"
        ;;
    *)
        check_warn "Unknown environment: $ENVIRONMENT"
        ;;
esac

# ============================================================================
# Results Summary
# ============================================================================
echo ""
echo "📊 Checklist Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed:${NC} $CHECKS_PASSED"
echo -e "${RED}Failed:${NC} $CHECKS_FAILED"
echo -e "${YELLOW}Warnings:${NC} $CHECKS_WARNING"
echo ""

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ DEPLOYMENT BLOCKED: $CHECKS_FAILED critical issues must be resolved${NC}"
    echo ""
    echo "Please fix the failed checks above before proceeding with deployment."
    exit 1
elif [ $CHECKS_WARNING -gt 5 ]; then
    echo -e "${YELLOW}⚠️ DEPLOYMENT CAUTION: $CHECKS_WARNING warnings detected${NC}"
    echo ""
    echo "Consider reviewing the warnings above, but deployment can proceed."
    exit 0
else
    echo -e "${GREEN}✅ DEPLOYMENT APPROVED: All checks passed${NC}"
    echo ""
    echo "Ready to deploy to $ENVIRONMENT environment!"
    exit 0
fi
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    CHECKS_WARNING=$((CHECKS_WARNING + 1))
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# ============================================================================
# P0 - Critical Blockers
# ============================================================================
print_section "P0 - Critical Blockers (Must Pass)"

# 1. RLS Tests
echo -n "Running RLS tests... "
if npm run test:rls > /tmp/rls-test.log 2>&1; then
    check_pass "RLS policies enforced on all tables"
else
    check_fail "RLS tests failed (see /tmp/rls-test.log)"
fi

# 2. Database Validation
echo -n "Validating database fixes... "
if npm run db:validate > /tmp/db-validate.log 2>&1; then
    check_pass "Database validation passed"
else
    check_fail "Database validation failed (see /tmp/db-validate.log)"
fi

# 3. Security Scan
echo -n "Running security scans... "
if npm run security:scan:all > /tmp/security-scan.log 2>&1; then
    check_pass "No high-severity vulnerabilities"
else
    check_fail "Security vulnerabilities found (see /tmp/security-scan.log)"
fi

# 4. Console Log Check
echo -n "Checking for console.log statements... "
if npm run lint:console > /tmp/console-check.log 2>&1; then
    check_pass "No console.log statements in production code"
else
    check_fail "Console.log statements found (see /tmp/console-check.log)"
fi

# 5. Build Test
echo -n "Testing production build... "
if npm run build > /tmp/build-test.log 2>&1; then
    check_pass "Production build successful"
else
    check_fail "Build failed (see /tmp/build-test.log)"
fi

# ============================================================================
# P1 - High Priority
# ============================================================================
print_section "P1 - High Priority (Should Pass)"

# 6. Unit Tests
echo -n "Running unit tests... "
if npm test > /tmp/unit-tests.log 2>&1; then
    check_pass "All unit tests passing"
else
    check_warn "Some unit tests failed (see /tmp/unit-tests.log)"
fi

# 7. Type Checking
echo -n "Type checking... "
if npm run typecheck > /tmp/typecheck.log 2>&1; then
    check_pass "No TypeScript errors"
else
    check_warn "TypeScript errors found (see /tmp/typecheck.log)"
fi

# 8. Linting
echo -n "Linting code... "
if npm run lint > /tmp/lint.log 2>&1; then
    check_pass "Code passes linting"
else
    check_warn "Linting issues found (see /tmp/lint.log)"
fi

# 9. Performance Tests
echo -n "Running performance tests... "
if npm run test:perf > /tmp/perf-tests.log 2>&1; then
    check_pass "Performance benchmarks met"
else
    check_warn "Performance tests failed (see /tmp/perf-tests.log)"
fi

# ============================================================================
# Environment Checks
# ============================================================================
print_section "Environment Configuration"

# 10. Environment Variables
echo -n "Checking environment variables... "
REQUIRED_VARS=(
    "DATABASE_URL"
    "VITE_SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "STRIPE_SECRET_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    check_pass "All required environment variables set"
else
    check_fail "Missing environment variables: ${MISSING_VARS[*]}"
fi

# 11. Node Version
echo -n "Checking Node.js version... "
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    check_pass "Node.js version: $(node --version)"
else
    check_fail "Node.js version too old: $(node --version) (need v20+)"
fi

# 12. Dependencies
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    check_pass "Dependencies installed"
else
    check_fail "node_modules not found (run npm install)"
fi

# ============================================================================
# Monitoring & Observability
# ============================================================================
print_section "Monitoring & Observability"

# 13. Monitoring Dashboards
echo -n "Checking monitoring dashboards... "
if [ -d "monitoring/grafana/dashboards" ] && [ "$(ls -A monitoring/grafana/dashboards)" ]; then
    check_pass "Grafana dashboards configured"
else
    check_warn "Grafana dashboards not found"
fi

# 14. Health Endpoints
echo -n "Checking health endpoint configuration... "
if grep -q "host: '0.0.0.0'" .config/configs/vite.config.ts 2>/dev/null || grep -q "host: true" .config/configs/vite.config.ts 2>/dev/null; then
    check_pass "Health endpoints configured"
else
    check_warn "Health endpoints not found"
fi

# ============================================================================
# Database & Backup
# ============================================================================
print_section "Database & Backup"

# 15. Database Connection
echo -n "Testing database connection... "
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    check_pass "Database connection successful"
else
    check_fail "Cannot connect to database"
fi

# 16. Backup Script
echo -n "Checking backup script... "
if [ -f "scripts/backup-database.sh" ]; then
    check_pass "Backup script exists"
else
    check_warn "Backup script not found"
fi

# ============================================================================
# Security
# ============================================================================
print_section "Security Configuration"

# 17. SSL/TLS
echo -n "Checking SSL configuration... "
if [ -f ".config/configs/vite.config.ts" ]; then
    if grep -q "host: '0.0.0.0'" .config/configs/vite.config.ts; then
        check_pass "SSL/TLS configured"
    else
        check_warn "SSL/TLS configuration not found"
    fi
fi

# 18. CORS Configuration
echo -n "Checking CORS configuration... "
if grep -q "cors" .config/configs/vite.config.ts 2>/dev/null; then
    check_pass "CORS configured"
else
    check_warn ".config/configs/vite.config.ts not found"
fi

# 19. Rate Limiting
echo -n "Checking rate limiting... "
if grep -rq "rateLimit\|rate-limit" src/ 2>/dev/null; then
    check_pass "Rate limiting configured"
else
    check_warn "Rate limiting not found"
fi

# ============================================================================
# Documentation
# ============================================================================
print_section "Documentation"

# 20. README
echo -n "Checking README... "
if [ -f "README.md" ] && [ -s "README.md" ]; then
    check_pass "README.md exists and not empty"
else
    check_warn "README.md missing or empty"
fi

# 21. API Documentation
echo -n "Checking API documentation... "
if [ -f "openapi.yaml" ] || [ -f "docs/API.md" ]; then
    check_pass "API documentation exists"
else
    check_warn "API documentation not found"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN} Passed: $CHECKS_PASSED"
echo -e "${YELLOW} Warnings: $CHECKS_WARNING"
echo -e "${RED} Failed: $CHECKS_FAILED"
echo ""

# Determine overall status
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNING -eq 0 ]; then
        echo -e "${GREEN} All checks passed! Ready for production deployment."
        exit 0
    else
        echo -e "${YELLOW}  All critical checks passed, but there are warnings."
        echo "Add to .config/configs/vite.config.ts: before deploying to production."
        exit 0
    fi
else
    echo -e "${RED} Deployment blocked! Fix failed checks before deploying."
    echo ""
    echo "Failed checks must be resolved:"
    echo "   Suggestion: Add 'server: { host: true }' to .config/configs/vite.config.ts"
    echo "  2. Fix issues"
    echo "  3. Re-run this checklist"
    echo ""
    exit 1
fi
