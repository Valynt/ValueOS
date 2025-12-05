# ValueCanvas Secret Management Setup
# 
# This file provides instructions for setting up secure secrets
# without using AWS Secrets Manager.

## Quick Setup Commands

# Generate secure passwords for each environment:
echo "DEV_DB_PASSWORD=$(openssl rand -base64 32)" >> .env.local
echo "DEV_REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env.local

echo "STAGE_DB_PASSWORD=$(openssl rand -base64 32)" >> .env.stage
echo "STAGE_REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env.stage

echo "PROD_DB_PASSWORD=$(openssl rand -base64 32)" >> .env.prod
echo "PROD_REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env.prod

## Alternative: Manual Setup

# Create secure secrets directory (gitignored)
mkdir -p secrets

# Generate individual secret files
echo "$(openssl rand -base64 32)" > secrets/dev_db_password.txt
echo "$(openssl rand -base64 32)" > secrets/dev_redis_password.txt
echo "$(openssl rand -base64 32)" > secrets/stage_db_password.txt
echo "$(openssl rand -base64 32)" > secrets/stage_redis_password.txt
echo "$(openssl rand -base64 32)" > secrets/prod_db_password.txt
echo "$(openssl rand -base64 32)" > secrets/prod_redis_password.txt

## Docker Compose Integration

# Update docker-compose files to use these secrets:
# secrets:
#   db_password:
#     file: ./secrets/${ENV}_db_password.txt
#   redis_password:
#     file: ./secrets/${ENV}_redis_password.txt
