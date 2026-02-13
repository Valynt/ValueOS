variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets are required for RDS."
  }
}
variable "security_group_ids" {
  type = list(string)
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one security group is required."
  }
}
variable "instance_class" {
  type    = string
  default = "db.t4g.small"
}
variable "allocated_storage" {
  type    = number
  default = 50
  validation {
    condition     = var.allocated_storage >= 20
    error_message = "allocated_storage must be at least 20 GB."
  }
}
variable "multi_az" {
  type    = bool
  default = true
}
variable "backup_retention_days" {
  type    = number
  default = 7
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "backup_retention_days must be at least 7."
  }
}
variable "db_name" {
  type    = string
  default = "valueos"
}
variable "db_username" {
  type    = string
  default = "valueos_app"
}
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "tags" {
  type    = map(string)
  default = {}
}

variable "skip_final_snapshot" {
  type    = bool
  default = false
}
variable "final_snapshot_identifier" {
  type    = string
  default = "valueos-final-snapshot"
}
