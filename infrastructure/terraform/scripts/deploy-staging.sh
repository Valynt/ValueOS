#!/bin/bash
# ValueCanvas Staging Deployment Script
# Deploys infrastructure to AWS staging environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="staging"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="${TERRAFORM_DIR}/environments/${ENVIRONMENT}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ValueCanvas Staging Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

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

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Navigate to environment directory
cd "${ENV_DIR}"

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
terraform fmt -check -recursive || {
    echo -e "${YELLOW}Warning: Formatting issues found. Run 'terraform fmt -recursive' to fix${NC}"
}

# Plan
echo -e "\n${YELLOW}Creating Terraform plan...${NC}"
terraform plan -out=tfplan -var-file=terraform.tfvars

# Confirm deployment
echo -e "\n${YELLOW}Review the plan above.${NC}"
read -p "Do you want to apply this plan? (yes/no): " -r
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
    echo -e "\n${GREEN}Outputs saved to outputs.json${NC}"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}Deployment failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi

# Cleanup
rm -f tfplan

echo -e "\n${GREEN}Next steps:${NC}"
echo -e "1. Configure kubectl: aws eks update-kubeconfig --name \$(terraform output -raw eks_cluster_name) --region us-east-1"
echo -e "2. Deploy applications: kubectl apply -f ../../k8s/staging/"
echo -e "3. Verify deployment: kubectl get pods -n valuecanvas-staging"
