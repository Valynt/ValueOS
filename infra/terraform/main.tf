# ValueOS Production Infrastructure — Terraform (ECS Fargate)
#
# STATUS: The active deploy pipeline uses Kubernetes (kustomize + kubectl).
# See: .github/workflows/deploy.yml and infra/k8s/
#
# These ECS modules provision supporting infrastructure (VPC, RDS, ElastiCache,
# CloudFront, monitoring) that the K8s cluster depends on. The ECS service
# modules are retained for reference but are NOT used by the deploy workflow.
# To switch to ECS, update deploy.yml to use `aws ecs update-service` instead
# of kubectl.

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

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

  name_prefix         = local.name_prefix
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  public_subnet_cidrs = var.public_subnet_cidrs
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

  name_prefix           = local.name_prefix
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  security_group_ids    = [module.security.database_security_group_id]

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

  node_type          = var.cache_node_type
  num_cache_nodes    = var.cache_num_nodes

  tags = local.common_tags
}

# ECS Cluster — ARCHIVED: not used by active deploy pipeline (K8s).
# Only provisioned when var.enable_ecs = true (default: false).
# See modules/_archived/README.md.
module "ecs" {
  count  = var.enable_ecs ? 1 : 0
  source = "./modules/_archived/ecs"

  name_prefix = local.name_prefix

  tags = local.common_tags
}

# Frontend Service — ARCHIVED: not used by active deploy pipeline (K8s).
# Only provisioned when var.enable_ecs = true (default: false).
module "frontend" {
  count  = var.enable_ecs ? 1 : 0
  source = "./modules/_archived/ecs-service"

  name_prefix            = "${local.name_prefix}-frontend"
  cluster_id             = module.ecs[0].cluster_id
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  public_subnet_ids      = module.networking.public_subnet_ids
  security_group_ids     = [module.security.frontend_security_group_id]

  container_image        = var.frontend_image
  container_port         = 80
  desired_count          = var.frontend_desired_count
  autoscaling_min_capacity = var.frontend_autoscaling_min_capacity
  autoscaling_max_capacity = var.frontend_autoscaling_max_capacity
  autoscaling_cpu_target = var.frontend_autoscaling_cpu_target
  autoscaling_request_count_target = var.frontend_autoscaling_request_count_target
  cpu                    = var.frontend_cpu
  memory                 = var.frontend_memory

  health_check_path      = "/"

  environment_variables = {
    NODE_ENV = var.environment
    VITE_API_URL = "https://api.${var.domain_name}"
  }

  tags = local.common_tags
}

# Backend Service — ARCHIVED: not used by active deploy pipeline (K8s).
# Only provisioned when var.enable_ecs = true (default: false).
module "backend" {
  count  = var.enable_ecs ? 1 : 0
  source = "./modules/_archived/ecs-service"

  name_prefix            = "${local.name_prefix}-backend"
  cluster_id             = module.ecs[0].cluster_id
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  public_subnet_ids      = module.networking.public_subnet_ids
  security_group_ids     = [module.security.backend_security_group_id]

  container_image        = var.backend_image
  container_port         = 3000
  desired_count          = var.backend_desired_count
  autoscaling_min_capacity = var.backend_autoscaling_min_capacity
  autoscaling_max_capacity = var.backend_autoscaling_max_capacity
  autoscaling_cpu_target = var.backend_autoscaling_cpu_target
  autoscaling_request_count_target = var.backend_autoscaling_request_count_target
  cpu                    = var.backend_cpu
  memory                 = var.backend_memory

  health_check_path      = "/health"

  environment_variables = {
    NODE_ENV = var.environment
    DATABASE_URL = module.database.connection_string
    REDIS_URL = module.cache.connection_string
  }

  secrets = {
    JWT_SECRET = module.security.jwt_secret_arn
    DATABASE_PASSWORD = module.database.password_secret_arn
  }

  tags = local.common_tags
}

# CDN (CloudFront)
module "cdn" {
  source = "./modules/cdn"

  name_prefix = local.name_prefix
  domain_name = var.domain_name

  frontend_lb_dns = var.enable_ecs ? module.frontend[0].load_balancer_dns : ""
  backend_lb_dns  = var.enable_ecs ? module.backend[0].load_balancer_dns : ""

  tags = local.common_tags
}

# Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix

  ecs_cluster_name      = var.enable_ecs ? module.ecs[0].cluster_name : ""
  frontend_service_name = var.enable_ecs ? module.frontend[0].service_name : ""
  backend_service_name  = var.enable_ecs ? module.backend[0].service_name : ""

  database_identifier = module.database.identifier
  cache_cluster_id = module.cache.cluster_id

  alert_email = var.alert_email
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

output "database_arn" {
  description = "Database ARN"
  value       = module.database.arn
}

output "cache_arn" {
  description = "Cache replication group ARN"
  value       = module.cache.arn
}

output "frontend_service_arn" {
  description = "Frontend ECS service ARN (null when enable_ecs = false)"
  value       = var.enable_ecs ? module.frontend[0].service_arn : null
}

output "backend_service_arn" {
  description = "Backend ECS service ARN (null when enable_ecs = false)"
  value       = var.enable_ecs ? module.backend[0].service_arn : null
}

output "frontend_target_group_arn" {
  description = "Frontend ALB target group ARN (null when enable_ecs = false)"
  value       = var.enable_ecs ? module.frontend[0].target_group_arn : null
}

output "backend_target_group_arn" {
  description = "Backend ALB target group ARN (null when enable_ecs = false)"
  value       = var.enable_ecs ? module.backend[0].target_group_arn : null
}
