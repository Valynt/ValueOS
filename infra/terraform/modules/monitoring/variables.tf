variable "name_prefix" { type = string }
variable "ecs_cluster_name" { type = string }
variable "frontend_service_name" { type = string }
variable "backend_service_name" { type = string }
variable "database_identifier" { type = string }
variable "cache_cluster_id" { type = string }
variable "alert_email" {
  type = string
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}
variable "slack_webhook_url" {
  type      = string
  sensitive = true
  validation {
    condition     = startswith(var.slack_webhook_url, "https://")
    error_message = "slack_webhook_url must use https."
  }
}
variable "tags" {
  type    = map(string)
  default = {}
}
