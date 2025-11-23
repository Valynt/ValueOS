# Environment Setup Guide

Complete guide for configuring ValueCanvas environment variables across all deployment environments.

## Quick Start

```bash
# 1. Copy example file
cp .env.example .env.local

# 2. Update required variables (see Required Variables section)

# 3. Verify configuration
npm run verify-env
```

## Required Variables

### Minimum Configuration (Development)

```bash
# Application
VITE_APP_ENV=development
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Authentication
JWT_SECRET=your-jwt-secret-here

# LLM Services
TOGETHER_API_KEY=your-together-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# Redis
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

### Production Configuration

All development variables plus:

```bash
# AWS Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=valuecanvas-backups
S3_ENABLED=true
SECRETS_MANAGER_SECRET_NAME=valuecanvas/production/secrets
SECRETS_MANAGER_ENABLED=true

# Monitoring
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ENABLED=true
OTLP_ENDPOINT=http://localhost:4318
CLOUDWATCH_LOG_GROUP=/valuecanvas/application
CLOUDWATCH_ENABLED=true

# Security
VITE_HTTPS_ONLY=true
CORS_ALLOWED_ORIGINS=https://valuecanvas.com
RATE_LIMIT_PER_MINUTE=60
CSRF_PROTECTION_ENABLED=true
CSP_ENABLED=true

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@valuecanvas.com
SMTP_PASSWORD=your-smtp-password
EMAIL_ENABLED=true
```

## Variable Categories

### 1. Application Configuration

```bash
# Environment type
VITE_APP_ENV=development|staging|production

# Application URLs
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000

# Session timeout (milliseconds)
VITE_SESSION_TIMEOUT=3600000
```

**When to change**:
- `VITE_APP_ENV`: Set to `production` for production deployments
- `VITE_APP_URL`: Update to your domain (e.g., `https://app.valuecanvas.com`)
- `VITE_API_BASE_URL`: Update to your API domain (e.g., `https://api.valuecanvas.com`)

### 2. Database & Supabase

```bash
# Supabase Project URL
VITE_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous Key (public, safe to expose)
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (server-side only, NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**How to get**:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy URL and keys

**Security**:
- ⚠️ NEVER commit `SUPABASE_SERVICE_ROLE_KEY` to git
- ⚠️ NEVER expose service role key to client-side code
- ✅ Use Row Level Security (RLS) policies

### 3. LLM Services

```bash
# Together.ai (Primary Provider)
TOGETHER_API_KEY=your-together-api-key-here

# OpenAI (Fallback Provider)
OPENAI_API_KEY=your-openai-api-key-here

# Default model
LLM_DEFAULT_MODEL=meta-llama/Llama-3-70b-chat-hf

# Request timeout
LLM_TIMEOUT=30000

# Caching
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=86400
```

**How to get**:
- Together.ai: [https://api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys)
- OpenAI: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Cost optimization**:
- Enable caching: `LLM_CACHE_ENABLED=true`
- Use cheaper models for non-critical tasks
- Set appropriate timeouts

### 4. Redis (Caching & Queue)

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_ENABLED=true

# Cache TTL
CACHE_TTL=3600
```

**Local setup**:
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Using Homebrew (macOS)
brew install redis
brew services start redis
```

**Production**:
- Use managed Redis (AWS ElastiCache, Redis Cloud, etc.)
- Enable password authentication
- Use TLS encryption
- Configure persistence

### 5. AWS Services

```bash
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# S3 Backups
S3_BUCKET_NAME=valuecanvas-backups
S3_ENABLED=true

# Secrets Manager
SECRETS_MANAGER_SECRET_NAME=valuecanvas/production/secrets
SECRETS_MANAGER_ENABLED=true
```

**Setup**:
1. Create IAM user with appropriate permissions
2. Create S3 bucket for backups
3. Create Secrets Manager secret
4. Configure bucket lifecycle policies

**Permissions required**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::valuecanvas-backups",
        "arn:aws:s3:::valuecanvas-backups/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:valuecanvas/*"
    }
  ]
}
```

### 6. Monitoring & Observability

```bash
# Sentry (Error Tracking)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_SAMPLE_RATE=1.0

# OpenTelemetry (Tracing)
OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=valuecanvas-api
OTEL_SERVICE_VERSION=1.0.0

# CloudWatch (Logs)
CLOUDWATCH_LOG_GROUP=/valuecanvas/application
CLOUDWATCH_LOG_STREAM=production
CLOUDWATCH_ENABLED=true
```

