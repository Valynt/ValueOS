#!/bin/bash

# ============================================================================
# Terraform Validation Script
# ============================================================================
# Validates Terraform configuration locally before pushing
# ============================================================================

set -e

TERRAFORM_DIR="infrastructure/terraform"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           Terraform Validation                                       ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((CHECKS_FAILED++))
}

check_info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

# Check 1: Terraform installed
echo "🔍 Checking prerequisites..."
if command -v terraform &> /dev/null; then
    VERSION=$(terraform version -json | jq -r '.terraform_version')
    check_pass "Terraform installed (version $VERSION)"
else
    check_fail "Terraform not installed"
    echo ""
    echo "Install Terraform: https://www.terraform.io/downloads"
    exit 1
fi

# Check 2: Directory exists
echo ""
echo "📁 Checking directory structure..."
if [ -d "$TERRAFORM_DIR" ]; then
    check_pass "Terraform directory exists"
else
    check_fail "Terraform directory not found: $TERRAFORM_DIR"
    exit 1
fi

# Check 3: Required files exist
echo ""
echo "📋 Checking required files..."
REQUIRED_FILES=("main.tf" "variables.tf")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$TERRAFORM_DIR/$file" ]; then
        check_pass "File exists: $file"
    else
        check_fail "File missing: $file"
    fi
done

# Check 4: Terraform format
echo ""
echo "🎨 Checking Terraform formatting..."
cd "$TERRAFORM_DIR"

if terraform fmt -check -recursive > /dev/null 2>&1; then
    check_pass "All files properly formatted"
else
    check_fail "Files need formatting"
    echo ""
    echo -e "${YELLOW}Run this to fix:${NC}"
    echo "  cd $TERRAFORM_DIR && terraform fmt -recursive"
    echo ""
    echo "Files that need formatting:"
    terraform fmt -check -recursive
fi

# Check 5: Terraform init
echo ""
echo "🔧 Initializing Terraform..."
if terraform init -backend=false > /dev/null 2>&1; then
    check_pass "Terraform initialized successfully"
else
    check_fail "Terraform init failed"
    terraform init -backend=false
fi

# Check 6: Terraform validate
echo ""
echo "✅ Validating Terraform configuration..."
if terraform validate > /dev/null 2>&1; then
    check_pass "Configuration is valid"
else
    check_fail "Configuration validation failed"
    echo ""
    terraform validate
fi

# Check 7: Check for common issues
echo ""
echo "🔍 Checking for common issues..."

# Check for hardcoded secrets
if grep -r "password.*=.*\"" *.tf 2>/dev/null | grep -v "var\." | grep -v "TF_VAR" > /dev/null; then
    check_fail "Potential hardcoded secrets found"
    echo ""
    echo "Found potential hardcoded secrets:"
    grep -r "password.*=.*\"" *.tf | grep -v "var\." | grep -v "TF_VAR"
else
    check_pass "No hardcoded secrets detected"
fi

# Check for missing descriptions
MISSING_DESC=$(grep -c "description.*=.*\"\"" variables.tf 2>/dev/null || echo "0")
if [ "$MISSING_DESC" -gt 0 ]; then
    check_fail "Found $MISSING_DESC variables without descriptions"
else
    check_pass "All variables have descriptions"
fi

# Check for sensitive variables
SENSITIVE_VARS=$(grep -c "sensitive.*=.*true" variables.tf 2>/dev/null || echo "0")
check_info "Found $SENSITIVE_VARS sensitive variables"

# Check 8: Terraform plan (dry run)
echo ""
echo "📊 Running Terraform plan (dry run)..."
check_info "This requires AWS credentials and may take a moment..."

# Check if AWS credentials are available
if [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$AWS_PROFILE" ]; then
    check_info "AWS credentials not found - skipping plan"
    echo ""
    echo -e "${YELLOW}To run a full plan, set AWS credentials:${NC}"
    echo "  export AWS_ACCESS_KEY_ID=..."
    echo "  export AWS_SECRET_ACCESS_KEY=..."
    echo "  or"
    echo "  export AWS_PROFILE=..."
else
    # Set required variables for plan
    export TF_VAR_environment="staging"
    export TF_VAR_supabase_url="${TF_VAR_supabase_url:-https://example.supabase.co}"
    export TF_VAR_supabase_anon_key="${TF_VAR_supabase_anon_key:-dummy}"
    export TF_VAR_supabase_service_key="${TF_VAR_supabase_service_key:-dummy}"
    export TF_VAR_together_api_key="${TF_VAR_together_api_key:-dummy}"
    export TF_VAR_jwt_secret="${TF_VAR_jwt_secret:-dummy}"
    export TF_VAR_db_password="${TF_VAR_db_password:-dummy}"
    export TF_VAR_acm_certificate_arn="${TF_VAR_acm_certificate_arn:-arn:aws:acm:us-east-1:123456789012:certificate/dummy}"
    
    if terraform plan -no-color > plan_output.txt 2>&1; then
        check_pass "Terraform plan succeeded"
        
        # Extract metrics
        RESOURCES_TO_ADD=$(grep -c "will be created" plan_output.txt || echo "0")
        RESOURCES_TO_CHANGE=$(grep -c "will be updated" plan_output.txt || echo "0")
        RESOURCES_TO_DESTROY=$(grep -c "will be destroyed" plan_output.txt || echo "0")
        
        echo ""
        echo "Plan Summary:"
        echo "  🟢 Resources to create: $RESOURCES_TO_ADD"
        echo "  🟡 Resources to update: $RESOURCES_TO_CHANGE"
        echo "  🔴 Resources to destroy: $RESOURCES_TO_DESTROY"
        
        if [ "$RESOURCES_TO_DESTROY" -gt 0 ]; then
            echo ""
            echo -e "${YELLOW}⚠️  WARNING: This plan will destroy resources!${NC}"
        fi
        
        # Clean up
        rm -f plan_output.txt
    else
        check_fail "Terraform plan failed"
        echo ""
        cat plan_output.txt
        rm -f plan_output.txt
    fi
fi

# Summary
cd - > /dev/null
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                      Validation Summary                              ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo ""
    echo "Your Terraform configuration is ready to:"
    echo "  • Create a Pull Request"
    echo "  • Trigger automated plan in CI/CD"
    echo "  • Be reviewed by the team"
    exit 0
else
    echo -e "${RED}❌ Validation failed with $CHECKS_FAILED errors${NC}"
    echo ""
    echo "Please fix the issues above before creating a PR."
    exit 1
fi
