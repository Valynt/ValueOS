# ECS cluster module stub
# TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

output "cluster_id" { value = "ecs-cluster-stub" }
output "cluster_name" { value = "valueos-cluster-stub" }
