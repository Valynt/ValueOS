# ECS service module stub — implement ECS service + ALB target group
# TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "cluster_id" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "container_image" { type = string }
variable "container_port" { type = number }
variable "desired_count" { type = number }
variable "cpu" { type = number }
variable "memory" { type = number }
variable "health_check_path" { type = string }
variable "environment_variables" { type = map(string) }
variable "secrets" {
  type    = map(string)
  default = {}
}
variable "tags" { type = map(string) }

output "service_name" { value = "svc-stub" }
output "load_balancer_dns" { value = "alb-stub.example.com" }
