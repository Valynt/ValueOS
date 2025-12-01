# Development Environment Terraform Configuration
#
# - Ephemeral database (auto-reset nightly)
# - Relaxed security groups
# - Single-replica RDS (no HA)
# - S3 bucket (dev-only, auto-cleanup)
# - Lambda concurrency limits disabled
# - CloudWatch logging (verbose)
# - Seeded with sample multi-tenant data
