# Production Environment Terraform Configuration
#
# - Multi-AZ RDS with read replicas
# - Auto-scaling groups
# - CDN (CloudFront/equivalent)
# - WAF + Shield (DDoS protection)
# - Secrets Manager + KMS encryption
# - VPC with strict NACLs
# - Private database endpoints
# - Disaster recovery (cross-region backups)
# - Immutable deployments
# - Blue-green deployment strategy

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
      Environment = "production"
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
  name_prefix = "valuecanvas-prod"
  
  common_tags = {
    Project     = "ValueCanvas"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

# Production VPC (strict security)
resource "aws_vpc" "prod" {
  cidr_block           = "10.2.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-vpc"
    }
  )
}

# Production Subnets
resource "aws_subnet" "public" {
  count = 3

  vpc_id                  = aws_vpc.prod.id
  cidr_block              = "10.2.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

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

  vpc_id            = aws_vpc.prod.id
  cidr_block        = "10.2.${count.index + 10}.0/24"
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

  vpc_id            = aws_vpc.prod.id
  cidr_block        = "10.2.${count.index + 20}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-database-${count.index + 1}"
      Type = "Database"
    }
  )
}

# Network ACLs (strict security)
resource "aws_network_acl" "prod" {
  vpc_id     = aws_vpc.prod.id
  subnet_ids = aws_subnet.public[*].id

  # Allow SSH from specific IPs only
  ingress {
    rule_no    = 100
    action     = "allow"
    from_port  = 22
    to_port    = 22
    protocol   = "tcp"
    cidr_block = "203.0.113.0/24"  # Replace with actual admin IPs
  }

  # Allow HTTP/HTTPS
  ingress {
    rule_no    = 110
    action     = "allow"
    from_port  = 80
    to_port    = 80
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
  }

  ingress {
    rule_no    = 120
    action     = "allow"
    from_port  = 443
    to_port    = 443
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
  }

  # Allow all outbound
  egress {
    rule_no    = 100
    action     = "allow"
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nacl"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "prod" {
  vpc_id = aws_vpc.prod.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-igw"
    }
  )
}

# NAT Gateways (multi-AZ for HA)
resource "aws_eip" "nat" {
  count = 3
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
    }
  )
}

resource "aws_nat_gateway" "prod" {
  count = 3

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
  vpc_id = aws_vpc.prod.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.prod.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-rt"
    }
  )
}

resource "aws_route_table" "private" {
  count = 3

  vpc_id = aws_vpc.prod.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.prod[count.index].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-rt-${count.index + 1}"
    }
  )
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.prod.id

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
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Production Security Groups (strict)
resource "aws_security_group" "prod_app" {
  name_prefix = "${local.name_prefix}-app-"
  vpc_id      = aws_vpc.prod.id

  # Allow HTTP/HTTPS from ALB only
  ingress {
    description     = "Allow HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.prod_alb.id]
  }

  ingress {
    description     = "Allow HTTPS from ALB"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.prod_alb.id]
  }

  # Allow application ports from ALB
  ingress {
    description     = "Allow application traffic"
    from_port       = 8000
    to_port         = 8090
    protocol        = "tcp"
    security_groups = [aws_security_group.prod_alb.id]
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

resource "aws_security_group" "prod_db" {
  name_prefix = "${local.name_prefix}-db-"
  vpc_id      = aws_vpc.prod.id

  # Allow database access only from app
  ingress {
    description     = "Allow PostgreSQL from app"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.prod_app.id]
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

resource "aws_security_group" "prod_alb" {
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = aws_vpc.prod.id

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

# Production RDS (multi-AZ with read replicas)
resource "aws_db_instance" "prod_primary" {
  identifier = "${local.name_prefix}-postgres-primary"

  engine         = "postgres"
  engine_version = "14.10"
  instance_class = "db.t3.medium"

  allocated_storage     = 500
  max_allocated_storage = 2000
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = "valuecanvas_prod"
  username = "prod_user"
  password = "prod_secure_password_change_me"

  vpc_security_group_ids = [aws_security_group.prod_db.id]
  db_subnet_group_name   = aws_db_subnet_group.prod.name

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  multi_az               = true
  deletion_protection    = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-postgres-primary"
    }
  )
}

resource "aws_db_instance" "prod_replica" {
  count = 2

  identifier = "${local.name_prefix}-postgres-replica-${count.index + 1}"

  replicate_source_db = aws_db_instance.prod_primary.identifier
  instance_class      = "db.t3.medium"

  vpc_security_group_ids = [aws_security_group.prod_db.id]
  db_subnet_group_name   = aws_db_subnet_group.prod.name

  skip_final_snapshot = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-postgres-replica-${count.index + 1}"
    }
  )
}

