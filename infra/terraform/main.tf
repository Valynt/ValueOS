# ValueOS Production Infrastructure
# One-click deployment with Terraform

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "valueos-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "valueos-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ValueOS"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

# Local variables
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  tags = local.common_tags
}

# Security Module
module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_ids = [module.security.database_security_group_id]

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  multi_az              = var.db_multi_az
  backup_retention_days = var.db_backup_retention_days

  tags = local.common_tags
}

# Cache Module (Redis)
module "cache" {
  source = "./modules/cache"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_ids = [module.security.cache_security_group_id]

  node_type       = var.cache_node_type
  num_cache_nodes = var.cache_num_nodes

  tags = local.common_tags
}

# ECS Cluster
module "ecs" {
  source = "./modules/ecs"

  name_prefix = local.name_prefix

  tags = local.common_tags
}

# Frontend Service
module "frontend" {
  source = "./modules/ecs-service"

  name_prefix        = "${local.name_prefix}-frontend"
  cluster_id         = module.ecs.cluster_id
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  security_group_ids = [module.security.frontend_security_group_id]

  container_image = var.frontend_image
  container_port  = 80
  desired_count   = var.frontend_desired_count
  cpu             = var.frontend_cpu
  memory          = var.frontend_memory

  health_check_path = "/"

  environment_variables = {
    NODE_ENV     = var.environment
    VITE_API_URL = "https://api.${var.domain_name}"
  }

  tags = local.common_tags
}

# Backend Service
module "backend" {
  source = "./modules/ecs-service"

  name_prefix        = "${local.name_prefix}-backend"
  cluster_id         = module.ecs.cluster_id
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  security_group_ids = [module.security.backend_security_group_id]

  container_image = var.backend_image
  container_port  = 3000
  desired_count   = var.backend_desired_count
  cpu             = var.backend_cpu
  memory          = var.backend_memory

  health_check_path = "/health"

  environment_variables = {
    NODE_ENV     = var.environment
    DATABASE_URL = module.database.connection_string
    REDIS_URL    = module.cache.connection_string
  }

  secrets = {
    JWT_SECRET        = module.security.jwt_secret_arn
    DATABASE_PASSWORD = module.database.password_secret_arn
  }

  tags = local.common_tags
}

# CDN (CloudFront)
module "cdn" {
  source = "./modules/cdn"

  name_prefix = local.name_prefix
  domain_name = var.domain_name

  frontend_lb_dns = module.frontend.load_balancer_dns
  backend_lb_dns  = module.backend.load_balancer_dns

  tags = local.common_tags
}

# Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix

  ecs_cluster_name      = module.ecs.cluster_name
  frontend_service_name = module.frontend.service_name
  backend_service_name  = module.backend.service_name

  database_identifier = module.database.identifier
  cache_cluster_id    = module.cache.cluster_id

  alert_email       = var.alert_email
  slack_webhook_url = var.slack_webhook_url

  tags = local.common_tags
}

# Outputs
output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${var.domain_name}"
}

output "backend_url" {
  description = "Backend API URL"
  value       = "https://api.${var.domain_name}"
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "cache_endpoint" {
  description = "Cache endpoint"
  value       = module.cache.endpoint
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "Grafana dashboard URL"
  value       = module.monitoring.dashboard_url
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = module.ecs.cluster_id
}

output "frontend_service_arn" {
  description = "Frontend ECS service ARN"
  value       = module.frontend.service_arn
}

output "backend_service_arn" {
  description = "Backend ECS service ARN"
  value       = module.backend.service_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cdn.distribution_id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = module.cdn.distribution_arn
}
