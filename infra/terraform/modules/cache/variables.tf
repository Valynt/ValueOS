variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets are required."
  }
}
variable "security_group_ids" {
  type = list(string)
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one cache security group is required."
  }
}
variable "node_type" {
  type    = string
  default = "cache.t4g.small"
}
variable "num_cache_nodes" {
  type    = number
  default = 2
  validation {
    condition     = var.num_cache_nodes >= 1
    error_message = "num_cache_nodes must be >= 1."
  }
}
variable "tags" {
  type    = map(string)
  default = {}
}