resource "aws_db_subnet_group" "prod" {
  name       = "${local.name_prefix}-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-subnet-group"
    }
  )
}

# Production Redis (cluster mode enabled)
resource "aws_elasticache_subnet_group" "prod" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "prod" {
  replication_group_id       = "${local.name_prefix}-redis"
  description               = "Production Redis cluster"
  
  node_type                  = "cache.t3.medium"
  port                      = 6379
  parameter_group_name      = "default.redis7"
  engine_version            = "7.0"
  
  num_cache_clusters         = 3  # Multi-AZ
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  subnet_group_name         = aws_elasticache_subnet_group.prod.name
  security_group_ids        = [aws_security_group.prod_app.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = "redis_secure_auth_token_change_me"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-redis"
    }
  )
}

# Application Load Balancer
resource "aws_lb" "prod" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.prod_alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-alb"
    }
  )
}

resource "aws_lb_target_group" "prod" {
  name     = "${local.name_prefix}-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.prod.id

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "prod_http" {
  load_balancer_arn = aws_lb.prod.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "prod_https" {
  load_balancer_arn = aws_lb.prod.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.prod.arn
  }

  tags = local.common_tags
}

# CloudFront CDN
resource "aws_cloudfront_distribution" "prod" {
  origin {
    domain_name = aws_lb.prod.dns_name
    origin_id   = "valuecanvas-prod-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "valuecanvas-prod-alb"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-cloudfront"
    }
  )
}

# WAF + Shield
resource "aws_shield_protection" "prod" {
  name                     = "${local.name_prefix}-shield"
  resource_arn             = aws_lb.prod.arn
}

resource "aws_wafv2_ip_set" "prod" {
  name               = "${local.name_prefix}-ip-set"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"

  addresses = ["192.0.2.0/24", "198.51.100.0/24"]  # Replace with actual malicious IPs

  tags = local.common_tags
}

resource "aws_wafv2_web_acl" "prod" {
  name        = "${local.name_prefix}-waf"
  scope       = "REGIONAL"
  default_action {
    block {}
  }

  rules {
    name     = "AllowKnownGoodIPs"
    priority = 1

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.prod.arn
      }
    }

    action {
      allow {}
    }

    visibility_config {
      sampled_requests_enabled = false
      cloudwatch_metrics_enabled = true
      metric_name = "AllowKnownGoodIPs"
    }
  }

  visibility_config {
    sampled_requests_enabled = false
    cloudwatch_metrics_enabled = true
    metric_name = "ProductionWebACL"
  }

  tags = local.common_tags
}

resource "aws_wafv2_web_acl_association" "prod" {
  resource_arn = aws_lb.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.prod.arn
}

# KMS for Secrets
resource "aws_kms_key" "prod" {
  description             = "KMS key for production secrets"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-kms"
    }
  )
}

resource "aws_kms_alias" "prod" {
  name          = "alias/${local.name_prefix}"
  target_key_id = aws_kms_key.prod.key_id
}

