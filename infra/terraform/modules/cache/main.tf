resource "random_password" "auth_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${var.name_prefix}/cache/auth-token"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.auth_token.result
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-cache-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.name_prefix}-redis"
  description                = "Redis cache for ${var.name_prefix}"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_nodes
  engine                     = "redis"
  engine_version             = "7.1"
  parameter_group_name       = "default.redis7"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = var.security_group_ids
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.auth_token.result
  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1
  apply_immediately          = true

  tags = var.tags
}

output "endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "connection_string" {
  value     = "rediss://:${random_password.auth_token.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
  sensitive = true
}
output "cluster_id" { value = aws_elasticache_replication_group.this.replication_group_id }
output "auth_token_secret_arn" { value = aws_secretsmanager_secret.redis_auth_token.arn }
