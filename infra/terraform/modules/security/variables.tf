variable "name_prefix" {
  type        = string
  description = "Resource name prefix"
  validation {
    condition     = length(var.name_prefix) > 3
    error_message = "name_prefix must be longer than 3 characters."
  }
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "vpc_id must look like an AWS VPC ID."
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to resources"
}
