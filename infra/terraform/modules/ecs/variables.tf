variable "name_prefix" {
  type        = string
  description = "Resource name prefix"
  validation {
    condition     = length(var.name_prefix) > 3
    error_message = "name_prefix must be longer than 3 characters."
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to resources"
}
