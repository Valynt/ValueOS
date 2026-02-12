# Networking module stub — implement VPC, subnets, NAT gateways
# TODO: Replace with real resources before production deployment

variable "name_prefix" { type = string }
variable "vpc_cidr" { type = string }
variable "availability_zones" { type = list(string) }
variable "public_subnet_cidrs" { type = list(string) }
variable "private_subnet_cidrs" { type = list(string) }
variable "tags" { type = map(string) }

output "vpc_id" { value = "vpc-stub" }
output "private_subnet_ids" { value = ["subnet-priv-stub"] }
output "public_subnet_ids" { value = ["subnet-pub-stub"] }
