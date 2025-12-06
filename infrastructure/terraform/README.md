# ValueCanvas Terraform Infrastructure

Infrastructure as Code (IaC) for deploying ValueCanvas to AWS using Terraform.

## Overview

This Terraform configuration provisions a production-ready, highly available infrastructure for ValueCanvas on AWS, including:

- **Networking**: VPC with public, private, and database subnets across multiple AZs
- **Compute**: EKS cluster with auto-scaling node groups
- **Database**: RDS PostgreSQL (or Supabase integration)
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 buckets for backups and static assets
- **CDN**: CloudFront distribution
- **Load Balancing**: Application Load Balancer with SSL/TLS
- **Monitoring**: CloudWatch logs, metrics, and alarms
- **Security**: IAM roles, security groups, secrets management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  CloudFront  │
              │     (CDN)    │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │     ALB      │
              │  (HTTPS)     │
              └──────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  Public       │         │  Public       │
│  Subnet       │         │  Subnet       │
│  (AZ-1)       │         │  (AZ-2)       │
└───────┬───────┘         └───────┬───────┘
        │                         │
        │   ┌─────────────────┐   │
        └───┤   NAT Gateway   ├───┘
            └────────┬────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  Private      │         │  Private      │
│  Subnet       │         │  Subnet       │
│  (EKS Nodes)  │         │  (EKS Nodes)  │
└───────┬───────┘         └───────┬───────┘
        │                         │
        │   ┌─────────────────┐   │
        └───┤   EKS Cluster   ├───┘
            │  (Kubernetes)   │
            └────────┬────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  Database     │         │  Database     │
│  Subnet       │         │  Subnet       │
│  (RDS/Redis)  │         │  (RDS/Redis)  │
└───────────────┘         └───────────────┘
```

## Prerequisites

### Required Tools

- **Terraform** >= 1.5.0
- **AWS CLI** >= 2.0
- **kubectl** >= 1.28
- **jq** (for JSON processing)

### AWS Account Setup

1. **AWS Account** with appropriate permissions
2. **IAM User** or Role with permissions for:
   - VPC, EC2, EKS
   - RDS, ElastiCache
   - S3, CloudFront
   - IAM, Secrets Manager
   - CloudWatch

3. **S3 Bucket** for Terraform state:
   ```bash
   aws s3 mb s3://valuecanvas-terraform-state --region us-east-1
   aws s3api put-bucket-versioning \
     --bucket valuecanvas-terraform-state \
     --versioning-configuration Status=Enabled
   ```

4. **DynamoDB Table** for state locking:
   ```bash
   aws dynamodb create-table \
     --table-name valuecanvas-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST \
     --region us-east-1
   ```

### Secrets Configuration

Create a `secrets.tfvars` file (DO NOT commit to git):

```hcl
# Database
db_password = "your-secure-password"

# Supabase
supabase_url         = "https://your-project.supabase.co"
supabase_anon_key    = "your-anon-key"
supabase_service_key = "your-service-key"

# LLM Providers
together_api_key = "your-together-api-key"
openai_api_key   = "your-openai-api-key"

# Security
jwt_secret = "your-jwt-secret"

# SSL Certificate
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

## Directory Structure

```
terraform/
├── main.tf                 # Root configuration
├── variables.tf            # Variable definitions
├── outputs.tf              # Output definitions
├── versions.tf             # Provider versions
├── modules/                # Reusable modules
│   ├── vpc/               # VPC module
│   ├── eks/               # EKS cluster module
│   ├── rds/               # RDS database module
│   ├── redis/             # ElastiCache Redis module
│   ├── alb/               # Application Load Balancer
│   ├── s3/                # S3 buckets
│   ├── cloudfront/        # CloudFront CDN
│   └── monitoring/        # CloudWatch monitoring
├── environments/           # Environment-specific configs
│   ├── staging/
│   │   ├── backend.tf     # State backend config
│   │   ├── terraform.tfvars
│   │   └── secrets.tfvars (gitignored)
│   └── production/
│       ├── backend.tf
│       ├── terraform.tfvars
│       └── secrets.tfvars (gitignored)
└── scripts/               # Deployment scripts
    ├── deploy-staging.sh
    ├── deploy-production.sh
    ├── destroy-staging.sh
    └── validate.sh
```

## Deployment

### Staging Environment

1. **Navigate to staging directory:**
   ```bash
   cd infrastructure/terraform/environments/staging
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Review the plan:**
   ```bash
   terraform plan -var-file=terraform.tfvars -var-file=secrets.tfvars
   ```

4. **Deploy using script:**
   ```bash
   ../../scripts/deploy-staging.sh
   ```

   Or manually:
   ```bash
   terraform apply -var-file=terraform.tfvars -var-file=secrets.tfvars
   ```

### Production Environment

⚠️ **Production deployments require extra caution**

1. **Navigate to production directory:**
   ```bash
   cd infrastructure/terraform/environments/production
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Review the plan carefully:**
   ```bash
   terraform plan -var-file=terraform.tfvars -var-file=secrets.tfvars
   ```

