# ============================================================================
# AWS Secrets Manager Configuration
# ============================================================================
# Manages application secrets with automatic rotation
# ============================================================================

# Development Secrets
resource "aws_secretsmanager_secret" "development" {
  name        = "valuecanvas/development"
  description = "ValueCanvas development environment secrets"
  
  recovery_window_in_days = 7
  
  tags = merge(
    local.common_tags,
    {
      Name        = "valuecanvas-development-secrets"
      Environment = "development"
    }
  )
}

resource "aws_secretsmanager_secret_version" "development" {
  secret_id = aws_secretsmanager_secret.development.id
  
  secret_string = jsonencode({
    TOGETHER_API_KEY       = var.together_api_key
    OPENAI_API_KEY         = var.openai_api_key
    SUPABASE_URL           = var.supabase_url
    SUPABASE_ANON_KEY      = var.supabase_anon_key
    SUPABASE_SERVICE_KEY   = var.supabase_service_key
    JWT_SECRET             = var.jwt_secret
    DATABASE_URL           = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
    REDIS_URL              = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
    SLACK_WEBHOOK_URL      = var.slack_webhook_url
  })
}

# Staging Secrets
resource "aws_secretsmanager_secret" "staging" {
  name        = "valuecanvas/staging"
  description = "ValueCanvas staging environment secrets"
  
  recovery_window_in_days = 7
  
  tags = merge(
    local.common_tags,
    {
      Name        = "valuecanvas-staging-secrets"
      Environment = "staging"
    }
  )
}

resource "aws_secretsmanager_secret_version" "staging" {
  secret_id = aws_secretsmanager_secret.staging.id
  
  secret_string = jsonencode({
    TOGETHER_API_KEY       = var.together_api_key
    OPENAI_API_KEY         = var.openai_api_key
    SUPABASE_URL           = var.supabase_url
    SUPABASE_ANON_KEY      = var.supabase_anon_key
    SUPABASE_SERVICE_KEY   = var.supabase_service_key
    JWT_SECRET             = var.jwt_secret
    DATABASE_URL           = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
    REDIS_URL              = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
    SLACK_WEBHOOK_URL      = var.slack_webhook_url
  })
}

# Production Secrets
resource "aws_secretsmanager_secret" "production" {
  name        = "valuecanvas/production"
  description = "ValueCanvas production environment secrets"
  
  recovery_window_in_days = 30  # Longer recovery window for production
  
  tags = merge(
    local.common_tags,
    {
      Name        = "valuecanvas-production-secrets"
      Environment = "production"
    }
  )
}

resource "aws_secretsmanager_secret_version" "production" {
  secret_id = aws_secretsmanager_secret.production.id
  
  secret_string = jsonencode({
    TOGETHER_API_KEY       = var.together_api_key
    OPENAI_API_KEY         = var.openai_api_key
    SUPABASE_URL           = var.supabase_url
    SUPABASE_ANON_KEY      = var.supabase_anon_key
    SUPABASE_SERVICE_KEY   = var.supabase_service_key
    JWT_SECRET             = var.jwt_secret
    DATABASE_URL           = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
    REDIS_URL              = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"
    SLACK_WEBHOOK_URL      = var.slack_webhook_url
  })
}

# IAM Policy for EKS pods to access secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "valuecanvas-secrets-access"
  description = "Allow EKS pods to access ValueCanvas secrets"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.development.arn,
          aws_secretsmanager_secret.staging.arn,
          aws_secretsmanager_secret.production.arn
        ]
      }
    ]
  })
}

# Attach policy to EKS node role
resource "aws_iam_role_policy_attachment" "eks_secrets_access" {
  role       = aws_iam_role.eks_node_group.name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# Automatic rotation for JWT secret (every 90 days)
resource "aws_secretsmanager_secret_rotation" "production_jwt" {
  secret_id           = aws_secretsmanager_secret.production.id
  rotation_lambda_arn = aws_lambda_function.rotate_jwt_secret.arn
  
  rotation_rules {
    automatically_after_days = 90
  }
}

# Lambda function for JWT secret rotation
resource "aws_lambda_function" "rotate_jwt_secret" {
  filename      = "lambda/rotate_jwt_secret.zip"
  function_name = "valuecanvas-rotate-jwt-secret"
  role          = aws_iam_role.lambda_rotation.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  
  environment {
    variables = {
      SECRET_ARN = aws_secretsmanager_secret.production.arn
    }
  }
  
  tags = local.common_tags
}

# IAM role for Lambda rotation function
resource "aws_iam_role" "lambda_rotation" {
  name = "valuecanvas-lambda-rotation"
  
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
}

resource "aws_iam_role_policy_attachment" "lambda_rotation_basic" {
  role       = aws_iam_role.lambda_rotation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_rotation_secrets" {
  name = "secrets-rotation"
  role = aws_iam_role.lambda_rotation.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = aws_secretsmanager_secret.production.arn
      }
    ]
  })
}

# CloudWatch alarm for failed secret access
resource "aws_cloudwatch_metric_alarm" "secrets_access_denied" {
  alarm_name          = "valuecanvas-secrets-access-denied"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UserErrorCount"
  namespace           = "AWS/SecretsManager"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when secrets access is denied multiple times"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    SecretId = aws_secretsmanager_secret.production.id
  }
}

# Outputs
output "secrets_development_arn" {
  description = "ARN of development secrets"
  value       = aws_secretsmanager_secret.development.arn
  sensitive   = true
}

output "secrets_staging_arn" {
  description = "ARN of staging secrets"
  value       = aws_secretsmanager_secret.staging.arn
  sensitive   = true
}

output "secrets_production_arn" {
  description = "ARN of production secrets"
  value       = aws_secretsmanager_secret.production.arn
  sensitive   = true
}
