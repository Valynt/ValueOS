# ValueCanvas Infrastructure Deployment Guide

Complete guide for deploying ValueCanvas infrastructure to AWS using Terraform and GitHub Actions.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Deployment Methods](#deployment-methods)
6. [GitHub Actions Setup](#github-actions-setup)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Cost Management](#cost-management)

## Overview

ValueCanvas uses a modern, cloud-native infrastructure stack:

- **Infrastructure as Code:** Terraform
- **Container Orchestration:** Amazon EKS (Kubernetes)
- **Database:** Supabase (managed PostgreSQL)
- **Cache:** Amazon ElastiCache (Redis)
- **Storage:** Amazon S3
- **CDN:** Amazon CloudFront
- **CI/CD:** GitHub Actions
- **Monitoring:** CloudWatch, DataDog (optional)

## Architecture

### High-Level Architecture

```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │      (CDN)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │       ALB       │
                    │   (HTTPS/SSL)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  EKS Cluster  │    │  EKS Cluster  │    │  EKS Cluster  │
│   (Node 1)    │    │   (Node 2)    │    │   (Node 3)    │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Supabase    │    │ ElastiCache   │    │      S3       │
│  (PostgreSQL) │    │    (Redis)    │    │   (Storage)   │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Network Architecture

```
VPC (10.0.0.0/16)
│
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24, 10.0.3.0/24)
│   ├── Internet Gateway
│   ├── NAT Gateways
│   └── Application Load Balancer
│
├── Private Subnets (10.0.10.0/24, 10.0.11.0/24, 10.0.12.0/24)
│   ├── EKS Worker Nodes
│   ├── Application Pods
│   └── ElastiCache Redis
│
└── Database Subnets (10.0.20.0/24, 10.0.21.0/24, 10.0.22.0/24)
    └── RDS PostgreSQL (if not using Supabase)
```

## Prerequisites

### Required Tools

```bash
# Terraform
terraform --version  # >= 1.5.0

# AWS CLI
aws --version  # >= 2.0

# kubectl
kubectl version  # >= 1.28

# jq (for JSON processing)
jq --version
```

### AWS Account Setup

1. **AWS Account** with appropriate permissions
2. **IAM User/Role** with permissions for:
   - VPC, EC2, EKS
   - RDS, ElastiCache
   - S3, CloudFront
   - IAM, Secrets Manager
   - CloudWatch

3. **S3 Bucket** for Terraform state
4. **DynamoDB Table** for state locking

### Domain & SSL

1. **Domain name** registered
2. **SSL certificate** in AWS Certificate Manager
3. **Route53 hosted zone** (optional but recommended)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/ValueCanvas.git
cd ValueCanvas
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS credentials
```

### 3. Create Terraform Backend

```bash
# Run the setup script
./infrastructure/terraform/scripts/setup-backend.sh
```

Or manually:

```bash
# Create S3 bucket
aws s3 mb s3://valuecanvas-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket valuecanvas-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table
aws dynamodb create-table \
  --table-name valuecanvas-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 4. Configure Secrets

```bash
cd infrastructure/terraform/environments/staging
cp secrets.tfvars.example secrets.tfvars
# Edit secrets.tfvars with your actual values
```

### 5. Deploy Staging

```bash
# Validate configuration
../../scripts/validate.sh

# Deploy
../../scripts/deploy-staging.sh
```

### 6. Verify Deployment

```bash
# Configure kubectl
aws eks update-kubeconfig \
  --name valuecanvas-staging-cluster \
  --region us-east-1

# Check nodes
kubectl get nodes

# Check pods
kubectl get pods -A
```

## Deployment Methods

### Method 1: Local Deployment (Manual)

**Use Case:** Initial setup, testing, troubleshooting

**Steps:**

```bash
cd infrastructure/terraform/environments/staging

# Initialize
terraform init

# Plan
terraform plan -var-file=terraform.tfvars -var-file=secrets.tfvars

# Apply
terraform apply -var-file=terraform.tfvars -var-file=secrets.tfvars
```

**Pros:**
- Full control
- Immediate feedback
- Easy debugging

**Cons:**
- Manual process
- No audit trail
- Requires local setup

### Method 2: GitHub Actions (Automated)

**Use Case:** Production deployments, team collaboration

**Staging Deployment:**

```bash
# Automatic on merge to develop
git checkout develop
git merge feature-branch
git push origin develop
```

**Production Deployment:**

1. Go to GitHub Actions
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Enter confirmation: `DEPLOY TO PRODUCTION`
5. Wait for approval
6. Monitor deployment

**Pros:**
- Automated
- Audit trail
- Team collaboration
- Safety checks

**Cons:**
- Requires GitHub setup
- Less immediate control

### Method 3: Terraform Cloud (Enterprise)

**Use Case:** Large teams, compliance requirements

See [Terraform Cloud documentation](https://www.terraform.io/cloud-docs) for setup.

## GitHub Actions Setup

### 1. Configure AWS OIDC

Create IAM roles for GitHub Actions:

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Create trust policy (`trust-policy.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/ValueCanvas:*"
        }
      }
    }
  ]
}
```

Create IAM roles:

```bash
# Staging role
aws iam create-role \
  --role-name GitHubActionsStaging \
  --assume-role-policy-document file://trust-policy.json

