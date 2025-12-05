terraform {
  required_version = ">= 1.4"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "us-east-1"
}

variable "db_username" {
  type        = string
  default     = "vos"
}

variable "db_password" {
  type        = string
  default     = "change_me"
  sensitive   = true
}

resource "aws_db_instance" "vos" {
  allocated_storage    = 20
  engine               = "postgres"
  engine_version       = "14.8"
  instance_class       = "db.t3.micro"
  name                 = "vos_db"
  username             = var.db_username
  password             = var.db_password
  parameter_group_name = "default.postgres14"
  skip_final_snapshot  = true
}

// Additional resources such as ECS/EKS clusters, security groups, and load balancers would be defined here.

output "db_endpoint" {
  value = aws_db_instance.vos.endpoint
}