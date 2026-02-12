# Monitoring module stub — implement CloudWatch alarms, SNS topics, dashboards
# TODO: Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "ecs_cluster_name" { type = string }
variable "frontend_service_name" { type = string }
variable "backend_service_name" { type = string }
variable "database_identifier" { type = string }
variable "cache_cluster_id" { type = string }
variable "alert_email" { type = string }
variable "slack_webhook_url" {
  type      = string
  sensitive = true
}
variable "tags" { type = map(string) }

output "dashboard_url" { value = "https://grafana.example.com/d/valueos" }