# Production role
aws iam create-role \
  --role-name GitHubActionsProduction \
  --assume-role-policy-document file://trust-policy.json
```

Attach policies:

```bash
# Attach AdministratorAccess (or custom policy)
aws iam attach-role-policy \
  --role-name GitHubActionsStaging \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 2. Configure GitHub Secrets

**Repository Settings → Secrets and variables → Actions**

Add these secrets:

**Staging:**
- `AWS_ROLE_ARN`
- `DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `TOGETHER_API_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `ACM_CERTIFICATE_ARN`

**Production:**
- `AWS_ROLE_ARN_PROD`
- `AWS_PROD_ACCOUNT_ID`
- `PROD_DB_PASSWORD`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`
- `PROD_SUPABASE_SERVICE_KEY`
- `PROD_TOGETHER_API_KEY`
- `PROD_OPENAI_API_KEY`
- `PROD_JWT_SECRET`
- `PROD_ACM_CERTIFICATE_ARN`
- `DATADOG_API_KEY`
- `PAGERDUTY_INTEGRATION_KEY`
- `SLACK_WEBHOOK_URL`

### 3. Configure GitHub Environments

**Settings → Environments**

**Staging Environment:**
- No protection rules
- Add staging secrets

**Production Environment:**
- Required reviewers: 2+ people
- Wait timer: 5 minutes
- Deployment branches: `main` only
- Add production secrets

### 4. Test Workflows

```bash
# Create a test PR
git checkout -b test-terraform
# Make a small change to terraform files
git commit -am "test: terraform validation"
git push origin test-terraform
# Create PR and verify workflows run
```

## Monitoring & Maintenance

### CloudWatch Dashboards

Access dashboards:

```bash
aws cloudwatch list-dashboards --region us-east-1
```

Key metrics:
- EKS node CPU/memory
- RDS connections
- Redis hit rate
- ALB request count
- Application error rates

### Logs

View logs:

```bash
# EKS logs
aws logs tail /aws/eks/valuecanvas-staging/api-gateway --follow

# Application logs
kubectl logs -f deployment/api-gateway -n valuecanvas-staging
```

### Drift Detection

Monitor drift:

```bash
# Manual drift check
cd infrastructure/terraform/environments/staging
terraform plan -var-file=terraform.tfvars -var-file=secrets.tfvars

# Check GitHub issues for automated drift detection
# Label: drift-detection
```

### Backups

**Automated:**
- RDS automated backups (30 days for production)
- S3 versioning enabled
- Terraform state versioning

**Manual:**

```bash
# Backup RDS
aws rds create-db-snapshot \
  --db-instance-identifier valuecanvas-production-postgres \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)

