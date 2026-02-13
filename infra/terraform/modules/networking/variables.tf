variable "name_prefix" {
  type        = string
  description = "Resource name prefix"
  validation {
    condition     = length(var.name_prefix) > 3
    error_message = "name_prefix must be longer than 3 characters."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "AZs for subnet placement"
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs"
  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : can(cidrnetmask(cidr))]) && length(var.public_subnet_cidrs) == length(var.private_subnet_cidrs) && length(var.public_subnet_cidrs) <= length(var.availability_zones)
    error_message = "Public subnet CIDRs must be valid, match private subnet count, and fit within provided AZs."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs"
  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(cidrnetmask(cidr))])
    error_message = "All private_subnet_cidrs must be valid CIDR blocks."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to resources"
  default     = {}
}

