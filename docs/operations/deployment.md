# ValueOS Deployment Guide

## Quick Start

For most deployments, use the automated process:

```bash
# Normal deployment (main branch)
git checkout main
git pull
# Merge PR to main (automatically triggers deployment)
```

For hotfixes:

```bash
# Create hotfix branch
git checkout -b hotfix/critical-issue
# Make minimal fix
npm test
# Create PR with [HOTFIX] prefix
gh pr create --title "[HOTFIX] Fix critical issue"
```

---

## Prerequisites

### Infrastructure Requirements

- **Kubernetes Cluster**: v1.24+ with 3+ nodes
- **PostgreSQL**: v14+ with pg_stat_statements extension
- **Redis**: v6+ with persistence enabled
- **Load Balancer**: Nginx Ingress Controller or AWS ALB
- **Monitoring Stack**: Prometheus + Grafana + AlertManager

### Software Dependencies

```bash
# Required packages
Node.js 18.17.0+
pnpm 8.6.0+
Docker 24.0.0+
kubectl 1.27.0+
helm 3.12.0+
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/valueos
REDIS_URL=redis://host:6379

# External Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Security
JWT_SECRET=your-jwt-secret
WEB_SCRAPER_ENCRYPTION_KEY=32-char-key
ENCRYPTION_KEY=32-char-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
DATADOG_API_KEY=your-datadog-key
```

---

## Deployment Process

### Pre-Deployment Checklist

```bash
# 1. Verify all tests pass locally
npm test
npm run typecheck
npm run lint

# 2. Check code coverage meets threshold (75%)
npm run test -- --coverage

# 3. Validate any database migrations
./scripts/validate-migration.sh supabase/migrations/[migration-file].sql

# 4. Review PR checklist completed
# - All items checked
# - 2+ approvals received
# - No unresolved comments

# 5. Verify staging validation passed
# - Check staging-validation workflow status
# - All integration tests passing
# - Performance budgets met
```

### Normal Deployment (Main Branch)

1. **Merge PR to main**
   - Ensure all checks pass
   - Squash and merge (or rebase)
   - Delete feature branch

2. **Monitor Auto-Deployment**

   ```bash
   # Watch deployment progress
   gh run watch

   # Or via GitHub Actions UI
   # https://github.com/[org]/ValueOS/actions
   ```

3. **Verify Staging Deployment**
   - Automatic deployment to staging triggered
   - Wait for all validation workflows to complete
   - Review smoke test results

4. **Approve Production Deployment**
   - Review staging validation summary
   - Approve in GitHub Actions UI (if manual approval required)
   - Monitor deployment progress

5. **Post-Deployment Verification**

   ```bash
   # Run smoke tests against production
   BASE_URL=https://app.valuecanvas.com npm run test:smoke

   # Check health endpoint
   curl https://app.valuecanvas.com/health

   # Monitor error rates (first 10 minutes critical)
   # - Check Grafana dashboard
   # - Watch Slack #alerts channel
   # - Review Sentry for new errors
   ```

### Hotfix Deployment

For critical production issues requiring immediate fix:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-issue-description

# 2. Make minimal fix
# - Fix only the critical issue
# - No refactoring or nice-to-haves

# 3. Test locally
npm test
npm run test:smoke

# 4. Create PR with [HOTFIX] prefix
gh pr create --title "[HOTFIX] Fix critical issue" --body "..."

# 5. Get expedited review
# - Ping team in #eng-urgent
# - Request immediate review from 1+ senior engineer

# 6. Deploy with priority
# - Merge when approved
# - Monitor deployment closely
# - Be ready to rollback
```

---

## Rollback Procedures

### Automated Rollback (Preferred)

```bash
# Roll back to previous version
./scripts/rollback-production.sh --previous --confirm

# Roll back specific service
./scripts/rollback-production.sh --service frontend --previous --confirm

# Dry run first (recommended)
./scripts/rollback-production.sh --previous --dry-run
```

### Manual Rollback (If Automation Fails)

```bash
# 1. Identify current deployment
kubectl get deployments -n valuecanvas

# 2. Check rollout history
kubectl rollout history deployment/valuecanvas-app -n valuecanvas

# 3. Rollback to previous revision
kubectl rollout undo deployment/valuecanvas-app -n valuecanvas

# 4. Monitor rollback
kubectl rollout status deployment/valuecanvas-app -n valuecanvas