# Backup Terraform state
aws s3 cp s3://valuecanvas-terraform-state/production/terraform.tfstate \
  ./backups/terraform.tfstate.$(date +%Y%m%d)
```

### Updates

**Terraform:**

```bash
# Update Terraform
terraform init -upgrade

# Update providers
terraform init -upgrade
```

**EKS:**

```bash
# Update cluster version in terraform.tfvars
kubernetes_version = "1.29"

# Plan and apply
terraform plan
terraform apply
```

## Troubleshooting

### Common Issues

**1. State Lock Error**

```bash
# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

**2. AWS Credentials Error**

```bash
# Verify credentials
aws sts get-caller-identity

# Re-configure
aws configure
```

**3. EKS Nodes Not Joining**

```bash
# Check node group
aws eks describe-nodegroup \
  --cluster-name valuecanvas-staging-cluster \
  --nodegroup-name general

# View logs
kubectl logs -n kube-system -l k8s-app=aws-node
```

**4. Database Connection Failed**

```bash
# Test connection
psql -h <endpoint> -U valuecanvas -d valuecanvas

# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*valuecanvas*"
```

### Debug Mode

Enable Terraform debug logging:

```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform-debug.log
terraform apply
```

### Getting Help

1. Check workflow logs in GitHub Actions
2. Review CloudWatch logs
3. Check this documentation
4. Contact DevOps team

## Cost Management

### Estimated Monthly Costs

**Staging:**
- EKS Cluster: $73
- EC2 Nodes (2x t3.medium): $60
- RDS (db.t3.small): $30
- ElastiCache (cache.t3.micro): $12
- NAT Gateway: $32
- ALB: $16
- **Total: ~$223/month**

**Production:**
- EKS Cluster: $73
- EC2 Nodes (5x t3.large): $375
- RDS (db.r6g.xlarge): $290
- ElastiCache (cache.r6g.large): $150
- NAT Gateways (3): $96
- ALB: $16
- **Total: ~$1,000/month**

### Cost Optimization

**Staging:**
- Use spot instances
- Single NAT Gateway
- Smaller instance types
- Lower backup retention
- Scheduled shutdown (optional)

**Production:**
- Reserved instances for predictable workloads
- Savings plans
- Right-sizing based on metrics
- S3 lifecycle policies
- CloudFront caching

### Cost Monitoring

```bash
# View cost by service
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Security Best Practices

1. **Secrets Management:**
   - Use AWS Secrets Manager
   - Never commit secrets to git
   - Rotate secrets regularly

2. **Network Security:**
   - Private subnets for compute
   - Security groups with least privilege
   - VPC Flow Logs enabled

3. **Access Control:**
   - IAM roles with minimal permissions
   - MFA for production access
   - Audit logging enabled

4. **Encryption:**
   - EBS volumes encrypted
   - RDS encryption at rest
   - S3 bucket encryption
   - TLS/SSL for data in transit

## Next Steps

1. **Configure DNS:**
   - Point domain to ALB
   - Update Route53 records

2. **Enable Monitoring:**
   - Set up CloudWatch dashboards
   - Configure alerts
   - Integrate DataDog (optional)

3. **Deploy Applications:**
   - Build Docker images
   - Push to ECR
   - Deploy to EKS

4. **Set Up CI/CD:**
   - Configure application pipelines
   - Automate testing
   - Enable continuous deployment

## Support & Resources

- **Documentation:** [infrastructure/terraform/README.md](terraform/README.md)
- **Quick Start:** [infrastructure/terraform/QUICKSTART.md](terraform/QUICKSTART.md)
- **GitHub Actions:** [.github/workflows/README.md](../.github/workflows/README.md)
- **Terraform Docs:** https://www.terraform.io/docs
- **AWS EKS:** https://docs.aws.amazon.com/eks/
- **Kubernetes:** https://kubernetes.io/docs/

## Changelog

- **2024-12-06:** Initial infrastructure setup
  - Terraform modules created
  - GitHub Actions workflows implemented
  - Documentation completed