**Setup**:
1. Create Sentry project: [https://sentry.io](https://sentry.io)
2. Deploy observability stack: `docker-compose -f infrastructure/docker-compose.observability.yml up -d`
3. Create CloudWatch log group in AWS

### 7. Security

```bash
# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret-here

# HTTPS
VITE_HTTPS_ONLY=true

# CORS
CORS_ALLOWED_ORIGINS=https://valuecanvas.com,https://app.valuecanvas.com

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Security Headers
CSRF_PROTECTION_ENABLED=true
CSP_ENABLED=true
```

**Best practices**:
- Generate strong JWT secret: `openssl rand -base64 32`
- Use HTTPS in production
- Restrict CORS origins
- Enable all security features in production

### 8. Message Queue

```bash
# BullMQ Configuration
QUEUE_NAME=llm-processing
QUEUE_CONCURRENCY=10
QUEUE_RATE_LIMIT=100
QUEUE_ENABLED=true
```

**Tuning**:
- `QUEUE_CONCURRENCY`: Number of concurrent workers (adjust based on CPU/memory)
- `QUEUE_RATE_LIMIT`: Max jobs per minute (adjust based on LLM rate limits)

### 9. Feature Flags

```bash
# Application Features
VITE_AGENT_FABRIC_ENABLED=true
VITE_WORKFLOW_ENABLED=true
VITE_COMPLIANCE_ENABLED=true
VITE_MULTI_TENANT_ENABLED=true
VITE_USAGE_TRACKING_ENABLED=true
VITE_BILLING_ENABLED=false
```

**Usage**:
- Enable features gradually in production
- Use for A/B testing
- Quick rollback if issues occur

### 10. Chaos Engineering

```bash
# Chaos Configuration
CHAOS_ENABLED=false
CHAOS_PROBABILITY=0.1
```

**⚠️ WARNING**:
- NEVER enable in production without explicit approval
- Only use in development/staging
- Start with low probability (0.01)
- Monitor closely

### 11. Testing

```bash
# Test Environment
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/valuecanvas_test
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_KEY=your-test-anon-key
TEST_JWT_SECRET=test-jwt-secret
TEST_API_URL=http://localhost:3000
TEST_AUTH_TOKEN=test-token

# Mocking
MOCK_LLM_ENABLED=false
VITE_MOCK_AGENTS=false
```

**Setup**:
1. Create separate test database
2. Use separate Supabase project for testing
3. Enable mocking to avoid API costs

## Environment-Specific Configurations

### Development (.env.local)

```bash
# Minimal configuration for local development
VITE_APP_ENV=development
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000

# Use local services
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Enable debugging
VITE_SDUI_DEBUG=true
LOG_LEVEL=debug
VITE_SOURCE_MAPS=true

# Disable production features
SECRETS_MANAGER_ENABLED=false
CLOUDWATCH_ENABLED=false
S3_ENABLED=false
EMAIL_ENABLED=false

# Enable mocking
MOCK_LLM_ENABLED=true
```

### Staging (.env.staging)

```bash
# Production-like configuration
VITE_APP_ENV=staging
VITE_APP_URL=https://staging.valuecanvas.com
VITE_API_BASE_URL=https://api-staging.valuecanvas.com

# Use staging services
REDIS_URL=redis://staging-redis:6379
REDIS_ENABLED=true

# Enable monitoring
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=staging
CLOUDWATCH_ENABLED=true

# Enable all features
SECRETS_MANAGER_ENABLED=true
S3_ENABLED=true
EMAIL_ENABLED=true

# Enable chaos testing
CHAOS_ENABLED=true
CHAOS_PROBABILITY=0.05
```

### Production (.env.production)

```bash
# Production configuration
VITE_APP_ENV=production
VITE_APP_URL=https://app.valuecanvas.com
VITE_API_BASE_URL=https://api.valuecanvas.com

# Use production services
REDIS_URL=redis://production-redis:6379
REDIS_ENABLED=true

# Enable all monitoring
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=production
CLOUDWATCH_ENABLED=true
DATADOG_ENABLED=true

# Enable all security
VITE_HTTPS_ONLY=true
CSRF_PROTECTION_ENABLED=true
CSP_ENABLED=true

# Enable all features
SECRETS_MANAGER_ENABLED=true
S3_ENABLED=true
EMAIL_ENABLED=true
VITE_BILLING_ENABLED=true

# Disable debugging
VITE_SDUI_DEBUG=false
LOG_LEVEL=info
VITE_SOURCE_MAPS=false

# NEVER enable chaos in production
CHAOS_ENABLED=false
```

## Verification

### Check Required Variables

```bash
# Create verification script
cat > scripts/verify-env.sh << 'EOF'
#!/bin/bash

REQUIRED_VARS=(
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_ANON_KEY"
  "JWT_SECRET"
  "TOGETHER_API_KEY"
  "REDIS_URL"
)

MISSING=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING+=("$var")
  fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "✅ All required variables are set"
  exit 0
else
  echo "❌ Missing required variables:"
  printf '  - %s\n' "${MISSING[@]}"
  exit 1
fi
EOF

chmod +x scripts/verify-env.sh
./scripts/verify-env.sh
```

### Test Connections

```bash
# Test Redis
redis-cli -u $REDIS_URL ping

# Test Supabase
curl "$VITE_SUPABASE_URL/rest/v1/" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"

# Test Together.ai
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer $TOGETHER_API_KEY"

# Test AWS
aws s3 ls s3://$S3_BUCKET_NAME
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# Add to .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
echo ".env.staging" >> .gitignore
```

### 2. Use Secrets Manager in Production

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name valuecanvas/production/secrets \
  --secret-string '{
    "TOGETHER_API_KEY": "your-key",
    "OPENAI_API_KEY": "your-key",
    "JWT_SECRET": "your-secret"
  }'
```

### 3. Rotate Secrets Regularly

```bash
# Rotate JWT secret every 90 days
# Rotate API keys every 180 days
# Rotate database passwords every 90 days
```

### 4. Use Environment-Specific Keys

```bash
# Development
TOGETHER_API_KEY=dev-key-here

# Staging
TOGETHER_API_KEY=staging-key-here

# Production
TOGETHER_API_KEY=prod-key-here
```

## Troubleshooting

### Missing Variables

```bash
# Error: VITE_SUPABASE_URL is not defined
# Solution: Add to .env.local
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" >> .env.local
```

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Or use docker-compose
docker-compose up -d redis
```

### LLM API Errors

```bash
# Test API key
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer $TOGETHER_API_KEY"

# Check rate limits
# Check billing status
```

### AWS Credentials Invalid

```bash
# Verify credentials
aws sts get-caller-identity

# Configure credentials
aws configure
```

## Support

For issues or questions:
- Documentation: This file
- Slack: #engineering
- Email: platform@valuecanvas.com
