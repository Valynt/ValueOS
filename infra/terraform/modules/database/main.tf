# Database module stub — implement RDS PostgreSQL
# TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "multi_az" { type = bool }
variable "backup_retention_days" { type = number }
variable "tags" { type = map(string) }

output "endpoint" { value = "db-stub.example.com:5432" }
output "connection_string" {
  value     = "postgresql://user:pass@db-stub.example.com:5432/valueos"
  sensitive = true
}
output "password_secret_arn" { value = "arn:aws:secretsmanager:us-east-1:000000000000:secret:db-pass-stub" }
output "identifier" { value = "valueos-db-stub" }
