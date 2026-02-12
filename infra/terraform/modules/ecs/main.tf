# ECS cluster module stub
# TODO: Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

output "cluster_id" { value = "ecs-cluster-stub" }
output "cluster_name" { value = "valueos-cluster-stub" }
