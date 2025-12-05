# Staging Environment Terraform Configuration
#
# - Production-like infrastructure (scaled down)
# - Multi-replica RDS (HA enabled)
# - WAF enabled (non-blocking rules)
# - VPC with private subnets
# - Secrets managed via AWS Secrets Manager
# - CloudWatch alarms enabled
# - Load testing capable
# - Production-replica dataset (anonymized)

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
    key            = "staging/terraform.tfstate"
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
      Environment = "staging"
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
  name_prefix = "valuecanvas-staging"
  
  common_tags = {
    Project     = "ValueCanvas"
    Environment = "staging"
    ManagedBy   = "Terraform"
  }
}

# Staging VPC (production-like security)
resource "aws_vpc" "staging" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-vpc"
    }
  )
}

# Staging Subnets
resource "aws_subnet" "public" {
  count = 3

  vpc_id                  = aws_vpc.staging.id
  cidr_block              = "10.1.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false  # No public IPs by default

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-${count.index + 1}"
      Type = "Public"
    }
  )
}

resource "aws_subnet" "private" {
  count = 3

  vpc_id            = aws_vpc.staging.id
  cidr_block        = "10.1.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-${count.index + 1}"
      Type = "Private"
    }
  )
}

resource "aws_subnet" "database" {
  count = 3

  vpc_id            = aws_vpc.staging.id
  cidr_block        = "10.1.${count.index + 20}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-database-${count.index + 1}"
      Type = "Database"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-igw"
    }
  )
}

# NAT Gateways (multi-AZ for HA)
resource "aws_eip" "nat" {
  count = 2
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
    }
  )
}

resource "aws_nat_gateway" "staging" {
  count = 2

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nat-${count.index + 1}"
    }
  )
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.staging.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-rt"
    }
  )
}

resource "aws_route_table" "private" {
  count = 2

  vpc_id = aws_vpc.staging.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.staging[count.index].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-rt-${count.index + 1}"
    }
  )
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.staging.id

  # No internet access for database subnets
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-database-rt"
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
  route_table_id = count.index < 2 ? aws_route_table.private[count.index].id : aws_route_table.private[0].id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Staging Security Groups (production-like)
resource "aws_security_group" "staging_app" {
  name_prefix = "${local.name_prefix}-app-"
  vpc_id      = aws_vpc.staging.id

  # Allow HTTP/HTTPS from ALB
  ingress {
    description = "Allow HTTP from ALB"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    security_groups = [aws_security_group.staging_alb.id]
  }

  ingress {
    description = "Allow HTTPS from ALB"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.staging_alb.id]
  }

  # Allow application ports
  ingress {
    description = "Allow application traffic"
    from_port   = 8000
    to_port     = 8090
    protocol    = "tcp"
    security_groups = [aws_security_group.staging_alb.id]
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
      Name = "${local.name_prefix}-app-sg"
    }
  )
}

resource "aws_security_group" "staging_db" {
  name_prefix = "${local.name_prefix}-db-"
  vpc_id      = aws_vpc.staging.id

  # Allow database access only from app
  ingress {
    description = "Allow PostgreSQL from app"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.staging_app.id]
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

resource "aws_security_group" "staging_alb" {
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = aws_vpc.staging.id

  # Allow HTTP/HTTPS from internet
  ingress {
    description = "Allow HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS from internet"
    from_port   = 443
    to_port     = 443
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
      Name = "${local.name_prefix}-alb-sg"
    }
  )
}

# Staging RDS (multi-AZ, HA enabled)
resource "aws_db_instance" "staging" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "14.10"
  instance_class = "db.t3.small"

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = "valuecanvas_staging"
  username = "staging_user"
  password = "staging_secure_password_123"

  vpc_security_group_ids = [aws_security_group.staging_db.id]
  db_subnet_group_name   = aws_db_subnet_group.staging.name

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  multi_az               = true
  deletion_protection    = false  # Staging allows deletion

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-postgres"
    }
  )
}

resource "aws_db_subnet_group" "staging" {
  name       = "${local.name_prefix}-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-subnet-group"
    }
  )
}

