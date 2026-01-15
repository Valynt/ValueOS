# Staging Deployment Runbook

**Version**: 1.0  
**Last Updated**: 2025-12-13  
**Status**: 🔴 BLOCKED - Awaiting Infrastructure Access

## Purpose

Define all requirements and steps needed to deploy ValueCanvas to staging safely and repeatably once infrastructure access is available.

**Scope**: Staging only (non-prod)  
**Assumption**: App builds successfully and tests pass in development

---

## 1. Staging Environment Requirements

### 1.1 Cloud Provider Access (one required)

**AWS / GCP / Azure account**

IAM role or service account with:

- Compute deploy permissions
- Networking access
- Secrets read access
- Container registry access

**Artifacts Required**:

- [ ] Account ID: `_________________`
- [ ] Region(s): `_________________`
- [ ] Role / Service Account name: `_________________`

### 1.2 Environment Configuration

#### Required Environment Variables

```bash
# Application
NODE_ENV=staging
APP_ENV=staging
ENVIRONMENT=staging

# URLs
STAGING_BASE_URL=https://staging.valuecanvas.app
STAGING_API_URL=https://api-staging.valuecanvas.app

# Database
DATABASE_URL=postgresql://user:pass@host:5432/valuecanvas_staging
REDIS_URL=redis://host:6379

# Supabase
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_PROJECT_ID=[project-id]

# Security
JWT_SECRET=[32-char-random]
ENCRYPTION_KEY=[32-char-random]
SESSION_SECRET=[32-char-random]

# External Services
TOGETHER_API_KEY=[api-key]
OPENAI_API_KEY=[api-key]

# Monitoring
SENTRY_DSN=[dsn]
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
PROMETHEUS_ENDPOINT=http://prometheus:9090
```

⚠️ **All secrets must be injected via a secrets manager — never committed.**

### 1.3 Database (Staging)

**Database Engine**: PostgreSQL 14+

**Required Extensions**:

- [ ] `uuid-ossp`
- [ ] `pgcrypto`
- [ ] `pg_stat_statements`
- [ ] `pgvector` (optional - for semantic memory features)

**Migration Strategy**:

- [ ] Auto-run on deploy
- [ ] Manual approval required

**Validation Command**:

```sql
SELECT extname, extversion FROM pg_extension;
```

**Expected Output**:

```
extname              | extversion
---------------------|------------
uuid-ossp            | 1.1
pgcrypto             | 1.3
pg_stat_statements   | 1.9
pgvector             | 0.5.0 (optional)
```

### 1.4 External Services

| Service              | Required | Key / Credential                       | Status |
| -------------------- | -------- | -------------------------------------- | ------ |
| Supabase Auth        | Yes      | Project ID, Anon Key, Service Role Key | ⬜     |
| Together AI          | Yes      | API Key                                | ⬜     |
| OpenAI               | Optional | API Key                                | ⬜     |
| Sentry               | Optional | DSN                                    | ⬜     |
| Email (SendGrid/SES) | Optional | API Key                                | ⬜     |
| Analytics            | Optional | Write Key                              | ⬜     |
| Feature Flags        | Optional | SDK Key                                | ⬜     |

### 1.5 Container Registry

**Registry Configuration**:

- [ ] Registry URL: `_________________`
- [ ] Auth mechanism:
  - [ ] OIDC
  - [ ] Token
  - [ ] IAM
- [ ] Image naming convention: `<registry>/<org>/valuecanvas:staging-<git-sha>`

**Example**:

```
ghcr.io/valynt/valuecanvas:staging-a1b2c3d
```

### 1.6 SSL / Networking

**Domain Configuration**:

- [ ] Staging domain: `staging.valuecanvas.app`
- [ ] API domain: `api-staging.valuecanvas.app`

**TLS Certificate Source**:

