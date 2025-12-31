# Terraform Backend Configuration for Production
# S3 backend for remote state management with enhanced security

terraform {
  backend "s3" {
    bucket         = "valuecanvas-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "valuecanvas-terraform-locks"
    kms_key_id     = "alias/terraform-state-key"
    
    # Workspace isolation
    workspace_key_prefix = "production"
    
    # Additional security
    skip_credentials_validation = false
    skip_metadata_api_check     = false
  }
}
