#!/bin/bash
###############################################################################
# Environment Setup Validation Script
# Validates that all required environment variables are configured
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
PASSED=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ValueOS Environment Configuration Validator           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${RED}✗ CRITICAL: .env.local file not found${NC}"
    echo "  Run: cp .env.example .env.local"
    exit 1
fi

source .env.local

# Function to check required variable
check_required() {
    local var_name=$1
    local var_value="${!var_name}"
    local default_value=$2

    if [ -z "$var_value" ]; then
        echo -e "${RED}✗ MISSING: $var_name${NC}"
        ((ERRORS++))
    elif [ "$var_value" = "$default_value" ]; then
        echo -e "${YELLOW}⚠ TODO: $var_name (using placeholder)${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓ OK: $var_name${NC}"
        ((PASSED++))
    fi
}

# Function to check optional variable
check_optional() {
    local var_name=$1
    local var_value="${!var_name}"

    if [ -z "$var_value" ]; then
        echo -e "${BLUE}ℹ OPTIONAL: $var_name (not set)${NC}"
    else
        echo -e "${GREEN}✓ OK: $var_name${NC}"
        ((PASSED++))
    fi
}

echo "Checking CRITICAL variables..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Critical variables
check_required "VITE_SUPABASE_URL" "https://your-project.supabase.co"
check_required "VITE_SUPABASE_ANON_KEY" "your-anon-key-here"
check_required "TOGETHER_API_KEY" "your-together-api-key-here"
check_required "JWT_SECRET" "CHANGE_ME_GENERATE_SECURE_SECRET"

echo ""
echo "Checking IMPORTANT variables..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Important variables
check_required "VITE_APP_URL" ""
check_required "VITE_API_BASE_URL" ""
check_required "DATABASE_URL" ""

echo ""
echo "Checking OPTIONAL variables..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Optional variables
check_optional "REDIS_URL"
check_optional "SMTP_HOST"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "${RED}✗ Errors: $ERRORS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo "Fix the errors above before proceeding."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  VALIDATION PASSED WITH WARNINGS${NC}"
    echo "Replace placeholder values before deploying to production."
    exit 0
else
    echo ""
    echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
    echo "Environment is properly configured."
    exit 0
fi
