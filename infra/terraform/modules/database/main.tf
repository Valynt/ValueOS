resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}/database/password"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_db_instance" "this" {
  identifier                          = "${var.name_prefix}-postgres"
  engine                              = "postgres"
  engine_version                      = "16.3"
  instance_class                      = var.instance_class
  allocated_storage                   = var.allocated_storage
  max_allocated_storage               = var.allocated_storage * 2
  username                            = var.db_username
  password                            = random_password.db.result
  port                                = 5432
  db_name                             = var.db_name
  db_subnet_group_name                = aws_db_subnet_group.this.name
  vpc_security_group_ids              = var.security_group_ids
  multi_az                            = var.multi_az
  backup_retention_period             = var.backup_retention_days
  storage_encrypted                   = true
  deletion_protection                 = var.deletion_protection
  skip_final_snapshot                 = var.skip_final_snapshot
  final_snapshot_identifier           = var.final_snapshot_identifier
  publicly_accessible                 = false
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  auto_minor_version_upgrade          = true
  manage_master_user_password         = false
  iam_database_authentication_enabled = true
  performance_insights_enabled        = true

  tags = var.tags
}

output "endpoint" { value = aws_db_instance.this.endpoint }
output "connection_string" {
  value     = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"
  sensitive = true
}
output "password_secret_arn" { value = aws_secretsmanager_secret.db_password.arn }
output "identifier" { value = aws_db_instance.this.identifier }
