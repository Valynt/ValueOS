# Security module — security groups (least privilege) and Secrets Manager

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "tags" { type = map(string) }

variable "jwt_secret_string" {
  description = "JWT secret payload JSON supplied from secure secret management"
  type        = string
  sensitive   = true
}

variable "db_password_secret_string" {
  description = "Database password payload JSON supplied from secure secret management"
  type        = string
  sensitive   = true
}

# --- ALB Security Group ---

resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "ALB: allow inbound HTTP/HTTPS from internet"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- Frontend Security Group ---

resource "aws_security_group" "frontend" {
  name_prefix = "${var.name_prefix}-fe-"
  description = "Frontend ECS tasks: allow traffic from ALB only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-frontend-sg" })

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "frontend_from_alb" {
  security_group_id            = aws_security_group.frontend.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "frontend_all" {
  security_group_id = aws_security_group.frontend.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- Backend Security Group ---

resource "aws_security_group" "backend" {
  name_prefix = "${var.name_prefix}-be-"
  description = "Backend ECS tasks: allow traffic from ALB only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-backend-sg" })

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "backend_from_alb" {
  security_group_id            = aws_security_group.backend.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "backend_all" {
  security_group_id = aws_security_group.backend.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- Database Security Group ---

resource "aws_security_group" "database" {
  name_prefix = "${var.name_prefix}-db-"
  description = "RDS: allow Postgres from backend tasks only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-database-sg" })

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_backend" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.backend.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "database_all" {
  security_group_id = aws_security_group.database.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- Cache Security Group ---

resource "aws_security_group" "cache" {
  name_prefix = "${var.name_prefix}-cache-"
  description = "ElastiCache: allow Redis from backend tasks only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-cache-sg" })

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "cache_from_backend" {
  security_group_id            = aws_security_group.cache.id
  referenced_security_group_id = aws_security_group.backend.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "cache_all" {
  security_group_id = aws_security_group.cache.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- Secrets Manager ---

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.name_prefix}-jwt-secret"
  description             = "JWT signing secret for backend auth"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret_string

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}-db-password"
  description             = "RDS master password"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password_secret_string

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# --- Outputs ---

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "frontend_security_group_id" {
  value = aws_security_group.frontend.id
}

output "backend_security_group_id" {
  value = aws_security_group.backend.id
}

output "database_security_group_id" {
  value = aws_security_group.database.id
}

output "cache_security_group_id" {
  value = aws_security_group.cache.id
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}

output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}
