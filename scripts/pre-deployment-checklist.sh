#!/bin/bash
###############################################################################
# Pre-Deployment Checklist Automation
# Validates all requirements before production deployment
###############################################################################

set -e

echo "🚀 Pre-Deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

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
if grep -q "/health" src/backend/server.ts 2>/dev/null || grep -q "/health" src/api/*.ts 2>/dev/null; then
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
if [ -f "Caddyfile" ] && grep -q "tls" Caddyfile; then
    check_pass "SSL/TLS configured"
else
    check_warn "SSL/TLS configuration not found"
fi

# 18. CORS Configuration
echo -n "Checking CORS configuration... "
if grep -q "cors" vite.config.ts 2>/dev/null; then
    check_pass "CORS configured"
else
    check_warn "CORS configuration not found"
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
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Passed:${NC} $CHECKS_PASSED"
echo -e "${YELLOW}⚠ Warnings:${NC} $CHECKS_WARNING"
echo -e "${RED}✗ Failed:${NC} $CHECKS_FAILED"
echo ""

# Determine overall status
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNING -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  All critical checks passed, but there are warnings.${NC}"
        echo "Review warnings before deploying to production."
        exit 0
    fi
else
    echo -e "${RED}❌ Deployment blocked! Fix failed checks before deploying.${NC}"
    echo ""
    echo "Failed checks must be resolved:"
    echo "  1. Review log files in /tmp/"
    echo "  2. Fix issues"
    echo "  3. Re-run this checklist"
    echo ""
    exit 1
fi