4. **Deploy using script (recommended):**
   ```bash
   ../../scripts/deploy-production.sh
   ```

   The script includes:
   - AWS account verification
   - State backup
   - Security scanning (if tfsec installed)
   - Multiple confirmation prompts
   - Deployment record keeping

## Configuration

### Environment Variables

Key variables in `terraform.tfvars`:

```hcl
# General
environment = "staging"  # or "production"
aws_region  = "us-east-1"

# VPC
vpc_cidr = "10.1.0.0/16"

# EKS
kubernetes_version      = "1.28"
eks_node_instance_types = ["t3.medium"]
eks_node_desired_size   = 2
eks_node_min_size       = 2
eks_node_max_size       = 5

# Database
use_supabase         = true
db_instance_class    = "db.t3.small"
db_allocated_storage = 50

# Redis
redis_node_type = "cache.t3.micro"

# Application
agent_replicas        = 1
orchestrator_replicas = 2
api_gateway_replicas  = 2
```

### Scaling Configuration

**Staging:**
- Minimal resources for cost optimization
- Single NAT Gateway
- Smaller instance types
- Lower replica counts

**Production:**
- High availability across multiple AZs
- NAT Gateway per AZ
- Larger instance types
- Higher replica counts
- Auto-scaling enabled
- Multi-AZ database

## Outputs

After deployment, Terraform provides:

```hcl
vpc_id                 # VPC identifier
eks_cluster_endpoint   # EKS API endpoint
eks_cluster_name       # EKS cluster name
database_endpoint      # Database connection endpoint
redis_endpoint         # Redis connection endpoint
alb_dns_name          # Load balancer DNS
ecr_repositories      # Container registry URLs
```

Access outputs:
```bash
terraform output
terraform output -json > outputs.json
```

## Post-Deployment

### Configure kubectl

```bash
aws eks update-kubeconfig \
  --name $(terraform output -raw eks_cluster_name) \
  --region us-east-1
```

### Verify Cluster

```bash
kubectl get nodes
kubectl get namespaces
```

### Deploy Applications

```bash
kubectl apply -f ../../k8s/staging/
# or
kubectl apply -f ../../k8s/production/
```

## Monitoring

### CloudWatch Dashboards

Access CloudWatch dashboards:
```bash
aws cloudwatch list-dashboards --region us-east-1
```

### Logs

View logs:
```bash
aws logs tail /aws/eks/valuecanvas-staging/api-gateway --follow
```

### Metrics

Key metrics to monitor:
- EKS node CPU/memory utilization
- RDS connections and query performance
- Redis hit rate
- ALB request count and latency
- Application error rates

## Maintenance

### Updates

1. **Update Terraform:**
   ```bash
   terraform init -upgrade
   ```

2. **Update EKS:**
   - Update `kubernetes_version` in tfvars
   - Plan and apply changes
   - Update node groups

3. **Update RDS:**
   - Update `engine_version` in module
   - Plan during maintenance window
   - Apply with minimal downtime

### Backups

**Automated:**
- RDS automated backups (30 days retention for production)
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

## Disaster Recovery

### State Recovery

If state is corrupted:
```bash
# List state versions
aws s3api list-object-versions \
  --bucket valuecanvas-terraform-state \
  --prefix production/terraform.tfstate

# Restore specific version
aws s3api get-object \
  --bucket valuecanvas-terraform-state \
  --key production/terraform.tfstate \
  --version-id <VERSION_ID> \
  terraform.tfstate
```

### Infrastructure Recovery

1. Restore from backup
2. Re-run terraform apply
3. Restore database from snapshot
4. Redeploy applications

## Cost Optimization

### Staging

- Use spot instances where possible
- Single NAT Gateway
- Smaller instance types
- Lower backup retention
- Scheduled shutdown (optional)

### Production

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

## Security

### Best Practices

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

### Security Scanning

```bash
# Install tfsec
brew install tfsec

# Scan configuration
tfsec .

# Install checkov
pip install checkov

# Scan with checkov
checkov -d .
```

## Troubleshooting

### Common Issues

**1. State Lock:**
```bash
# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

**2. Resource Already Exists:**
```bash
# Import existing resource
terraform import aws_vpc.main vpc-xxxxx
```

**3. EKS Node Group Issues:**
```bash
# Check node group status
aws eks describe-nodegroup \
  --cluster-name valuecanvas-staging-cluster \
  --nodegroup-name general

# View node logs
kubectl logs -n kube-system -l k8s-app=aws-node
```

**4. Database Connection:**
```bash
# Test connection
psql -h <endpoint> -U valuecanvas -d valuecanvas

# Check security groups
aws ec2 describe-security-groups \
  --group-ids <sg-id>
```

### Debug Mode

Enable Terraform debug logging:
```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform-debug.log
terraform apply
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Terraform Init
        run: terraform init
        working-directory: infrastructure/terraform/environments/staging
        
      - name: Terraform Plan
        run: terraform plan
        working-directory: infrastructure/terraform/environments/staging
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Support

For issues or questions:
1. Check this documentation
2. Review Terraform logs
3. Check AWS CloudWatch logs
4. Contact DevOps team

## References

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
