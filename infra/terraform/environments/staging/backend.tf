# Terraform Backend Configuration for Staging
# S3 backend for remote state management

terraform {
  backend "s3" {
    bucket         = "valuecanvas-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "valuecanvas-terraform-locks"
    
    # Workspace isolation
    workspace_key_prefix = "staging"
  }
}
