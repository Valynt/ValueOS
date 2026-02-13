resource "aws_security_group" "frontend" {
  name_prefix = "${var.name_prefix}-frontend-"
  description = "Frontend ingress from internet"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-frontend-sg" })
}

resource "aws_security_group" "backend" {
  name_prefix = "${var.name_prefix}-backend-"
  description = "Backend ingress from frontend"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-backend-sg" })
}

resource "aws_security_group" "database" {
  name_prefix = "${var.name_prefix}-db-"
  description = "Database ingress from backend"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-database-sg" })
}

resource "aws_security_group" "cache" {
  name_prefix = "${var.name_prefix}-cache-"
  description = "Cache ingress from backend"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cache-sg" })
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.name_prefix}/jwt"
  description             = "JWT signing secret"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

output "database_security_group_id" { value = aws_security_group.database.id }
output "cache_security_group_id" { value = aws_security_group.cache.id }
output "frontend_security_group_id" { value = aws_security_group.frontend.id }
output "backend_security_group_id" { value = aws_security_group.backend.id }
output "jwt_secret_arn" { value = aws_secretsmanager_secret.jwt.arn }
