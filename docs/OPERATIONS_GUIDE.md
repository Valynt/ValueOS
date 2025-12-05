# ValueCanvas Operations Guide

**Last Updated:** December 5, 2025  
**Version:** 2.0.0

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Deployment Instructions](#deployment-instructions)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Backup & Recovery](#backup--recovery)
6. [Disaster Recovery](#disaster-recovery)
7. [Routine Maintenance](#routine-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Runbooks](#runbooks)
10. [Support & Escalation](#support--escalation)

---

## Environment Setup

### Prerequisites

#### Required Accounts
| Service | Purpose | Required |
|---------|---------|----------|
| Supabase | Database, Auth, Realtime | ✅ Yes |
| Together.ai | LLM API (primary) | ✅ Yes |
| OpenAI | LLM API (fallback) | ⚠️ Recommended |
| Vercel/Netlify | Frontend hosting | ✅ Yes |
| Sentry | Error tracking | ⚠️ Recommended |
| Posthog | Analytics | ⚠️ Optional |

#### Required Tools
```bash
Node.js >= 18.0.0
npm >= 9.0.0
Supabase CLI >= 1.100.0
Docker >= 20.10 (for local testing)
```

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/valuecanvas.git
cd valuecanvas
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Update required variables (see below)

# 4. Verify configuration
npm run verify-env

# 5. Start development
npm run dev
```

### Environment Variables

#### Minimum Configuration (Development)

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

# LLM Services (server-side only - NO VITE_ prefix!)
TOGETHER_API_KEY=your-together-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# Redis
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

#### Production Configuration

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
```

#### LLM Provider Configuration

```bash
# Provider selection (client-side)
VITE_LLM_PROVIDER=together  # or 'openai'
VITE_LLM_GATING_ENABLED=true

# API Keys (server-side ONLY - never prefix with VITE_)
TOGETHER_API_KEY=your-key  # Get from https://api.together.xyz/settings/api-keys
OPENAI_API_KEY=your-key    # Get from https://platform.openai.com/api-keys
```

### Verification

```bash
# Verify environment
./scripts/verify-env.sh

# Test Redis
redis-cli -u $REDIS_URL ping

# Test Supabase
curl "$VITE_SUPABASE_URL/rest/v1/" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"

# Test Together.ai
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer $TOGETHER_API_KEY"
```

---

## Deployment Instructions

### Development

```bash
# Start local Supabase
supabase start

# Start development server
npm run dev

# Access at http://localhost:5173
```

### Staging

```bash
# Build application
npm run build

# Deploy to staging
vercel --env staging

# Or with Netlify
netlify deploy --dir=dist
```

### Production

#### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Set environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_TOGETHER_API_KEY production

# Deploy
vercel --prod
```

#### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

#### Option 3: Cloudflare Pages

1. Connect repository in Cloudflare Dashboard > Pages
2. Configure build settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: 18
3. Add environment variables in dashboard

### Supabase Deployment

```bash
# Link to remote project
supabase link --project-ref your-project-ref

# Push database schema
supabase db push

# Deploy Edge Functions
supabase functions deploy

# Set secrets
supabase secrets set TOGETHER_API_KEY=your-key
supabase secrets set OPENAI_API_KEY=your-key
```

### Database Migrations

```bash
# Create new migration
supabase migration new add_feature_name

# Apply migrations locally
supabase db reset

# Push to remote
supabase db push

# Rollback (if needed)
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

---

## CI/CD Pipeline

### Smart Matrix Builds

The pipeline uses dynamic matrix generation to only build changed services:

```yaml
detect-changes:
  runs-on: ubuntu-latest
  outputs:
    services: ${{ steps.filter.outputs.changes }}
  steps:
    - uses: dorny/paths-filter@v3
      with:
        filters: |
          opportunity:
            - 'blueprint/infra/backend/services/opportunity/**'
          frontend:
            - 'src/**'
            - 'public/**'
```

### Optimization Results

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Frontend-only change | 20 min | 3 min | 85% |
| Single service change | 20 min | 5 min | 75% |
| Documentation only | 20 min | 2 min | 90% |

### Deployment Workflow

```
Push to main
    ↓
detect-changes (paths-filter)
    ↓
test (always runs)
    ↓
security-scan (always runs)
    ↓
build-images (only changed services)
    ↓
deploy-infrastructure (if infra changed)
    ↓
deploy-kubernetes (only changed services)
    ↓
deploy-frontend (if frontend changed)
    ↓
smoke-tests
    ↓
deployment-summary
```

### Force Full Deployment

```bash
# Via workflow dispatch
gh workflow run deploy-production.yml \
  --field force_full_deploy=true
```

---

## Monitoring & Alerting

### Key Metrics

#### Application Health
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | <99% |
| Response time (P95) | <500ms | >1s |
| Error rate | <0.1% | >1% |

#### Database
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Query performance (P95) | <100ms | >500ms |
| Connection pool usage | <80% | >90% |
| Disk usage | <70% | >80% |

#### LLM API
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Latency (P95) | <5s | >10s |
| Cost per hour | <$10 | >$50 |
| Error rate | <2% | >5% |

### Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| System Health | /d/system-health | Overall health |
| LLM Metrics | /d/llm-metrics | LLM performance |
| Cost Tracking | /d/cost-tracking | Cost monitoring |
| Agent Performance | /d/agent-perf | Agent metrics |

### Alert Configuration

#### Critical Alerts (PagerDuty)
- Uptime < 99%
- Error rate > 1%
- Database connection failures
- Payment processing failures

#### Warning Alerts (Slack/Email)
- Response time P95 > 1s
- Disk usage > 80%
- LLM costs > 150% baseline
- Failed background jobs

### Observability Stack

```bash
# Start observability stack
docker-compose -f infrastructure/docker-compose.observability.yml up -d

# Access dashboards
# Jaeger: http://localhost:16686
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001
```

---

## Backup & Recovery

### Database Backups

#### Supabase Cloud
- Automatic daily backups (7-day retention on Pro)
- Point-in-time recovery available
- Manual backup: `supabase db dump > backup.sql`

#### Manual Backup

```bash
# Create backup
supabase db dump -f production-backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh production-backup-*.sql
wc -l production-backup-*.sql

# Upload to S3
aws s3 cp production-backup-*.sql s3://valuecanvas-backups/backups/
```

#### Automated Backup (Cron)

```bash
# Add to crontab
0 2 * * * pg_dump -h localhost -U postgres valuecanvas > /backups/valuecanvas-$(date +\%Y\%m\%d).sql
```

### Restore Procedures

```bash
# List available backups
aws s3 ls s3://valuecanvas-backups/backups/

# Download backup
aws s3 cp s3://valuecanvas-backups/backups/latest.sql .

# Verify checksum
sha256sum -c latest.sql.sha256

# Restore
psql $DATABASE_URL < latest.sql

# Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Backup Locations

| Data Type | Location | Retention |
|-----------|----------|-----------|
| Database | S3 + Supabase | 30 days |
| Configuration | GitHub | Forever |
| Secrets | AWS Secrets Manager | N/A |
| Logs | CloudWatch | 90 days |

---

## Disaster Recovery

### Recovery Objectives

| Service | RTO | RPO | Priority |
|---------|-----|-----|----------|
| Database | 5 min | 1 hour | P0 |
| API Services | 10 min | 0 | P0 |
| LLM Services | 15 min | 0 | P1 |
| Redis Cache | 5 min | N/A | P1 |
| Frontend | 10 min | 0 | P2 |

### Emergency Contacts

```
Primary On-Call: PagerDuty rotation
Engineering Manager: [contact]
CTO: [contact]

Vendors:
- AWS Support: 1-866-947-7829
- Supabase Support: support@supabase.io
- Together.ai Support: support@together.ai
```

### Escalation Path

```
Level 1: On-Call Engineer (0-15 min)
Level 2: Engineering Manager (15-30 min)
Level 3: CTO + Infrastructure Team (30-60 min)
Level 4: CEO + All Hands (60+ min)
```

### Scenario: Database Failure

```bash
# 1. Assess health
psql $DATABASE_URL -c "SELECT version();"

# 2. Check replication lag
psql $DATABASE_URL -c "
  SELECT client_addr, state, pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag
  FROM pg_stat_replication;
"

# 3. Failover to replica (if needed)
# Contact Supabase support for managed failover

# 4. Restore from backup (if corruption)
supabase db reset --version <previous-version>
```

### Scenario: LLM Service Outage

```bash
# 1. Check circuit breaker status
curl https://api.valuecanvas.com/api/llm/health

# 2. Verify fallback is working
curl -X POST https://api.valuecanvas.com/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "Test"}'
# Response should show: "provider": "openai" if fallback active

# 3. Reset circuit breaker (after recovery)
curl -X POST https://api.valuecanvas.com/api/llm/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Scenario: Complete System Outage

```bash
# 1. Check AWS status
curl https://status.aws.amazon.com/

# 2. Check DNS
dig api.valuecanvas.com

# 3. Activate DR site (if available)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-failover.json

# 4. Rebuild from IaC
cd infrastructure/terraform
terraform init && terraform apply -auto-approve
kubectl apply -f k8s/production/
```

---

## Routine Maintenance

### Daily Tasks

- [ ] Check error logs in Sentry
- [ ] Review dashboard metrics
- [ ] Verify backup completion
- [ ] Check LLM cost tracking

### Weekly Tasks

- [ ] Review performance trends
- [ ] Check disk usage
- [ ] Review security alerts
- [ ] Update dependencies (minor)

### Monthly Tasks

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Cost analysis
- [ ] Documentation review
- [ ] DR test (quarterly)

### Database Maintenance

```sql
-- Vacuum and analyze
VACUUM ANALYZE;

-- Refresh materialized views
SELECT refresh_agent_performance_metrics();

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Cache Maintenance

```bash
# Check Redis memory
redis-cli INFO memory

# Clear cache (if needed)
redis-cli FLUSHDB

# Warm up cache
curl -X POST https://api.valuecanvas.com/api/admin/cache/warmup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Troubleshooting

### Quick Diagnostics

```bash
# Check application status
curl https://app.valuecanvas.com/health

# Check Supabase connection
supabase status

# Verify environment
npm run check-env

# Run tests
npm test

# Check TypeScript
npm run typecheck
```

### Common Issues

#### Cannot connect to Supabase

**Symptoms:** Network errors, 401 Unauthorized

**Solutions:**
1. Verify environment variables
2. Check Supabase project status
3. Verify CORS settings
4. Check RLS policies

#### Agent not responding

**Symptoms:** Spinner indefinitely, timeout errors

**Solutions:**
1. Check Together.ai API status
2. Verify API key
3. Review rate limits
4. Check logs: `localStorage.setItem('DEBUG', 'agent:*')`

#### SDUI components not rendering

**Symptoms:** Blank canvas, "Component not found"

**Solutions:**
1. Check component registry
2. Verify SDUI schema validation
3. Check sanitization issues

#### Authentication loop

**Symptoms:** Redirects back to login

**Solutions:**
1. Clear local storage
2. Check cookie settings
3. Verify JWT expiration
4. Check redirect URLs in Supabase

### Performance Issues

#### Slow page loads

```bash
# Build analysis
npm run build -- --analyze

# Bundle size check
npx source-map-explorer dist/*.js
```

#### High LLM latency

```typescript
// Enable streaming
const stream = await agent.chatStream(input);

// Monitor token usage
console.log(`Tokens: ${response.usage.total_tokens}`);
```

#### Slow database queries

```sql
-- Find slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add indexes
CREATE INDEX CONCURRENTLY idx_value_cases_user_status 
ON value_cases(user_id, status);
```

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| AUTH_001 | Invalid credentials | Check email/password |
| AUTH_002 | Session expired | Re-authenticate |
| AGENT_001 | LLM API timeout | Retry request |
| AGENT_002 | Rate limit exceeded | Wait or upgrade |
| SDUI_001 | Invalid schema | Check SDUI structure |
| SDUI_002 | Component not found | Register component |
| DB_001 | Connection failed | Check Supabase status |
| DB_002 | Query timeout | Optimize query |

---

## Runbooks

### Runbook: Deploy New Version

```bash
# 1. Pre-deployment
npm test
npm run build
supabase db diff  # Check for migrations

# 2. Backup
supabase db dump -f pre-deploy-backup.sql

# 3. Deploy database changes
supabase db push

# 4. Deploy application
vercel --prod

# 5. Verify
curl https://api.valuecanvas.com/health/ready

# 6. Monitor (30 min)
# Watch error rates, response times
```

### Runbook: Rollback Deployment

```bash
# Frontend rollback (Vercel)
vercel ls
vercel rollback <deployment-url>

# Database rollback
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql

# Edge Functions rollback
git checkout <previous-commit>
supabase functions deploy
git checkout main
```

### Runbook: Rotate API Keys

```bash
# 1. Generate new key in provider dashboard

# 2. Update secrets
supabase secrets set TOGETHER_API_KEY=new-key

# 3. Update environment variables
vercel env add TOGETHER_API_KEY production

# 4. Redeploy
vercel --prod

# 5. Verify
curl -X POST https://api.valuecanvas.com/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "Test"}'

# 6. Revoke old key in provider dashboard
```

### Runbook: Security Incident

```bash
# 1. Immediate containment
aws secretsmanager rotate-secret --secret-id valuecanvas/production/secrets

# 2. Revoke sessions
psql $DATABASE_URL -c "DELETE FROM auth.sessions;"

# 3. Block suspicious IPs
kubectl apply -f security/block-suspicious-ips.yaml

# 4. Enable audit logging
kubectl patch deployment api-server \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", 
       "value": {"name": "AUDIT_LOG_LEVEL", "value": "debug"}}]'

# 5. Export logs for forensics
kubectl logs -l app=api-server --since=24h > incident-logs.txt

# 6. Notify stakeholders
# Follow incident response playbook
```

### Runbook: Scale for High Traffic

```bash
# 1. Scale API servers
kubectl scale deployment/api-server --replicas=10

# 2. Scale LLM workers
kubectl scale deployment/llm-worker --replicas=10

# 3. Increase Redis memory
redis-cli CONFIG SET maxmemory 4gb

# 4. Enable aggressive caching
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 5. Monitor
kubectl top pods
kubectl top nodes
```

---

## Support & Escalation

### Self-Service Resources

1. This Operations Guide
2. [Technical Reference](./TECHNICAL_REFERENCE.md)
3. [Project Status](./PROJECT_STATUS.md)
4. GitHub Issues
5. Supabase/Together.ai status pages

### Support Channels

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| Slack #valuecanvas-support | General questions | <4 hours |
| Email support@valuecanvas.app | Customer issues | <24 hours |
| PagerDuty | Production incidents | <15 min |
| GitHub Issues | Bug reports | <48 hours |

### Reporting Issues

Include:
1. Error message (full stack trace)
2. Steps to reproduce
3. Environment (browser, OS, version)
4. Network logs (if applicable)
5. Sentry event ID (if applicable)

### On-Call Responsibilities

- Monitor alerts and dashboards
- Respond to incidents within SLA
- Document all actions taken
- Escalate when necessary
- Complete post-incident review

---

## Production Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code review complete
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Secrets management verified

### Security

- [ ] Secrets in secure vault (not .env files)
- [ ] RLS policies enabled and tested
- [ ] CORS configured for production only
- [ ] Rate limiting enabled
- [ ] CSP headers configured
- [ ] HTTPS enforced (HSTS)
- [ ] API keys rotated from development

### Performance

- [ ] Build optimized
- [ ] Bundle size analyzed
- [ ] Images optimized
- [ ] Lazy loading implemented
- [ ] Database indexes created
- [ ] Connection pooling configured

### Monitoring

- [ ] Sentry configured
- [ ] Analytics tracking
- [ ] Uptime monitoring
- [ ] Log aggregation
- [ ] Alert thresholds set

### Post-Deployment

- [ ] Smoke tests passing
- [ ] Error rates normal
- [ ] Response times normal
- [ ] Monitoring for 24-48 hours
- [ ] Documentation updated

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Last Updated** | December 5, 2025 |
| **Owner** | DevOps Team |
| **Review Cycle** | Monthly |

---

## Merged Source Files

This document consolidates content from:
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Pre/post deployment checks
- `ENVIRONMENT_SETUP.md` - Environment configuration
- `DISASTER_RECOVERY_RUNBOOK.md` - DR procedures
- `CI_CD_OPTIMIZATION.md` - CI/CD pipeline
- `OBSERVABILITY.md` - Monitoring setup
- `TROUBLESHOOTING_GUIDE.md` - Common issues
- `LOAD_TESTING_GUIDE.md` - Performance testing
- `CHAOS_ENGINEERING_GUIDE.md` - Chaos testing
- `PRE_COMMIT_HOOKS_GUIDE.md` - Git hooks

---

## Notes on Restructuring

1. **Deployment Consolidation:** Merged multiple deployment guides into unified section with environment-specific instructions
2. **Runbook Standardization:** Created consistent runbook format with numbered steps
3. **Alert Unification:** Combined alerting rules from multiple sources into single reference
4. **Troubleshooting Merge:** Consolidated troubleshooting from multiple files into categorized sections
5. **Checklist Integration:** Incorporated pre/post deployment checklists into relevant sections
