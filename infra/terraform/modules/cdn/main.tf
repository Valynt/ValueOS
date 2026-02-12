# CDN module stub — implement CloudFront distribution
# TODO: Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "domain_name" { type = string }
variable "frontend_lb_dns" { type = string }
variable "backend_lb_dns" { type = string }
variable "tags" { type = map(string) }
