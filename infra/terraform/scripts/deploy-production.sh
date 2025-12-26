#!/bin/bash
# ValueCanvas Production Deployment Script
# Deploys infrastructure to AWS production environment with safety checks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="production"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="${TERRAFORM_DIR}/environments/${ENVIRONMENT}"
BACKUP_DIR="${TERRAFORM_DIR}/backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${RED}========================================${NC}"
echo -e "${RED}ValueCanvas PRODUCTION Deployment${NC}"
echo -e "${RED}========================================${NC}"
echo -e "${YELLOW}⚠️  WARNING: This will modify PRODUCTION infrastructure${NC}"

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: Terraform is not installed${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Verify we're in the correct AWS account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

read -p "Is this the correct PRODUCTION AWS account? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Deployment cancelled - wrong AWS account${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Navigate to environment directory
cd "${ENV_DIR}"

# Backup current state
echo -e "\n${YELLOW}Backing up current state...${NC}"
if [ -f "terraform.tfstate" ]; then
    cp terraform.tfstate "${BACKUP_DIR}/terraform.tfstate.backup"
    echo -e "${GREEN}✓ State backed up to ${BACKUP_DIR}${NC}"
fi

# Initialize Terraform
echo -e "\n${YELLOW}Initializing Terraform...${NC}"
terraform init -upgrade

# Validate configuration
echo -e "\n${YELLOW}Validating Terraform configuration...${NC}"
terraform validate

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Terraform validation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Validation passed${NC}"

# Format check
echo -e "\n${YELLOW}Checking Terraform formatting...${NC}"
if ! terraform fmt -check -recursive; then
    echo -e "${RED}Error: Formatting issues found. Run 'terraform fmt -recursive' to fix${NC}"
    exit 1
fi

# Security scan (if tfsec is installed)
if command -v tfsec &> /dev/null; then
    echo -e "\n${YELLOW}Running security scan...${NC}"
    tfsec . || {
        echo -e "${YELLOW}Warning: Security issues found${NC}"
        read -p "Continue anyway? (yes/no): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo -e "${RED}Deployment cancelled${NC}"
            exit 1
        fi
    }
fi

# Plan
echo -e "\n${YELLOW}Creating Terraform plan...${NC}"
terraform plan -out=tfplan -var-file=terraform.tfvars

# Save plan for review
terraform show -json tfplan > "${BACKUP_DIR}/tfplan.json"
echo -e "${GREEN}✓ Plan saved to ${BACKUP_DIR}/tfplan.json${NC}"

# Confirm deployment
echo -e "\n${RED}========================================${NC}"
echo -e "${RED}PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
echo -e "${RED}========================================${NC}"
echo -e "${YELLOW}Review the plan above carefully.${NC}"
echo -e "${YELLOW}This will modify PRODUCTION infrastructure.${NC}"
echo -e "${YELLOW}Backup saved to: ${BACKUP_DIR}${NC}"
echo

read -p "Type 'DEPLOY TO PRODUCTION' to continue: " -r
echo

if [[ $REPLY != "DEPLOY TO PRODUCTION" ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    rm -f tfplan
    exit 0
fi

# Final confirmation
read -p "Are you absolutely sure? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    rm -f tfplan
    exit 0
fi

# Apply
echo -e "\n${YELLOW}Applying Terraform configuration...${NC}"
terraform apply tfplan

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Show outputs
    echo -e "\n${YELLOW}Infrastructure Outputs:${NC}"
    terraform output
    
    # Save outputs to file
    terraform output -json > outputs.json
    terraform output -json > "${BACKUP_DIR}/outputs.json"
    echo -e "\n${GREEN}Outputs saved to outputs.json and ${BACKUP_DIR}/outputs.json${NC}"
    
    # Create deployment record
    cat > "${BACKUP_DIR}/deployment-info.txt" << EOF
Deployment Date: $(date)
AWS Account: ${ACCOUNT_ID}
Environment: ${ENVIRONMENT}
Deployed By: $(aws sts get-caller-identity --query Arn --output text)
Terraform Version: $(terraform version -json | jq -r '.terraform_version')
EOF
    
    echo -e "${GREEN}✓ Deployment record saved${NC}"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}Deployment failed!${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${YELLOW}Backup available at: ${BACKUP_DIR}${NC}"
    exit 1
fi

# Cleanup
rm -f tfplan

echo -e "\n${GREEN}Next steps:${NC}"
echo -e "1. Configure kubectl: aws eks update-kubeconfig --name \$(terraform output -raw eks_cluster_name) --region us-east-1"
echo -e "2. Verify cluster: kubectl get nodes"
echo -e "3. Deploy applications: kubectl apply -f ../../k8s/production/"
echo -e "4. Monitor deployment: kubectl get pods -n valuecanvas-production -w"
echo -e "5. Run smoke tests: ./run-smoke-tests.sh"
echo -e "\n${YELLOW}Backup location: ${BACKUP_DIR}${NC}"
