# Development Environment Terraform Configuration
#
# - Ephemeral database (auto-reset nightly)
# - Relaxed security groups
# - Single-replica RDS (no HA)
# - S3 bucket (dev-only, auto-cleanup)
# - Lambda concurrency limits disabled
# - CloudWatch logging (verbose)
# - Seeded with sample multi-tenant data

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "valuecanvas-terraform-state"
    key            = "development/terraform.tfstate"
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
      Environment = "development"
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Local Variables
locals {
  name_prefix = "valuecanvas-dev"
  
  common_tags = {
    Project     = "ValueCanvas"
    Environment = "development"
    ManagedBy   = "Terraform"
  }
}

# Development VPC (relaxed security)
resource "aws_vpc" "dev" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-vpc"
    }
  )
}

# Development Subnets
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.dev.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-${count.index + 1}"
      Type = "Public"
    }
  )
}

resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.dev.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-${count.index + 1}"
      Type = "Private"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "dev" {
  vpc_id = aws_vpc.dev.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-igw"
    }
  )
}

# NAT Gateway (single for cost savings)
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nat-eip"
    }
  )
}

resource "aws_nat_gateway" "dev" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nat"
    }
  )
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.dev.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dev.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-rt"
    }
  )
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.dev.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.dev.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-rt"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Development Security Groups (relaxed)
resource "aws_security_group" "dev_app" {
  name_prefix = "${local.name_prefix}-app-"
  vpc_id      = aws_vpc.dev.id

  # Allow all inbound for development
  ingress {
    description = "Allow all traffic for development"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-app-sg"
    }
  )
}

resource "aws_security_group" "dev_db" {
  name_prefix = "${local.name_prefix}-db-"
  vpc_id      = aws_vpc.dev.id

  # Allow database access from app and public
  ingress {
    description = "Allow PostgreSQL from anywhere (dev only)"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-db-sg"
    }
  )
}

# Development RDS (single instance, no HA)
resource "aws_db_instance" "dev" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "14.10"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = false  # Dev environment

  db_name  = "valuecanvas_dev"
  username = "dev_user"
  password = "dev_password_123"  # Weak password for dev

  vpc_security_group_ids = [aws_security_group.dev_db.id]
  db_subnet_group_name   = aws_db_subnet_group.dev.name

  backup_retention_period = 1  # Minimal backup for dev
  backup_window          = "07:00-08:00"
  maintenance_window     = "sun:08:00-sun:09:00"

  skip_final_snapshot       = true  # Dev environment
  delete_automated_backups  = true
  deletion_protection       = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-postgres"
    }
  )
}

resource "aws_db_subnet_group" "dev" {
  name       = "${local.name_prefix}-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-subnet-group"
    }
  )
}

# Development Redis (single node)
resource "aws_elasticache_subnet_group" "dev" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

resource "aws_elasticache_cluster" "dev" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379

  subnet_group_name = aws_elasticache_subnet_group.dev.name
  security_group_ids = [aws_security_group.dev_app.id]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-redis"
    }
  )
}

# Development S3 Bucket (auto-cleanup)
resource "aws_s3_bucket" "dev" {
  bucket = "${local.name_prefix}-storage"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-storage"
      Purpose = "Development storage"
    }
  )
}

resource "aws_s3_bucket_lifecycle_configuration" "dev" {
  bucket = aws_s3_bucket.dev.id

  rule {
    id     = "cleanup-old-files"
    status = "Enabled"

    expiration {
      days = 7  # Auto-cleanup after 7 days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Development Lambda (no concurrency limits)
resource "aws_iam_role" "dev_lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "dev_lambda_basic" {
  role       = aws_iam_role.dev_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudWatch Log Groups (verbose retention)
resource "aws_cloudwatch_log_group" "dev_app" {
  name              = "/aws/ec2/${local.name_prefix}/app"
  retention_in_days = 14  # Longer retention for dev debugging

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "dev_db" {
  name              = "/aws/rds/instance/${aws_db_instance.dev.identifier}"
  retention_in_days = 14

  tags = local.common_tags
}

# Development Outputs
output "vpc_id" {
  description = "Development VPC ID"
  value       = aws_vpc.dev.id
}

output "database_endpoint" {
  description = "Development database endpoint"
  value       = aws_db_instance.dev.endpoint
  sensitive   = true
}

output "database_port" {
  description = "Development database port"
  value       = aws_db_instance.dev.port
}

output "redis_endpoint" {
  description = "Development Redis endpoint"
  value       = aws_elasticache_cluster.dev.cache_nodes[0].address
}

output "s3_bucket_name" {
  description = "Development S3 bucket name"
  value       = aws_s3_bucket.dev.id
}

output "security_group_id" {
  description = "Development app security group ID"
  value       = aws_security_group.dev_app.id
}
