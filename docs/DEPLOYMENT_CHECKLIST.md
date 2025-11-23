# Deployment Checklist

Complete checklist for deploying ValueCanvas with all LLM infrastructure features.

## Pre-Deployment

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env.production`
- [ ] Set all required environment variables (see ENVIRONMENT_SETUP.md)
- [ ] Verify environment variables: `./scripts/verify-env.sh`
- [ ] Test connections to all external services
- [ ] Configure AWS credentials
- [ ] Set up Secrets Manager secrets
- [ ] Configure CloudWatch log groups

### 2. Dependencies

- [ ] Install Node.js >= 18.0.0
- [ ] Install PostgreSQL >= 13.0
- [ ] Install Redis >= 6.0
- [ ] Install Docker & Docker Compose
- [ ] Install k6 (for load testing)
- [ ] Install pre-commit hooks: `pre-commit install`

### 3. Database Setup

- [ ] Create production database
- [ ] Run all migrations:
  ```bash
  psql $DATABASE_URL -f supabase/migrations/20241123110000_add_llm_monitoring.sql
  psql $DATABASE_URL -f supabase/migrations/20241123120000_add_prompt_version_control.sql
  psql $DATABASE_URL -f supabase/migrations/20241123130000_add_feature_flags.sql
  psql $DATABASE_URL -f supabase/migrations/20241123140000_add_llm_job_results.sql
  ```
- [ ] Verify Row Level Security (RLS) policies
- [ ] Create database backups
- [ ] Test backup restoration
- [ ] Configure automated backup schedule

### 4. Redis Setup

- [ ] Deploy Redis instance (or use managed service)
- [ ] Configure Redis password
- [ ] Enable Redis persistence
- [ ] Test Redis connection
- [ ] Configure Redis maxmemory policy

### 5. AWS Services

- [ ] Create S3 bucket for backups
- [ ] Configure S3 lifecycle policies
- [ ] Create Secrets Manager secrets
- [ ] Configure IAM roles and policies
- [ ] Create CloudWatch log groups
- [ ] Test AWS credentials

### 6. LLM Providers

- [ ] Obtain Together.ai API key
- [ ] Obtain OpenAI API key (fallback)
- [ ] Test API keys
- [ ] Configure rate limits
- [ ] Set up billing alerts
- [ ] Test circuit breaker failover

### 7. Monitoring

- [ ] Set up Sentry project
- [ ] Configure Sentry DSN
- [ ] Deploy observability stack:
  ```bash
  docker-compose -f infrastructure/docker-compose.observability.yml up -d
  ```
- [ ] Verify Jaeger UI: http://localhost:16686
- [ ] Verify Prometheus: http://localhost:9090
- [ ] Verify Grafana: http://localhost:3001
- [ ] Import Grafana dashboards
- [ ] Configure alerts

## Deployment

### 1. Build Application

```bash
# Install dependencies
npm ci

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build application
npm run build

# Verify build
ls -lh dist/
```

### 2. Deploy Infrastructure

```bash
# Deploy with Terraform
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# Or deploy with Kubernetes
kubectl apply -f k8s/production/
```

### 3. Deploy Application

```bash
# Deploy to production
# (Adjust based on your deployment method)

# Docker
docker build -t valuecanvas:latest .
docker push valuecanvas:latest

# Kubernetes
kubectl set image deployment/api-server api-server=valuecanvas:latest
kubectl rollout status deployment/api-server

# Verify deployment
kubectl get pods
kubectl logs -l app=api-server
```

### 4. Start Workers

```bash
# Start message queue workers
pm2 start src/services/MessageQueue.ts --name llm-worker --instances 3

# Or with Kubernetes
kubectl scale deployment/llm-worker --replicas=3

# Verify workers
pm2 status
# or
kubectl get pods -l app=llm-worker
```

### 5. Smoke Tests

```bash
# Health check
curl https://api.valuecanvas.com/health/ready

# Test LLM endpoint
curl -X POST https://api.valuecanvas.com/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test", "model": "meta-llama/Llama-3-70b-chat-hf"}'

# Test canvas generation
curl -X POST https://api.valuecanvas.com/api/canvas/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessDescription": "Test business",
    "industry": "Technology"
  }'

# Test queue
curl -X POST https://api.valuecanvas.com/api/queue/llm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "canvas_generation",
    "promptKey": "canvas.generate",
    "promptVariables": {"businessDescription": "Test"}
  }'

# Check metrics
curl https://api.valuecanvas.com/api/llm/stats
curl https://api.valuecanvas.com/api/queue/metrics
```

## Post-Deployment

### 1. Monitoring Setup

- [ ] Verify logs in CloudWatch
- [ ] Check Sentry for errors
- [ ] Verify traces in Jaeger
- [ ] Check metrics in Prometheus
- [ ] Review Grafana dashboards
- [ ] Test alerting rules

### 2. Performance Validation

```bash
# Run load test
k6 run test/load/llm-load-test.js