# 5. Verify health
curl https://app.valuecanvas.com/health
```

### Database Rollback

```bash
# 1. Check for rollback script
ls supabase/migrations/*_rollback.sql

# 2. Apply rollback migration
supabase db push --db-url [connection-string] --file [rollback-file]

# 3. Verify data integrity
# Run validation queries
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

**Immediately After Deployment (0-10 min)**

- Error rate (target: < 1%)
- Response time p99 (target: < 3s)
- Request success rate (target: > 99%)
- Database connection pool utilization

**Short Term (10-60 min)**

- User-reported issues (Slack, support tickets)
- Crash rate (Sentry)
- Key user flows (login, deals creation, etc.)

**Long Term (1-24 hours)**

- Daily active users (should not drop)
- Feature adoption rates
- Performance regression trends

### Alert Thresholds

| Metric       | Warning | Critical | Action            |
| ------------ | ------- | -------- | ----------------- |
| Error Rate   | > 2%    | > 5%     | Consider rollback |
| P99 Latency  | > 3s    | > 5s     | Investigate       |
| CPU Usage    | > 75%   | > 90%    | Scale up          |
| Memory Usage | > 80%   | > 95%    | Scale up          |
| Disk Usage   | > 80%   | > 90%    | Clean up logs     |

---

## Common Issues & Solutions

### Issue: Deployment Stuck

**Symptoms:** Deployment status shows "In Progress" for > 15 minutes

**Solutions:**

```bash
# 1. Check pod status
kubectl get pods -n valuecanvas

# 2. Check pod logs
kubectl logs -n valuecanvas deployment/valuecanvas-app --tail=100

# 3. Check deployment events
kubectl describe deployment/valuecanvas-app -n valuecanvas

# 4. If image pull error, verify ECR access
aws ecr get-login-password | docker login ...
```

### Issue: Database Migration Failed

**Symptoms:** Migration errors in logs, data inconsistency

**Solutions:**

```bash
# 1. Check migration status
supabase migration list

# 2. Review migration error logs
# Check Supabase dashboard or logs

# 3. If safe, repair migration
supabase db repair [migration-version]

# 4. If data corrupted, restore from backup
./scripts/backup-restore.sh restore [backup-id]
```

### Issue: High Error Rate Post-Deployment

**Symptoms:** Error rate > 5% within 10 minutes

**Actions:**

1. **Immediately:** Initiate rollback

   ```bash
   ./scripts/rollback-production.sh --previous --confirm
   ```

2. **Notify team** in #eng-urgent

3. **Investigate** error patterns in Sentry

4. **Fix and re-deploy** once root cause identified

---

## Database Operations

### Backup Before Major Changes

```bash
# Create manual backup
npm run db:backup:manual

# Verify backup created
npm run db:backup:list

# Backup location
# backups/backup-[timestamp].sql
```

### Applying Migrations Safely

```bash
# 1. Validate migration
./scripts/validate-migration.sh supabase/migrations/[file].sql

# 2. Test in staging first
npm run db:push:staging

# 3. Verify staging works
npm run test:staging

# 4. Apply to production (with warning)
npm run db:push:prod
# (5 second delay, Ctrl+C to cancel)
```

### Staging Deployment

#### Build Process

Staging builds are optimized for development and testing:

- Code minification
- Tree shaking
- Asset optimization
- Staging environment variables

```bash
# Staging build
npm run staging:build       # Standard staging build
npm run staging:build:backend # Backend build
npm run staging:build:bare   # Minimal build
```

#### Container Deployment

```bash
# Staging container operations
npm run staging:start      # Start staging containers
npm run staging:stop       # Stop staging containers
npm run staging:logs       # View staging logs
npm run staging:clean      # Clean staging environment
```

#### Database Operations

```bash
# Staging database management
npm run db:push:staging    # Push schema to staging
```

#### Testing in Staging

```bash
# Staging-specific tests
npm run staging:test       # Run tests in staging mode
npm run test:staging       # Test against staging URL
```

---

## Infrastructure Components

### Caddy Web Server

Production deployments use Caddy for:

- Automatic HTTPS certificates
- Load balancing
- Security headers
- Rate limiting
- Request routing

```bash
# Caddy management
npm run dx:caddy:start     # Start Caddy (dev)
npm run dx:caddy:stop      # Stop Caddy (dev)
npm run dx:caddy:logs      # View Caddy logs
npm run dx:caddy:validate  # Validate Caddy config
npm run dx:caddy:reload    # Reload Caddy config
```

### Database Infrastructure

- PostgreSQL with PostGIS extensions
- Redis for caching and sessions
- Connection pooling and health checks

### Monitoring and Observability

- Structured JSON logging
- Health check endpoints (`/healthz`)
- Metrics collection (Prometheus)
- Distributed tracing

## Deployment Strategies

### Blue-Green Deployment

ValueOS supports blue-green deployments through Docker Compose:

1. Deploy new version alongside current
2. Switch traffic to new version
3. Rollback if issues detected

### Rolling Updates

For Kubernetes deployments:

- Zero-downtime updates
- Health check validation
- Automatic rollback on failure

### Database Migrations

Safe database migrations with:

- Schema versioning
- Rollback capabilities
- Data integrity checks
- Audit logging

```bash
# Migration operations
npm run db:push            # Apply migrations
npm run db:pull            # Pull remote schema
npm run db:reset           # Reset database (dev only)
npm run migration:safety   # Safety checks
npm run migration:validate # Validate migrations
```

---

## Security Considerations

### Environment Variables

- Never commit secrets to version control
- Use CI/CD secrets management
- Validate configuration at startup
- Separate environments completely

### Network Security

- Caddy handles SSL termination
- Rate limiting protects against abuse
- Security headers prevent common attacks
- Network isolation between services

### Access Control

- Row-level security (RLS) in database
- JWT token validation
- Multi-tenant data isolation
- Audit logging for all operations

## Troubleshooting Deployments

### Common Issues

**Container Startup Failures**

```bash
# Check container status
npm run docker:ps
npm run docker:logs [container-name]

# Validate configuration
npm run env:validate
npm run config:validate
```

**Database Connection Issues**

```bash
# Test database connectivity
npm run db:test

# Check database logs
npm run docker:logs postgres
```

**SSL Certificate Problems**

```bash
# Validate Caddy configuration
npm run dx:caddy:validate

# Check certificate status
npm run dx:caddy:logs
```

### Health Checks

```bash
# Comprehensive health check
npm run dx:check

# Individual service health
curl http://localhost:3001/health
curl http://localhost:54321/health
```

### Logs and Monitoring

```bash
# View all logs
npm run dx:logs

# Service-specific logs
npm run docker:logs [service-name]

# Structured log analysis
npm run analyze:logs
```

---

## Feature Flags

### Creating Feature Rollout

```sql
-- Start with 10% rollout
INSERT INTO feature_rollouts (feature_name, percentage, active)
VALUES ('new-feature', 10, true);
```

### Increasing Rollout

```sql
-- Gradual increase: 10% → 25% → 50% → 100%
UPDATE feature_rollouts
SET percentage = 25
WHERE feature_name = 'new-feature';
```

### Emergency Disable

```sql
-- Disable feature immediately
UPDATE feature_rollouts
SET active = false,
    rollback_reason = 'High error rate detected'
WHERE feature_name = 'new-feature';
```

---

## Emergency Contacts

- **On-Call Engineer**: Check PagerDuty rotation
- **Engineering Lead**: [Contact Info]
- **DevOps Team**: #devops Slack channel

### Critical Links

- **Production Dashboard**: https://app.valuecanvas.com
- **Staging Dashboard**: https://staging.valuecanvas.app
- **Grafana**: [URL]
- **Jaeger Tracing**: http://localhost:16686
- **GitHub Actions**: https://github.com/[org]/ValueOS/actions
- **Status Page**: [URL]

---

## Useful Commands

```bash
# Check deployment status
kubectl rollout status deployment/valuecanvas-app -n valuecanvas

# View recent deployments
kubectl rollout history deployment/valuecanvas-app -n valuecanvas

# Scale deployment manually
kubectl scale deployment/valuecanvas-app --replicas=5 -n valuecanvas

# Port-forward for local debugging
kubectl port-forward svc/valuecanvas-app 8080:80 -n valuecanvas

# View logs
kubectl logs -f deployment/valuecanvas-app -n valuecanvas --tail=100

# Execute command in pod
kubectl exec -it deployment/valuecanvas-app -n valuecanvas -- /bin/sh
```

---

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks

```bash
# Monitor system health
curl https://your-domain.com/health

# Check log aggregation
kubectl logs -f deployment/monitoring-stack -c fluent-bit --since=1h

# Verify backup completion
kubectl get jobs -l app=database-backup
```

#### Weekly Tasks

```bash
# Update dependencies
pnpm update

# Run security scans
pnpm audit
pnpm run security-scan

# Database maintenance
kubectl exec -it postgres-pod -- psql -d valueos -c "VACUUM ANALYZE;"
```

#### Monthly Tasks

```bash
# Certificate renewal check
kubectl get certificates

# Dependency updates and testing
pnpm update --latest
pnpm test

# Performance benchmarking
ab -n 1000 -c 10 https://your-domain.com/api/health
```

### Database Maintenance

```sql
-- Monthly maintenance script
-- Vacuum and analyze all tables
VACUUM ANALYZE;

-- Update statistics
ANALYZE;

-- Check for unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Archive old telemetry data (move to cold storage)
INSERT INTO telemetry_archive SELECT * FROM agent_telemetry_events
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM agent_telemetry_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### Log Rotation and Archival

```bash
# Log rotation configuration
cat > /etc/logrotate.d/valueos << EOF
/var/log/valueos/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 valueos valueos
    postrotate
        systemctl reload valueos-backend
    endscript
}
EOF

# Archive old logs to S3
aws s3 sync /var/log/valueos/archive/ s3://valueos-logs-archive/
```

## Security Procedures

### Certificate Management

```bash
# Renew SSL certificates
certbot renew

# Update Kubernetes secrets
kubectl create secret tls valueos-tls --cert=cert.pem --key=key.pem --dry-run=client -o yaml | kubectl apply -f -

# Verify certificate status
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### Access Control

```bash
# Rotate service account tokens
kubectl create token service-account-name --duration=24h

# Update API keys
kubectl create secret generic api-keys --from-literal=openai-key=$NEW_OPENAI_KEY --dry-run=client -o yaml | kubectl apply -f -

# Audit user access
kubectl get rolebindings,clusterrolebindings -o wide
```

### Security Scanning

```bash
# Run container vulnerability scans
trivy image valueos/backend:latest

# Run dependency vulnerability scans
pnpm audit --audit-level high

# Run infrastructure security scans
kubectl run kube-bench --image=aquasec/kube-bench:latest --rm -it
```

## Performance Optimization

### Application Performance Tuning

```typescript
// Performance configuration
export const performanceConfig = {
  // Connection pooling
  database: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
  },

  // Caching strategy
  cache: {
    ttl: 300000, // 5 minutes
    maxMemory: "512mb",
    compression: true,
  },

  // Agent optimization
  agents: {
    concurrency: 5,
    batchSize: 10,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
  },

  // Request optimization
  requests: {
    timeout: 30000,
    retries: 3,
    backoffMultiplier: 2,
  },
};
```

### Database Optimization

```sql
-- Query optimization
EXPLAIN ANALYZE SELECT * FROM agent_execution_traces
WHERE agent_type = 'expansion' AND start_time > NOW() - INTERVAL '1 day';

-- Index optimization
CREATE INDEX CONCURRENTLY idx_agent_execution_traces_composite
ON agent_execution_traces (agent_type, status, start_time DESC);

-- Partitioning strategy for large tables
CREATE TABLE agent_telemetry_events_y2024 PARTITION OF agent_telemetry_events
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### Infrastructure Optimization

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: valueos-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: valueos-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Disaster Recovery

### Backup Strategy

```bash
# Database backup
kubectl exec -it postgres-pod -- pg_dump valueos > backup.sql

# Upload to S3
aws s3 cp backup.sql s3://valueos-backups/$(date +%Y%m%d_%H%M%S)_backup.sql

# Application state backup
kubectl get configmaps,secrets -o yaml > k8s-state-backup.yaml
```

### Recovery Procedures

```bash
# Database recovery
kubectl exec -it postgres-pod -- psql -d valueos < backup.sql

# Application state recovery
kubectl apply -f k8s-state-backup.yaml

# Verify recovery
curl https://your-domain.com/health
```

### Business Continuity

```yaml
# Multi-region deployment
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: valueos-ingress
  annotations:
    nginx.ingress.kubernetes.io/affinity: cookie
    nginx.ingress.kubernetes.io/affinity-mode: sticky
spec:
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: valueos-backend
                port:
                  number: 80
```

---

**Last Updated:** 2026-01-14
**Maintained By:** DevOps Team
**Review Frequency:** Monthly
