# Terraform Quick Start Guide

Get ValueCanvas infrastructure up and running in 15 minutes.

## Prerequisites Checklist

- [ ] AWS Account with admin access
- [ ] Terraform >= 1.5.0 installed
- [ ] AWS CLI >= 2.0 installed and configured
- [ ] kubectl >= 1.28 installed
- [ ] Domain name and SSL certificate (for production)

## Step 1: Initial Setup (5 minutes)

### 1.1 Install Required Tools

**macOS:**
```bash
brew install terraform awscli kubectl jq
```

**Linux:**
```bash
# Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### 1.2 Configure AWS Credentials

```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

Verify:
```bash
aws sts get-caller-identity
```

### 1.3 Create Terraform State Backend

```bash
# Create S3 bucket for state
aws s3 mb s3://valuecanvas-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket valuecanvas-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket valuecanvas-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name valuecanvas-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Step 2: Configure Secrets (3 minutes)

### 2.1 Create Secrets File

```bash
cd infrastructure/terraform/environments/staging
cp secrets.tfvars.example secrets.tfvars
```

### 2.2 Edit Secrets

Edit `secrets.tfvars` with your values:

```hcl
# Database (if not using Supabase)
db_password = "generate-secure-password-here"

# Supabase (get from https://app.supabase.com)
supabase_url         = "https://xxxxx.supabase.co"
supabase_anon_key    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
supabase_service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# LLM Provider (get from https://api.together.xyz)
together_api_key = "your-together-api-key"

# Optional: OpenAI fallback
openai_api_key = "sk-..."

# JWT Secret (generate with: openssl rand -base64 32)
jwt_secret = "your-jwt-secret-here"

# SSL Certificate ARN (create in AWS Certificate Manager)
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

### 2.3 Generate Secure Passwords

```bash
# Database password
openssl rand -base64 32

# JWT secret
openssl rand -base64 32
```

## Step 3: Deploy Staging (5 minutes)

### 3.1 Validate Configuration

```bash
cd infrastructure/terraform
./scripts/validate.sh
```

### 3.2 Deploy

```bash
./scripts/deploy-staging.sh
```

This will:
1. Initialize Terraform
2. Validate configuration
3. Create execution plan
4. Prompt for confirmation
5. Deploy infrastructure

### 3.3 Save Outputs

```bash
cd environments/staging
terraform output -json > outputs.json
```

## Step 4: Configure kubectl (2 minutes)

### 4.1 Update kubeconfig

```bash
aws eks update-kubeconfig \
  --name $(terraform output -raw eks_cluster_name) \
  --region us-east-1
```

### 4.2 Verify Cluster

```bash
kubectl get nodes
kubectl get namespaces
```

Expected output:
```
NAME                                        STATUS   ROLES    AGE   VERSION
ip-10-1-10-xxx.ec2.internal                Ready    <none>   5m    v1.28.x
ip-10-1-11-xxx.ec2.internal                Ready    <none>   5m    v1.28.x
```

## Step 5: Deploy Applications (Optional)

### 5.1 Create Namespace

```bash
kubectl create namespace valuecanvas-staging
```

### 5.2 Deploy Services

```bash
kubectl apply -f ../../k8s/staging/
```

### 5.3 Check Deployment

```bash
kubectl get pods -n valuecanvas-staging
kubectl get services -n valuecanvas-staging
```

## Verification Checklist

- [ ] VPC created with public/private subnets
- [ ] EKS cluster running
- [ ] Nodes joined cluster
- [ ] RDS/Supabase accessible
- [ ] Redis cluster running
- [ ] Load balancer created
- [ ] CloudWatch logs enabled
- [ ] kubectl configured

## Quick Commands

### View Infrastructure

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show aws_vpc.main

# View outputs
terraform output
```

### Monitor Deployment

```bash
# Watch pods
kubectl get pods -n valuecanvas-staging -w

# View logs
kubectl logs -f deployment/api-gateway -n valuecanvas-staging

# Check events
kubectl get events -n valuecanvas-staging --sort-by='.lastTimestamp'
```

### Access Services

```bash
# Get load balancer URL
terraform output alb_dns_name

# Port forward for local access
kubectl port-forward service/api-gateway 8000:8000 -n valuecanvas-staging
```

## Troubleshooting

### Issue: Terraform Init Fails

**Solution:**
```bash
# Clear cache
rm -rf .terraform .terraform.lock.hcl

# Re-initialize
terraform init
```

### Issue: AWS Credentials Error

**Solution:**
```bash
# Verify credentials
aws sts get-caller-identity

# Re-configure if needed
aws configure
```

### Issue: EKS Nodes Not Joining

**Solution:**
```bash
# Check node group status
aws eks describe-nodegroup \
  --cluster-name valuecanvas-staging-cluster \
  --nodegroup-name general

# View node logs
kubectl logs -n kube-system -l k8s-app=aws-node
```

### Issue: Database Connection Failed

**Solution:**
```bash
# Check security groups
aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*valuecanvas*"

# Test connection
psql -h $(terraform output -raw database_endpoint) -U valuecanvas -d valuecanvas
```

## Next Steps

1. **Configure DNS:**
   - Point your domain to the ALB
   - Update Route53 records

2. **Enable Monitoring:**
   - Set up CloudWatch dashboards
   - Configure alerts

3. **Deploy Production:**
   - Review production configuration
   - Run `./scripts/deploy-production.sh`

4. **Set Up CI/CD:**
   - Configure GitHub Actions
   - Automate deployments

## Cost Estimate

**Staging Environment (Monthly):**
- EKS Cluster: $73
- EC2 Nodes (2x t3.medium): $60
- RDS (db.t3.small): $30
- ElastiCache (cache.t3.micro): $12
- NAT Gateway: $32
- Load Balancer: $16
- **Total: ~$223/month**

**Production Environment (Monthly):**
- EKS Cluster: $73
- EC2 Nodes (5x t3.large): $375
- RDS (db.r6g.xlarge): $290
- ElastiCache (cache.r6g.large): $150
- NAT Gateways (3): $96
- Load Balancer: $16
- **Total: ~$1,000/month**

*Prices are estimates and may vary by region*

## Support

- **Documentation:** See [README.md](README.md)
- **Issues:** Check CloudWatch logs
- **Help:** Contact DevOps team

## Cleanup

To destroy staging environment:

```bash
cd infrastructure/terraform/environments/staging
terraform destroy -var-file=terraform.tfvars -var-file=secrets.tfvars
```

⚠️ **Warning:** This will delete all resources. Ensure you have backups!
