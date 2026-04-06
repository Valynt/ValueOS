# ValueOS Terraform Variables

# ECS (archived-reference only — active runtime uses Kubernetes)
variable "enable_ecs" {
  description = "Set to true only to intentionally provision the archived ECS modules. Defaults to false so archived infra cannot be applied unintentionally."
  type        = bool
  default     = false
}

# General
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "valueos"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

# Networking
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

# Database
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "RDS backup retention period (days)"
  type        = number
  default     = 7
}

# Cache
variable "cache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "cache_num_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 2
}

# EKS
variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.32"
}

variable "node_instance_types" {
  description = "List of instance types for the nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 4
}

variable "min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 2
}

# Frontend
variable "frontend_image" {
  description = "Frontend Docker image"
  type        = string
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}


variable "frontend_autoscaling_min_capacity" {
  description = "Minimum frontend ECS tasks for autoscaling"
  type        = number
  default     = 2
}

variable "frontend_autoscaling_max_capacity" {
  description = "Maximum frontend ECS tasks for autoscaling"
  type        = number
  default     = 5
}

variable "frontend_autoscaling_cpu_target" {
  description = "Frontend ECS target average CPU utilization percentage"
  type        = number
  default     = 70
}

variable "frontend_autoscaling_request_count_target" {
  description = "Frontend ECS ALB requests-per-target target for autoscaling"
  type        = number
  default     = 1000
}

variable "frontend_cpu" {
  description = "Frontend task CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend task memory (MB)"
  type        = number
  default     = 512
}

# Backend
variable "backend_image" {
  description = "Backend Docker image"
  type        = string
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}


variable "backend_autoscaling_min_capacity" {
  description = "Minimum backend ECS tasks for autoscaling"
  type        = number
  default     = 2
}

variable "backend_autoscaling_max_capacity" {
  description = "Maximum backend ECS tasks for autoscaling"
  type        = number
  default     = 10
}

variable "backend_autoscaling_cpu_target" {
  description = "Backend ECS target average CPU utilization percentage"
  type        = number
  default     = 70
}

variable "backend_autoscaling_request_count_target" {
  description = "Backend ECS ALB requests-per-target target for autoscaling"
  type        = number
  default     = 1000
}

variable "backend_cpu" {
  description = "Backend task CPU units"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Backend task memory (MB)"
  type        = number
  default     = 1024
}

# Monitoring
variable "alert_email" {
  description = "Email for alerts"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
}
