# Security module stub — implement security groups, IAM roles, secrets
# TODO: Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "tags" { type = map(string) }

output "database_security_group_id" { value = "sg-db-stub" }
output "cache_security_group_id" { value = "sg-cache-stub" }
output "frontend_security_group_id" { value = "sg-fe-stub" }
output "backend_security_group_id" { value = "sg-be-stub" }
output "jwt_secret_arn" { value = "arn:aws:secretsmanager:us-east-1:000000000000:secret:jwt-stub" }
