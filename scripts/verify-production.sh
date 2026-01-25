#!/bin/bash
# ============================================================================
# Production Readiness Verification Script
# ============================================================================
# Usage: ./scripts/verify-production.sh [environment]
# Example: ./scripts/verify-production.sh staging
#          ./scripts/verify-production.sh production
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment
ENVIRONMENT=${1:-staging}

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}ValueCanvas Production Readiness Check${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo -e "${GREEN}✓${NC} Loading environment from .env.$ENVIRONMENT"
    export $(cat ".env.$ENVIRONMENT" | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC} Using default .env file"
    export $(cat ".env" | grep -v '^#' | xargs)
else
    echo -e "${RED}✗${NC} No environment file found"
    exit 1
fi

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗${NC} DATABASE_URL not set"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database URL configured"
echo ""

# Function to run SQL verification
run_verification() {
    echo -e "${BLUE}Running SQL verification checks...${NC}"
    echo ""
    
    psql "$DATABASE_URL" -f scripts/verify-production-readiness.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓${NC} SQL verification completed"
        return 0
    else
        echo ""
        echo -e "${RED}✗${NC} SQL verification failed"
        return 1
    fi
}

# Function to check RLS policies via npm
check_rls_tests() {
    echo -e "${BLUE}Running RLS policy tests...${NC}"
    echo ""
    
    if npm run test:rls 2>&1 | tee /tmp/rls-test-output.log; then
        echo -e "${GREEN}✓${NC} RLS tests passed"
        return 0
    else
        echo -e "${RED}✗${NC} RLS tests failed"
        echo ""
        echo "Review output above for details"
        return 1
    fi
}

# Function to verify Supabase configuration
check_supabase_config() {
    echo -e "${BLUE}Checking Supabase configuration...${NC}"
    echo ""
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} Supabase CLI not installed (skipping Supabase checks)"
        return 0
    fi
    
    # Check project link status
    if supabase status &> /dev/null; then
        echo -e "${GREEN}✓${NC} Supabase project linked"
    else
        echo -e "${YELLOW}⚠${NC} Supabase project not linked (run: npm run db:link)"
    fi
    
    echo ""
}

# Function to verify Edge Functions
check_edge_functions() {
    echo -e "${BLUE}Verifying Edge Functions...${NC}"
    echo ""
    
    local functions_dir="supabase/functions"
    
    if [ ! -d "$functions_dir" ]; then
        echo -e "${YELLOW}⚠${NC} No Edge Functions directory found"
        return 0
    fi
    
    # List all Edge Functions
    local function_count=$(find "$functions_dir" -mindepth 1 -maxdepth 1 -type d ! -name "_shared" | wc -l)
    
    if [ $function_count -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Found $function_count Edge Functions:"
        find "$functions_dir" -mindepth 1 -maxdepth 1 -type d ! -name "_shared" -exec basename {} \; | while read func; do
            echo "  - $func"
        done
        
        echo ""
        echo -e "${YELLOW}⚠${NC} Manual verification required:"
        echo "  1. Ensure all functions have secrets configured"
        echo "  2. Test each function with actual user JWTs"
        echo "  3. Verify tenant isolation in function code"
    else
        echo -e "${YELLOW}⚠${NC} No Edge Functions found"
    fi
    
    echo ""
}

# Function to check security configuration
check_security() {
    echo -e "${BLUE}Checking security configuration...${NC}"
    echo ""
    
    # Check for secrets manager configuration
    if [ "$SECRETS_MANAGER_ENABLED" = "true" ]; then
        echo -e "${GREEN}✓${NC} Secrets manager enabled (provider: ${SECRETS_PROVIDER:-not set})"
    else
        echo -e "${YELLOW}⚠${NC} Secrets manager disabled (not recommended for production)"
    fi
    
    # Check for sensitive values in .env (should not be in git)
    if grep -q "SUPABASE_SERVICE_KEY.*sk_" .env* 2>/dev/null; then
        echo -e "${RED}✗${NC} Production service keys found in .env files (security risk!)"
    else
        echo -e "${GREEN}✓${NC} No production keys in .env files"
    fi

    if [ "$DEV_MOCKS_ENABLED" != "false" ]; then
        echo -e "${RED}✗${NC} DEV_MOCKS_ENABLED must be false in production"
        return 1
    else
        echo -e "${GREEN}✓${NC} DEV_MOCKS_ENABLED is disabled in production"
    fi
    
    echo ""
}

# Function to generate deployment report
generate_report() {
    local report_file="reports/production-readiness-$(date +%Y%m%d-%H%M%S).txt"
    
    echo -e "${BLUE}Generating deployment report...${NC}"
    
    mkdir -p reports
    
    {
        echo "=========================================="
        echo "Production Readiness Report"
        echo "Environment: $ENVIRONMENT"
        echo "Date: $(date)"
        echo "=========================================="
        echo ""
        
        echo "Database Verification:"
        psql "$DATABASE_URL" -c "SELECT * FROM security.verify_rls_enabled();" 2>&1
        echo ""
        
        echo "Health Check:"
        psql "$DATABASE_URL" -c "SELECT * FROM security.health_check();" 2>&1
        echo ""
        
        echo "Service Role Operations (Last 7 Days):"
        psql "$DATABASE_URL" -c "SELECT count(*) as total, count(DISTINCT service_role) as roles FROM audit.activity_log WHERE is_service_operation = TRUE AND timestamp > NOW() - INTERVAL '7 days';" 2>&1
        echo ""
        
    } > "$report_file"
    
    echo -e "${GREEN}✓${NC} Report saved to: $report_file"
    echo ""
}

# Main execution
main() {
    local failures=0
    
    # Run all checks
    run_verification || ((failures++))
    check_rls_tests || ((failures++))
    check_supabase_config || ((failures++))
    check_edge_functions || ((failures++))
    check_security || ((failures++))
    
    # Generate report
    generate_report
    
    # Final summary
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}Final Summary${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
    
    if [ $failures -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review the detailed report in reports/"
        echo "  2. Complete manual verification items in PRE_PRODUCTION_CHECKLIST.md"
        echo "  3. Configure monitoring alerts"
        echo "  4. Get deployment sign-off from team leads"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ $failures check(s) failed${NC}"
        echo ""
        echo "Action required:"
        echo "  1. Review error messages above"
        echo "  2. Fix identified issues"
        echo "  3. Re-run this script"
        echo "  4. See: docs/deployment/PRE_PRODUCTION_CHECKLIST.md"
        echo ""
        exit 1
    fi
}

# Run main function
main