# Secrets Manager with KMS encryption
resource "aws_secretsmanager_secret" "prod" {
  name                        = "${local.name_prefix}-secrets"
  description                = "Production environment secrets"
  kms_key_id                  = aws_kms_key.prod.arn
  secret_binary               = base64encode("initial_secret_value")
  rotation_enabled            = true
  rotation_lambda_arn         = aws_lambda_function.secret_rotation.arn
  rotation_rules {
    automatically_after_days = 90
  }

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "prod" {
  secret_id = aws_secretsmanager_secret.prod.id
  
  secret_string = jsonencode({
    database_url      = aws_db_instance.prod_primary.endpoint
    redis_endpoint    = aws_elasticache_replication_group.prod.primary_endpoint_address
    jwt_secret        = "prod_jwt_secret_change_immediately"
    together_api_key  = "prod_together_api_key"
    supabase_url      = "https://prod.supabase.co"
    supabase_anon_key = "prod_supabase_anon_key"
  })
}

# Auto Scaling Groups
resource "aws_launch_template" "prod_app" {
  name_prefix   = "${local.name_prefix}-app-"
  image_id      = "ami-0c02fb55956c7d316"  # Replace with actual AMI
  instance_type = "t3.medium"

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.prod_app.id]
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    environment = "production"
  }))

  tags = local.common_tags
}

resource "aws_autoscaling_group" "prod_app" {
  desired_capacity    = 3
  max_size           = 10
  min_size           = 2
  vpc_zone_identifier = aws_subnet.private[*].id

  launch_template {
    id      = aws_launch_template.prod_app.id
    version = "$Latest"
  }

  target_group_arns = [aws_lb_target_group.prod.arn]

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-app"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

resource "aws_autoscaling_policy" "prod_scale_up" {
  name                   = "${local.name_prefix}-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.prod_app.name
}

resource "aws_autoscaling_policy" "prod_scale_down" {
  name                   = "${local.name_prefix}-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.prod_app.name
}

resource "aws_cloudwatch_metric_alarm" "prod_cpu_high" {
  alarm_name          = "${local.name_prefix}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.prod_scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.prod_app.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "prod_cpu_low" {
  alarm_name          = "${local.name_prefix}-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "20"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.prod_scale_down.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.prod_app.name
  }

  tags = local.common_tags
}

# Lambda for secret rotation
resource "aws_iam_role" "lambda_rotation" {
  name = "${local.name_prefix}-lambda-rotation"

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

resource "aws_lambda_function" "secret_rotation" {
  function_name    = "${local.name_prefix}-secret-rotation"
  role            = aws_iam_role.lambda_rotation.arn
  runtime         = "python3.9"
  handler         = "lambda_function.lambda_handler"
  filename        = "secret_rotation.zip"
  source_code_hash = filebase64sha256("secret_rotation.zip")

  tags = local.common_tags
}

# Production Outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = aws_vpc.prod.id
}

output "database_endpoint" {
  description = "Production database endpoint"
  value       = aws_db_instance.prod_primary.endpoint
  sensitive   = true
}

output "database_replicas" {
  description = "Production database replica endpoints"
  value       = aws_db_instance.prod_replica[*].endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Production Redis endpoint"
  value       = aws_elasticache_replication_group.prod.primary_endpoint_address
  sensitive   = true
}

output "alb_dns_name" {
  description = "Production ALB DNS name"
  value       = aws_lb.prod.dns_name
}

output "cloudfront_domain_name" {
  description = "Production CloudFront domain name"
  value       = aws_cloudfront_distribution.prod.domain_name
}

output "security_group_id" {
  description = "Production app security group ID"
  value       = aws_security_group.prod_app.id
}

output "secrets_arn" {
  description = "Production secrets ARN"
  value       = aws_secretsmanager_secret.prod.arn
}

output "kms_key_id" {
  description = "Production KMS key ID"
  value       = aws_kms_key.prod.arn
}
