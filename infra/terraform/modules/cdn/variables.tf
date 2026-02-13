variable "name_prefix" { type = string }
variable "domain_name" {
  type = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9.-]+$", var.domain_name))
    error_message = "domain_name must be a valid DNS name."
  }
}
variable "frontend_lb_dns" { type = string }
variable "backend_lb_dns" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
