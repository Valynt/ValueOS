# ValueCanvas Infrastructure - Main Configuration
# Terraform configuration for deploying ValueCanvas microservices

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "valuecanvas-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ValueCanvas"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name_prefix}-backups"

  tags = merge(
    local.common_tags,
    {
      Name        = "${local.name_prefix}-backups"
      Purpose     = "Database and configuration backups"
      Compliance  = "Required"
    }
  )
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Local Variables
locals {
  name_prefix = "valuecanvas-${var.environment}"
  
  common_tags = {
    Project     = "ValueCanvas"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  agent_services = {
    opportunity = { port = 8080, replicas = var.agent_replicas }
    target      = { port = 8081, replicas = var.agent_replicas }
    realization = { port = 8082, replicas = var.agent_replicas }
    expansion   = { port = 8083, replicas = var.agent_replicas }
    integrity   = { port = 8084, replicas = var.agent_replicas }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name_prefix         = local.name_prefix
  vpc_cidr            = var.vpc_cidr
  availability_zones  = slice(data.aws_availability_zones.available.names, 0, 3)
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"
  
  tags = local.common_tags
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  cluster_name    = "${local.name_prefix}-cluster"
  cluster_version = var.kubernetes_version
  
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  node_groups = {
    general = {
      desired_size = var.eks_node_desired_size
      min_size     = var.eks_node_min_size
      max_size     = var.eks_node_max_size
      instance_types = var.eks_node_instance_types
      capacity_type  = "ON_DEMAND"
      disk_size      = 50
    }
  }

  tags = local.common_tags
}

# RDS (Supabase Alternative for Self-Hosted)
module "rds" {
  source = "./modules/rds"
  count  = var.use_supabase ? 0 : 1

  identifier     = "${local.name_prefix}-postgres"
  engine_version = "14.10"
  instance_class = var.db_instance_class
  
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  database_name = "valuecanvas"
  username      = var.db_username
  password      = var.db_password
  
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.database_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az               = var.environment == "production"
  deletion_protection    = var.environment == "production"
  
  tags = local.common_tags
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  cluster_id           = "${local.name_prefix}-redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.environment == "production" ? 2 : 1
  
  vpc_id               = module.vpc.vpc_id
  subnet_ids           = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  
  automatic_failover_enabled = var.environment == "production"
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name            = "${local.name_prefix}-alb"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.public_subnet_ids
  
  certificate_arn = var.acm_certificate_arn
  
  tags = local.common_tags
}

# ECR Repositories
resource "aws_ecr_repository" "services" {
  for_each = merge(
    local.agent_services,
    {
      orchestrator = { port = 8085, replicas = var.orchestrator_replicas }
      api-gateway  = { port = 8000, replicas = var.api_gateway_replicas }
    }
  )

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

# Secrets Manager
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${local.name_prefix}-secrets"
  description = "Application secrets for ValueCanvas"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  
  secret_string = jsonencode({
    database_url       = var.use_supabase ? var.supabase_url : module.rds[0].connection_string
    supabase_anon_key  = var.supabase_anon_key
    supabase_service_key = var.supabase_service_key
    together_api_key   = var.together_api_key
    openai_api_key     = var.openai_api_key
    jwt_secret         = var.jwt_secret
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "services" {
  for_each = merge(
    local.agent_services,
    {
      orchestrator = {}
      api-gateway  = {}
    }
  )

  name              = "/aws/eks/${local.name_prefix}/${each.key}"
  retention_in_days = var.environment == "production" ? 30 : 7

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = var.use_supabase ? var.supabase_url : module.rds[0].endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.endpoint
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.dns_name
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}