# Verify results
# - P95 latency < 5s
# - Error rate < 5%
# - Cache hit rate > 30%
```

### 3. Feature Flags

- [ ] Verify feature flags are loaded
- [ ] Test feature flag evaluation
- [ ] Configure initial rollout percentages
- [ ] Set up A/B tests

### 4. Backup Verification

```bash
# Trigger manual backup
./scripts/backup-database.sh

# Verify backup in S3
aws s3 ls s3://valuecanvas-backups/backups/

# Test restoration
./scripts/restore-database.sh <backup-file>
```

### 5. Security Verification

- [ ] Verify HTTPS is enforced
- [ ] Test CORS configuration
- [ ] Verify rate limiting works
- [ ] Test CSRF protection
- [ ] Verify CSP headers
- [ ] Run security scan: `npm run security:scan`
- [ ] Check for exposed secrets

### 6. Documentation

- [ ] Update API documentation
- [ ] Document deployment process
- [ ] Update runbooks
- [ ] Document rollback procedures
- [ ] Update team wiki

## Rollback Procedures

### Quick Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/api-server

# Docker
docker pull valuecanvas:previous
docker service update --image valuecanvas:previous api-server

# Verify
curl https://api.valuecanvas.com/health/ready
```

### Database Rollback

```bash
# Restore from backup
./scripts/restore-database.sh <previous-backup>

# Verify
psql $DATABASE_URL -c "SELECT version();"
```

### Feature Flag Rollback

```bash
# Disable problematic feature
curl -X PUT https://api.valuecanvas.com/api/flags/new-feature \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'
```

## Validation Checklist

### Functional Tests

- [ ] User can sign up/login
- [ ] User can create canvas
- [ ] LLM generates canvas successfully
- [ ] Canvas refinement works
- [ ] Caching works (check cache hit rate)
- [ ] Circuit breaker activates on failures
- [ ] Queue processes jobs
- [ ] Feature flags work
- [ ] Prompt versioning works

### Performance Tests

- [ ] P95 latency < 5s
- [ ] P99 latency < 10s
- [ ] Error rate < 5%
- [ ] Throughput > 100 req/s
- [ ] Cache hit rate > 30%
- [ ] Queue processing rate adequate

### Reliability Tests

- [ ] Health checks pass
- [ ] Circuit breaker works
- [ ] Fallback to OpenAI works
- [ ] Retry logic works
- [ ] Graceful degradation works

### Security Tests

- [ ] Authentication required
- [ ] Authorization enforced
- [ ] Rate limiting works
- [ ] CORS configured correctly
- [ ] No secrets exposed
- [ ] HTTPS enforced

### Monitoring Tests

- [ ] Logs appear in CloudWatch
- [ ] Errors appear in Sentry
- [ ] Traces appear in Jaeger
- [ ] Metrics appear in Prometheus
- [ ] Dashboards show data
- [ ] Alerts trigger correctly

## Common Issues

### Issue: High Error Rate

**Symptoms**: Error rate > 5%

**Diagnosis**:
```bash
# Check logs
kubectl logs -l app=api-server --tail=100

# Check Sentry
# Check circuit breaker status
curl https://api.valuecanvas.com/api/llm/health
```

**Resolution**:
1. Check LLM provider status
2. Verify API keys
3. Check rate limits
4. Review recent changes
5. Consider rollback

### Issue: High Latency

**Symptoms**: P95 latency > 5s

**Diagnosis**:
```bash
# Check traces in Jaeger
# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Check Redis
redis-cli --latency
```

**Resolution**:
1. Check database queries
2. Verify Redis performance
3. Check LLM provider latency
4. Review cache hit rate
5. Scale horizontally

### Issue: Queue Backlog

**Symptoms**: Jobs not processing

**Diagnosis**:
```bash
# Check queue metrics
curl https://api.valuecanvas.com/api/queue/metrics

# Check worker logs
kubectl logs -l app=llm-worker
```

**Resolution**:
1. Scale workers: `kubectl scale deployment/llm-worker --replicas=10`
2. Check Redis connection
3. Verify LLM provider availability
4. Review job failure rate

### Issue: Cache Not Working

**Symptoms**: Cache hit rate < 10%

**Diagnosis**:
```bash
# Check Redis
redis-cli INFO stats

# Check cache configuration
echo $LLM_CACHE_ENABLED
echo $LLM_CACHE_TTL
```

**Resolution**:
1. Verify Redis connection
2. Check cache TTL
3. Verify cache keys
4. Review cache invalidation logic

## Emergency Contacts

- **On-Call Engineer**: PagerDuty
- **Engineering Manager**: [contact]
- **CTO**: [contact]
- **AWS Support**: 1-866-947-7829
- **Supabase Support**: support@supabase.io
- **Together.ai Support**: support@together.ai

## Post-Deployment Review

### Within 24 Hours

- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify cost tracking
- [ ] Review user feedback
- [ ] Document issues encountered
- [ ] Update runbooks

### Within 1 Week

- [ ] Conduct post-mortem if issues occurred
- [ ] Update documentation
- [ ] Implement improvements
- [ ] Schedule follow-up review

## Sign-Off

- [ ] Engineering Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] CTO: _________________ Date: _______

---

**Deployment Date**: _________________  
**Deployed By**: _________________  
**Version**: _________________  
**Environment**: _________________
