output "dev_db_master_secret_arn" {
  description = "AWS Secrets Manager ARN for the generated development DB master credentials."
  value       = aws_secretsmanager_secret.dev_db_master.arn
}

output "dev_db_master_secret_name" {
  description = "AWS Secrets Manager secret name for the generated development DB credentials."
  value       = aws_secretsmanager_secret.dev_db_master.name
}
