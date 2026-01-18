#!/bin/bash
# ============================================================================
# Setup ECR Repositories for ValueOS Agents
# ============================================================================
# This script creates ECR repositories for all agent types
# Run this script with appropriate AWS credentials and region
# ============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Agent types that need ECR repositories
AGENT_TYPES=(
    "opportunity"
    "target"
    "realization"
    "expansion"
    "integrity"
    "company-intelligence"
    "financial-modeling"
    "value-mapping"
    "system-mapper"
    "intervention-designer"
    "outcome-engineer"
    "coordinator"
    "value-eval"
    "communicator"
    "research"
    "benchmark"
    "narrative"
    "groundtruth"
)

echo "Setting up ECR repositories for ValueOS agents..."
echo "Registry: ${REGISTRY}"
echo "Region: ${AWS_REGION}"
echo ""

# Authenticate Docker with ECR
echo "Authenticating Docker with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}

# Create repositories
for agent_type in "${AGENT_TYPES[@]}"; do
    repo_name="valuecanvas-${agent_type}"

    echo "Creating repository: ${repo_name}"

    # Check if repository already exists
    if aws ecr describe-repositories --repository-names ${repo_name} --region ${AWS_REGION} >/dev/null 2>&1; then
        echo "Repository ${repo_name} already exists, skipping..."
    else
        # Create repository
        aws ecr create-repository \
            --repository-name ${repo_name} \
            --region ${AWS_REGION} \
            --image-scanning-configuration scanOnPush=true \
            --image-tag-mutability IMMUTABLE \
            --tags Key=Project,Value=ValueOS Key=Component,Value=Agent Key=AgentType,Value=${agent_type}

        echo "Created repository: ${repo_name}"
    fi

    # Set lifecycle policy for cleaning up old images
    aws ecr put-lifecycle-configuration \
        --repository-name ${repo_name} \
        --lifecycle-policy-text '{
            "rules": [
                {
                    "rulePriority": 1,
                    "description": "Keep last 10 images",
                    "selection": {
                        "tagStatus": "any",
                        "countType": "imageCountMoreThan",
                        "countNumber": 10
                    },
                    "action": {
                        "type": "expire"
                    }
                }
            ]
        }' \
        --region ${AWS_REGION}

    echo "Set lifecycle policy for ${repo_name}"
    echo ""
done

echo "ECR setup complete!"
echo ""
echo "Repository URLs:"
for agent_type in "${AGENT_TYPES[@]}"; do
    repo_name="valuecanvas-${agent_type}"
    echo "${REGISTRY}/${repo_name}"
done