- [ ] Managed (Let's Encrypt - preferred)
- [ ] Uploaded cert
- [ ] Cloud provider managed

**Network Requirements**:

- [ ] Ingress / load balancer configured
- [ ] Health check endpoint: `/health`
- [ ] CORS origins configured
- [ ] Rate limiting configured

---

## 2. CI/CD Pipeline Requirements

### Required Capabilities

- [ ] Build container image
- [ ] Push to registry
- [ ] Deploy to staging environment
- [ ] Inject secrets at runtime
- [ ] Run health checks
- [ ] Automated rollback on failure

### Required Secrets in CI

- [ ] Cloud credentials (AWS/GCP/Azure)
- [ ] Registry credentials
- [ ] Staging environment secrets
- [ ] Database credentials
- [ ] External service API keys

### Pipeline Configuration

**GitHub Actions** (`.github/workflows/deploy-staging.yml`):

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t valuecanvas:staging-${{ github.sha }} .
      - name: Push to registry
        run: docker push ${{ secrets.REGISTRY_URL }}/valuecanvas:staging-${{ github.sha }}
      - name: Deploy to staging
        run: |
          # Deploy command here
          kubectl set image deployment/valuecanvas valuecanvas=${{ secrets.REGISTRY_URL }}/valuecanvas:staging-${{ github.sha }}
      - name: Run health checks
        run: curl -f https://staging.valuecanvas.app/health
```

---

## 3. Deployment Checklist (Execution Order)

### Pre-Deploy Validation

- [ ] Infrastructure credentials available
- [ ] Secrets stored in secrets manager
- [ ] Database reachable from staging environment
- [ ] Required PostgreSQL extensions installed
- [ ] CI pipeline green on main branch
- [ ] No blocking issues in issue tracker
- [ ] Staging environment resources provisioned
- [ ] DNS records configured
- [ ] SSL certificates valid

### Deploy Steps

1. **Build Phase**
   - [ ] Build container image
   - [ ] Run security scan on image
   - [ ] Tag image with git SHA
   - [ ] Push image to registry

2. **Database Migration Phase**
   - [ ] Backup current staging database
   - [ ] Run migrations (if auto-deploy enabled)
   - [ ] Verify migration success
   - [ ] Rollback plan ready
   - [ ] RLS/policy validation complete

3. **Deployment Phase**
   - [ ] Deploy new image to staging
   - [ ] Wait for readiness probes (max 5 minutes)
   - [ ] Verify pod/container status
   - [ ] Check application logs for errors

4. **Service Validation Phase**
   - [ ] Health endpoint returns 200 OK
   - [ ] Database connectivity verified
   - [ ] Redis connectivity verified
   - [ ] External service connectivity verified

### Post-Deploy Validation

- [ ] `/health` endpoint returns OK
- [ ] API responds to smoke test request
- [ ] Auth flow works (login/logout)
- [ ] No error spikes in logs (check last 5 minutes)
- [ ] Background workers running
- [ ] Metrics being collected
- [ ] No memory leaks detected
- [ ] Response times within SLA (<500ms p95)

**Smoke Test Commands**:

```bash
# Health check
curl -f https://staging.valuecanvas.app/health

# API smoke test
curl -X POST https://api-staging.valuecanvas.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Redis connectivity
redis-cli -u $REDIS_URL ping
```

### Rollback Plan

**If deployment fails**:

1. **Immediate Rollback**

   ```bash
   # Revert to previous image
   kubectl rollout undo deployment/valuecanvas

   # Or specify revision
   kubectl rollout undo deployment/valuecanvas --to-revision=<previous-revision>
   ```

2. **Database Rollback** (if migrations ran)

   ```bash
   # Restore from backup
   pg_restore -d $DATABASE_URL staging_backup_$(date +%Y%m%d).dump
   ```

3. **Migration Rollback / Forward Plan**

   ```bash
   # Inspect applied vs pending migrations
   supabase migration list --db-url $STAGING_DATABASE_URL

   # Roll back a specific migration (preferred: rollback SQL file)
   psql $STAGING_DATABASE_URL -f supabase/migrations/rollback/<timestamp>_<name>_rollback.sql

   # If rollback is unsafe, apply a forward-fix migration instead
   supabase db push --db-url $STAGING_DATABASE_URL --include-all

   # Validate RLS/policies after rollback/forward
   supabase db lint --db-url $STAGING_DATABASE_URL
   psql $STAGING_DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
   ```

4. **Verification**
   - [ ] Previous version deployed
   - [ ] Health checks passing
   - [ ] No errors in logs
   - [ ] Service recovery confirmed

5. **Post-Mortem**
   - [ ] Document failure reason
   - [ ] Create issue for fix
   - [ ] Update runbook with lessons learned

---

## 4. Known Blockers / Risks

### Current Blockers

| Blocker                             | Impact    | Status  | Owner           |
| ----------------------------------- | --------- | ------- | --------------- |
| Missing infrastructure credentials  | 🔴 HIGH   | BLOCKED | Platform/DevOps |
| Staging environment not provisioned | 🔴 HIGH   | BLOCKED | Platform/DevOps |
| Secrets not configured              | 🔴 HIGH   | BLOCKED | Security        |
| CI/CD pipeline not configured       | 🟡 MEDIUM | BLOCKED | Engineering     |

### Identified Risks

| Risk                                 | Probability | Impact | Mitigation                                   |
| ------------------------------------ | ----------- | ------ | -------------------------------------------- |
| Optional DB extensions not installed | Medium      | Medium | Make pgvector conditional (✅ DONE)          |
| Secrets mismatch between dev/staging | Medium      | High   | Use secrets manager, validate on deploy      |
| Long-lived connections not closing   | Low         | Medium | Implement connection pooling                 |
| Migration failures                   | Low         | High   | Test migrations in dev, backup before deploy |
| Container registry auth issues       | Low         | High   | Pre-validate credentials                     |
| DNS propagation delays               | Low         | Low    | Configure DNS ahead of deployment            |
| SSL certificate expiry               | Low         | Medium | Use auto-renewal (Let's Encrypt)             |
| Resource exhaustion                  | Low         | High   | Set resource limits, monitor usage           |

---

## 5. Unblock Conditions

Deployment can proceed when **all** are true:

- [ ] Cloud credentials granted and validated
- [ ] Staging secrets populated in secrets manager
- [ ] Database reachable and extensions installed
- [ ] CI/CD pipeline configured and tested
- [ ] Domain / TLS resolved and validated
- [ ] Container registry access confirmed
- [ ] Monitoring and alerting configured
- [ ] Rollback procedure tested

---

## 6. Monitoring and Observability

### Required Metrics

**Application Metrics**:

- Request rate (requests/second)
- Error rate (errors/second)
- Response time (p50, p95, p99)
- Active connections
- Memory usage
- CPU usage

**Database Metrics**:

- Connection pool usage
- Query latency
- Slow queries (>1s)
- Lock contention
- Replication lag (if applicable)

**Business Metrics**:

- User signups
- Active sessions
- API usage by endpoint
- Feature flag evaluations

### Alerting Rules

| Alert           | Condition                  | Severity    | Action        |
| --------------- | -------------------------- | ----------- | ------------- |
| High error rate | >5% errors for 5 minutes   | 🔴 CRITICAL | Page on-call  |
| Slow responses  | p95 >2s for 5 minutes      | 🟡 WARNING  | Investigate   |
| Database down   | Connection failures        | 🔴 CRITICAL | Page on-call  |
| Memory leak     | Memory >90% for 10 minutes | 🟡 WARNING  | Restart pod   |
| Disk full       | Disk >85%                  | 🟡 WARNING  | Clean up logs |

### Dashboards

- [ ] Application health dashboard
- [ ] Database performance dashboard
- [ ] Infrastructure metrics dashboard
- [ ] Business metrics dashboard

---

## 7. Ownership

| Area                   | Owner               | Contact                     |
| ---------------------- | ------------------- | --------------------------- |
| Infrastructure access  | Platform / DevOps   | devops@valuecanvas.app      |
| Secrets management     | Security / Platform | security@valuecanvas.app    |
| Deployment execution   | Engineering         | engineering@valuecanvas.app |
| Post-deploy validation | Engineering         | engineering@valuecanvas.app |
| Monitoring             | SRE / Engineering   | sre@valuecanvas.app         |
| Incident response      | On-call rotation    | oncall@valuecanvas.app      |

---

## 8. Status

**Deployment Execution**: 🔴 **BLOCKED**  
**Documentation**: ✅ **COMPLETE**  
**Next Action**: Proceed to Week 2 tasks (dev-only) while awaiting infrastructure access

### Completed

- ✅ Runbook documentation
- ✅ Deployment checklist
- ✅ Rollback procedures
- ✅ Risk assessment
- ✅ Monitoring requirements

### Pending

- ⬜ Infrastructure credentials
- ⬜ Staging environment provisioning
- ⬜ Secrets configuration
- ⬜ CI/CD pipeline setup
- ⬜ DNS and SSL configuration

---

## 9. References

- [Docker Compose Dev Configuration](./docker-compose.dev.yml)
- [Environment Variables Example](./.env.example)
- [Database Migrations](./supabase/migrations/)
- [Health Check Endpoint](./src/api/health.ts)
- [Deployment Guide](./STAGING_DEPLOYMENT_GUIDE.md)

---

## 10. Appendix

### A. Environment Variable Validation Script

```bash
#!/bin/bash
# validate-staging-env.sh

required_vars=(
  "NODE_ENV"
  "DATABASE_URL"
  "REDIS_URL"
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "JWT_SECRET"
)

missing=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

echo "✅ All required environment variables present"
```

### B. Health Check Endpoint

```typescript
// src/api/health.ts
export async function healthCheck() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    supabase: await checkSupabase(),
  };

  const healthy = Object.values(checks).every((c) => c.status === "ok");

  return {
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };
}
```

### C. Deployment Timeline

**Estimated Duration**: 30-45 minutes

| Phase                 | Duration | Description                |
| --------------------- | -------- | -------------------------- |
| Pre-deploy validation | 5 min    | Verify all prerequisites   |
| Build & push image    | 5-10 min | Build and upload container |
| Database migration    | 2-5 min  | Run schema updates         |
| Deployment            | 5-10 min | Deploy new version         |
| Health checks         | 2-3 min  | Verify service health      |
| Smoke tests           | 3-5 min  | Run validation tests       |
| Monitoring            | 5-10 min | Observe metrics            |

**Total**: 27-48 minutes
