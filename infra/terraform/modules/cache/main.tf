# Cache module — ElastiCache Redis with auth token and in-transit encryption

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "node_type" { type = string }
variable "num_cache_nodes" { type = number }
variable "tags" { type = map(string) }

# --- Subnet Group ---

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name_prefix}-redis-subnet"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-subnet-group"
  })
}

# --- Auth Token ---

resource "random_password" "auth_token" {
  length           = 64
  special          = true
  override_special = "!&#$^<>-"
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "${var.name_prefix}-redis-auth-token"
  description             = "ElastiCache Redis AUTH token"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.auth_token.result
}

# --- Parameter Group ---

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = var.tags
}

# --- Replication Group (Redis cluster mode disabled, multi-AZ) ---

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis replication group for ${var.name_prefix}"

  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = var.security_group_ids

  engine         = "redis"
  engine_version = "7.1"
  port           = 6379

  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.auth_token.result

  snapshot_retention_limit = 3
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:06:00"

  apply_immediately = false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

# --- Outputs ---

output "endpoint" {
  value = "${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}

output "connection_string" {
  value     = "rediss://:${random_password.auth_token.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive = true
}

output "cluster_id" {
  value = aws_elasticache_replication_group.main.id
}
