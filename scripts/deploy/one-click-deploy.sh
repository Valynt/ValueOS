#!/bin/bash

# ValueOS One-Click Deployment Script
# Usage: ./one-click-deploy.sh [staging|production]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
PROJECT_NAME="valueos"
AWS_REGION="us-east-1"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ValueOS One-Click Deployment                     ║${NC}"
echo -e "${BLUE}║       Environment: ${ENVIRONMENT}                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    print_error "Terraform not found. Install: https://www.terraform.io/downloads"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Install: https://www.docker.com/"
    exit 1
fi

print_success "All prerequisites met"

# Confirm production deployment
if [ "$ENVIRONMENT" = "production" ]; then
    print_warning "You are about to deploy to PRODUCTION"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Get current commit SHA
COMMIT_SHA=$(git rev-parse --short HEAD)
print_step "Deploying commit: $COMMIT_SHA"

# Build Docker images
print_step "Building Docker images..."

# Frontend
docker build -t ${PROJECT_NAME}-frontend:${COMMIT_SHA} -f Dockerfile.frontend .
print_success "Frontend image built"

# Backend
docker build -t ${PROJECT_NAME}-backend:${COMMIT_SHA} -f Dockerfile.backend .
print_success "Backend image built"

# Login to ECR
print_step "Logging in to Amazon ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com
print_success "Logged in to ECR"

# Tag and push images
print_step "Pushing images to ECR..."

ECR_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com

# Frontend
docker tag ${PROJECT_NAME}-frontend:${COMMIT_SHA} ${ECR_REGISTRY}/${PROJECT_NAME}-frontend:${COMMIT_SHA}
docker tag ${PROJECT_NAME}-frontend:${COMMIT_SHA} ${ECR_REGISTRY}/${PROJECT_NAME}-frontend:${ENVIRONMENT}-latest
docker push ${ECR_REGISTRY}/${PROJECT_NAME}-frontend:${COMMIT_SHA}
docker push ${ECR_REGISTRY}/${PROJECT_NAME}-frontend:${ENVIRONMENT}-latest
print_success "Frontend image pushed"

# Backend
docker tag ${PROJECT_NAME}-backend:${COMMIT_SHA} ${ECR_REGISTRY}/${PROJECT_NAME}-backend:${COMMIT_SHA}
docker tag ${PROJECT_NAME}-backend:${COMMIT_SHA} ${ECR_REGISTRY}/${PROJECT_NAME}-backend:${ENVIRONMENT}-latest
docker push ${ECR_REGISTRY}/${PROJECT_NAME}-backend:${COMMIT_SHA}
docker push ${ECR_REGISTRY}/${PROJECT_NAME}-backend:${ENVIRONMENT}-latest
print_success "Backend image pushed"

# Deploy infrastructure with Terraform
print_step "Deploying infrastructure with Terraform..."

cd infra/terraform/environments/${ENVIRONMENT}

terraform init -upgrade
terraform plan \
    -var="frontend_image=${ECR_REGISTRY}/${PROJECT_NAME}-frontend:${COMMIT_SHA}" \
    -var="backend_image=${ECR_REGISTRY}/${PROJECT_NAME}-backend:${COMMIT_SHA}" \
    -out=tfplan

read -p "Apply Terraform plan? (yes/no): " apply_confirm
if [ "$apply_confirm" = "yes" ]; then
    terraform apply tfplan
    print_success "Infrastructure deployed"
else
    print_warning "Terraform apply skipped"
    exit 0
fi

cd -

# Run database migrations
print_step "Running database migrations..."

CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
MIGRATION_TASK="${PROJECT_NAME}-${ENVIRONMENT}-migration"

TASK_ARN=$(aws ecs run-task \
    --cluster ${CLUSTER_NAME} \
    --task-definition ${MIGRATION_TASK} \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --filters "Name=tag:Environment,Values=${ENVIRONMENT}" --query 'Subnets[0].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-${ENVIRONMENT}-migration" --query 'SecurityGroups[0].GroupId' --output text)]}" \
    --query 'tasks[0].taskArn' \
    --output text)

echo "Waiting for migration task to complete..."
aws ecs wait tasks-stopped --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN}

EXIT_CODE=$(aws ecs describe-tasks --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN} --query 'tasks[0].containers[0].exitCode' --output text)

if [ "$EXIT_CODE" = "0" ]; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed with exit code: $EXIT_CODE"
    exit 1
fi

# Update ECS services
print_step "Updating ECS services..."

aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${PROJECT_NAME}-${ENVIRONMENT}-frontend \
    --force-new-deployment \
    --no-cli-pager

aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${PROJECT_NAME}-${ENVIRONMENT}-backend \
    --force-new-deployment \
    --no-cli-pager

print_success "ECS services updated"

# Wait for services to stabilize
print_step "Waiting for services to stabilize..."

aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services ${PROJECT_NAME}-${ENVIRONMENT}-frontend ${PROJECT_NAME}-${ENVIRONMENT}-backend

print_success "Services are stable"

# Health checks
print_step "Running health checks..."

if [ "$ENVIRONMENT" = "production" ]; then
    FRONTEND_URL="https://valueos.com"
    BACKEND_URL="https://api.valueos.com"
else
    FRONTEND_URL="https://staging.valueos.com"
    BACKEND_URL="https://api-staging.valueos.com"
fi

# Frontend health check
if curl -f -s ${FRONTEND_URL}/ > /dev/null; then
    print_success "Frontend is healthy"
else
    print_error "Frontend health check failed"
    exit 1
fi

# Backend health check
if curl -f -s ${BACKEND_URL}/health > /dev/null; then
    print_success "Backend is healthy"
else
    print_error "Backend health check failed"
    exit 1
fi

# Deployment summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deployment Successful! 🎉                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Commit:${NC} $COMMIT_SHA"
echo -e "${BLUE}Frontend:${NC} $FRONTEND_URL"
echo -e "${BLUE}Backend:${NC} $BACKEND_URL"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Monitor: https://grafana.valueos.com"
echo "  2. Logs: aws logs tail /ecs/${PROJECT_NAME}-${ENVIRONMENT} --follow"
echo "  3. Rollback: ./rollback.sh $ENVIRONMENT"
echo ""
