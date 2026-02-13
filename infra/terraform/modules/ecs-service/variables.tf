variable "name_prefix" { type = string }
variable "cluster_id" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "Provide at least two private subnets for ECS tasks."
  }
}
variable "public_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "Provide at least two public subnets for the ALB."
  }
}
variable "security_group_ids" {
  type = list(string)
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one ECS service security group is required."
  }
}
variable "container_image" { type = string }
variable "container_port" { type = number }
variable "desired_count" {
  type    = number
  default = 2
}
variable "cpu" {
  type    = number
  default = 512
}
variable "memory" {
  type    = number
  default = 1024
}
variable "health_check_path" {
  type    = string
  default = "/health"
}
variable "environment_variables" {
  type    = map(string)
  default = {}
}
variable "secrets" {
  type    = map(string)
  default = {}
}
variable "tags" {
  type    = map(string)
  default = {}
}
