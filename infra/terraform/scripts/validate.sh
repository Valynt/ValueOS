#!/bin/bash
# Terraform Configuration Validation Script
# Validates Terraform configurations before deployment

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Terraform Configuration Validation${NC}"
echo -e "${GREEN}========================================${NC}"

# Check Terraform installation
echo -e "\n${YELLOW}Checking Terraform installation...${NC}"
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}✗ Terraform is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    echo -e "${GREEN}✓ Terraform ${TERRAFORM_VERSION} installed${NC}"
fi

# Check AWS CLI
echo -e "\n${YELLOW}Checking AWS CLI...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    AWS_VERSION=$(aws --version | cut -d' ' -f1 | cut -d'/' -f2)
    echo -e "${GREEN}✓ AWS CLI ${AWS_VERSION} installed${NC}"
fi

# Check AWS credentials
echo -e "\n${YELLOW}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}✗ AWS credentials not configured${NC}"
    ERRORS=$((ERRORS + 1))
else
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}✓ AWS credentials configured (Account: ${ACCOUNT_ID})${NC}"
fi

# Validate each environment
for ENV in staging production; do
    echo -e "\n${YELLOW}Validating ${ENV} environment...${NC}"
    ENV_DIR="${TERRAFORM_DIR}/environments/${ENV}"
    
    if [ ! -d "${ENV_DIR}" ]; then
        echo -e "${RED}✗ Environment directory not found: ${ENV_DIR}${NC}"
        ERRORS=$((ERRORS + 1))
        continue
    fi
    
    cd "${ENV_DIR}"
    
    # Check required files
    if [ ! -f "terraform.tfvars" ]; then
        echo -e "${RED}✗ terraform.tfvars not found${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ terraform.tfvars exists${NC}"
    fi
    
    if [ ! -f "backend.tf" ]; then
        echo -e "${RED}✗ backend.tf not found${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ backend.tf exists${NC}"
    fi
    
    # Initialize (without backend)
    echo -e "${YELLOW}  Initializing Terraform...${NC}"
    if terraform init -backend=false &> /dev/null; then
        echo -e "${GREEN}  ✓ Initialization successful${NC}"
    else
        echo -e "${RED}  ✗ Initialization failed${NC}"
        ERRORS=$((ERRORS + 1))
        continue
    fi
    
    # Validate
    echo -e "${YELLOW}  Validating configuration...${NC}"
    if terraform validate &> /dev/null; then
        echo -e "${GREEN}  ✓ Validation successful${NC}"
    else
        echo -e "${RED}  ✗ Validation failed${NC}"
        terraform validate
        ERRORS=$((ERRORS + 1))
    fi
    
    # Format check
    echo -e "${YELLOW}  Checking formatting...${NC}"
    if terraform fmt -check -recursive &> /dev/null; then
        echo -e "${GREEN}  ✓ Formatting correct${NC}"
    else
        echo -e "${YELLOW}  ⚠ Formatting issues found (run 'terraform fmt -recursive')${NC}"
    fi
done

# Check modules
echo -e "\n${YELLOW}Validating modules...${NC}"
MODULES_DIR="${TERRAFORM_DIR}/modules"

if [ -d "${MODULES_DIR}" ]; then
    for MODULE in "${MODULES_DIR}"/*; do
        if [ -d "${MODULE}" ]; then
            MODULE_NAME=$(basename "${MODULE}")
            echo -e "${YELLOW}  Checking module: ${MODULE_NAME}...${NC}"
            
            cd "${MODULE}"
            
            if [ ! -f "main.tf" ]; then
                echo -e "${RED}  ✗ main.tf not found in ${MODULE_NAME}${NC}"
                ERRORS=$((ERRORS + 1))
                continue
            fi
            
            if [ ! -f "variables.tf" ]; then
                echo -e "${YELLOW}  ⚠ variables.tf not found in ${MODULE_NAME}${NC}"
            fi
            
            if [ ! -f "outputs.tf" ]; then
                echo -e "${YELLOW}  ⚠ outputs.tf not found in ${MODULE_NAME}${NC}"
            fi
            
            echo -e "${GREEN}  ✓ Module ${MODULE_NAME} structure valid${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ Modules directory not found${NC}"
fi

# Security checks (if tfsec is available)
if command -v tfsec &> /dev/null; then
    echo -e "\n${YELLOW}Running security scan...${NC}"
    cd "${TERRAFORM_DIR}"
    
    if tfsec . --soft-fail; then
        echo -e "${GREEN}✓ Security scan completed${NC}"
    else
        echo -e "${YELLOW}⚠ Security issues found (review above)${NC}"
    fi
else
    echo -e "\n${YELLOW}⚠ tfsec not installed (skipping security scan)${NC}"
    echo -e "  Install: brew install tfsec${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================${NC}"
if [ ${ERRORS} -eq 0 ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}✗ Validation failed with ${ERRORS} error(s)${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