# Staging Redis (cluster mode disabled, HA enabled)
resource "aws_elasticache_subnet_group" "staging" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "staging" {
  replication_group_id       = "${local.name_prefix}-redis"
  description               = "Staging Redis cluster"
  
  node_type                  = "cache.t3.micro"
  port                      = 6379
  parameter_group_name      = "default.redis7"
  engine_version            = "7.0"
  
  num_cache_clusters         = 2  # Multi-AZ
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  subnet_group_name         = aws_elasticache_subnet_group.staging.name
  security_group_ids        = [aws_security_group.staging_app.id]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-redis"
    }
  )
}

# Application Load Balancer
resource "aws_lb" "staging" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.staging_alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-alb"
    }
  )
}

resource "aws_lb_target_group" "staging" {
  name     = "${local.name_prefix}-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.staging.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "staging_http" {
  load_balancer_arn = aws_lb.staging.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.staging.arn
  }

  tags = local.common_tags
}

# WAF (non-blocking rules for testing)
resource "aws_wafv2_ip_set" "staging" {
  name               = "${local.name_prefix}-ip-set"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"

  addresses = ["192.0.2.0/24", "198.51.100.0/24"]  # Example IPs for testing

  tags = local.common_tags
}

resource "aws_wafv2_web_acl" "staging" {
  name        = "${local.name_prefix}-waf"
  scope       = "REGIONAL"
  default_action {
    allow {}
  }

  rules {
    name     = "BlockKnownMaliciousIPs"
    priority = 1

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.staging.arn
      }
    }

    action {
      block {}
    }

    visibility_config {
      sampled_requests_enabled = false
      cloudwatch_metrics_enabled = true
      metric_name = "BlockKnownMaliciousIPs"
    }
  }

  visibility_config {
    sampled_requests_enabled = false
    cloudwatch_metrics_enabled = true
    metric_name = "StagingWebACL"
  }

  tags = local.common_tags
}

resource "aws_wafv2_web_acl_association" "staging" {
  resource_arn = aws_lb.staging.arn
  web_acl_arn  = aws_wafv2_web_acl.staging.arn
}

# Secrets Manager
resource "aws_secretsmanager_secret" "staging" {
  name        = "${local.name_prefix}-secrets"
  description = "Staging environment secrets"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "staging" {
  secret_id = aws_secretsmanager_secret.staging.id
  
  secret_string = jsonencode({
    database_url      = aws_db_instance.staging.endpoint
    redis_endpoint    = aws_elasticache_replication_group.staging.primary_endpoint_address
    jwt_secret        = "staging_jwt_secret_change_in_production"
    together_api_key  = "staging_together_api_key"
    supabase_url      = "https://staging.supabase.co"
    supabase_anon_key = "staging_supabase_anon_key"
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "staging_cpu" {
  alarm_name          = "${local.name_prefix}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors cpu utilization for staging RDS"
  alarm_actions       = []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.staging.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "staging_memory" {
  alarm_name          = "${local.name_prefix}-low-memory"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "268435456"  # 256 MB in bytes
  alarm_description   = "This metric monitors free memory for staging RDS"
  alarm_actions       = []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.staging.identifier
  }

  tags = local.common_tags
}

# Staging Outputs
output "vpc_id" {
  description = "Staging VPC ID"
  value       = aws_vpc.staging.id
}

output "database_endpoint" {
  description = "Staging database endpoint"
  value       = aws_db_instance.staging.endpoint
  sensitive   = true
}

output "database_port" {
  description = "Staging database port"
  value       = aws_db_instance.staging.port
}

output "redis_endpoint" {
  description = "Staging Redis endpoint"
  value       = aws_elasticache_replication_group.staging.primary_endpoint_address
}

output "alb_dns_name" {
  description = "Staging ALB DNS name"
  value       = aws_lb.staging.dns_name
}

output "security_group_id" {
  description = "Staging app security group ID"
  value       = aws_security_group.staging_app.id
}

output "secrets_arn" {
  description = "Staging secrets ARN"
  value       = aws_secretsmanager_secret.staging.arn
}
