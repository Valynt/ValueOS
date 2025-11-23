# Backend Dependencies for LLM Infrastructure

This document lists the required backend dependencies for the LLM cost control and reliability infrastructure.

## Required npm Packages

Add these to your backend `package.json`:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.10",
    "ioredis": "^5.3.2",
    "opossum": "^8.1.0",
    "winston": "^3.11.0",
    "winston-cloudwatch": "^6.2.0",
    "@aws-sdk/client-secrets-manager": "^3.450.0",
    "@aws-sdk/client-s3": "^3.450.0",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.20",
    "@types/node": "^20.9.0"
  }
}
```

## Package Descriptions

### Core Dependencies

- **express** (^4.18.2)
  - Web framework for API endpoints
  - Used in: `src/api/llm.ts`, `src/api/health.ts`

- **redis** (^4.6.10) or **ioredis** (^5.3.2)
  - Redis client for rate limiting and caching
  - Used in: `src/middleware/llmRateLimiter.ts`, `src/services/LLMCache.ts`
  - Note: Choose one based on your preference (ioredis has better TypeScript support)

- **opossum** (^8.1.0)
  - Circuit breaker implementation
  - Used in: `src/services/LLMFallback.ts`
  - Features: Automatic fallback, health checks, metrics

- **winston** (^3.11.0)
  - Structured logging framework
  - Used in: `src/utils/logger.ts`
  - Features: Multiple transports, log levels, formatting

- **winston-cloudwatch** (^6.2.0)
  - CloudWatch transport for Winston
  - Used in: `src/utils/logger.ts`
  - Enables centralized log aggregation in AWS

### AWS SDK

- **@aws-sdk/client-secrets-manager** (^3.450.0)
  - AWS Secrets Manager client
  - Used in: `src/config/secretsManager.ts`
  - Features: Secret retrieval, rotation, caching

- **@aws-sdk/client-s3** (^3.450.0)
  - AWS S3 client for backups
  - Used in: `scripts/backup-database.sh` (via AWS CLI)
  - Features: Encrypted storage, lifecycle policies

### Database

- **pg** (^8.11.3)
  - PostgreSQL client
  - Used in: `src/api/health.ts`, backup scripts
  - Features: Connection pooling, prepared statements

## Installation

```bash
# Install all dependencies
npm install express redis opossum winston winston-cloudwatch \
  @aws-sdk/client-secrets-manager @aws-sdk/client-s3 pg

# Install dev dependencies
npm install -D @types/express @types/node
```

## Environment Variables

Required environment variables for these dependencies:

```bash
# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Together.ai
TOGETHER_API_KEY=your_together_api_key

# OpenAI (fallback)
OPENAI_API_KEY=your_openai_api_key

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Secrets Manager
SECRETS_MANAGER_SECRET_NAME=valuecanvas/production/secrets

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# CloudWatch
CLOUDWATCH_LOG_GROUP=/valuecanvas/application
CLOUDWATCH_LOG_STREAM=production
```

## Version Compatibility

- **Node.js**: >= 18.0.0 (required for native fetch API)
- **TypeScript**: >= 5.0.0
- **Redis**: >= 6.0.0 (for advanced features)
- **PostgreSQL**: >= 13.0 (for modern SQL features)

## Optional Dependencies

### For Enhanced Monitoring

```json
{
  "dependencies": {
    "prom-client": "^15.0.0",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0"
  }
}
```

### For Testing

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16",
    "redis-mock": "^0.56.3"
  }
}
```

## Peer Dependencies

Some packages may require peer dependencies:

```bash
# Check for peer dependency warnings
npm install

# Install any missing peer dependencies
npm install <missing-peer-dep>
```

## Security Considerations

1. **Keep dependencies updated**: Run `npm audit` regularly
2. **Use exact versions in production**: Consider using `npm ci` instead of `npm install`
3. **Review security advisories**: Check GitHub security alerts
4. **Use Snyk or similar**: `npm install -g snyk && snyk test`

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
# Should return: PONG
```

### AWS SDK Issues

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test Secrets Manager access
aws secretsmanager list-secrets
```

### Circuit Breaker Not Working

```typescript
// Enable debug logging
process.env.DEBUG = 'opossum:*';
```

## Next Steps

1. Install dependencies: `npm install`
2. Configure environment variables
3. Run database migrations: `npm run migrate`
4. Start Redis: `docker-compose up redis`
5. Test health endpoint: `curl http://localhost:3000/health/ready`
