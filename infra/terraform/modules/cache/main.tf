# Cache module stub — implement ElastiCache Redis
# TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "node_type" { type = string }
variable "num_cache_nodes" { type = number }
variable "tags" { type = map(string) }

output "endpoint" { value = "redis-stub.example.com:6379" }
output "connection_string" {
  value     = "redis://redis-stub.example.com:6379"
  sensitive = true
}
output "cluster_id" { value = "valueos-cache-stub" }
