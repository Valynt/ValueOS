# ValueOS Deployment Runbook

## Quick Reference

### Emergency Contacts
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

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 2% | > 5% | Consider rollback |
| P99 Latency | > 3s | > 5s | Investigate |
| CPU Usage | > 75% | > 90% | Scale up |
| Memory Usage | > 80% | > 95% | Scale up |
| Disk Usage | > 80% | > 90% | Clean up logs |

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

### Issue: Performance Degradation

**Symptoms:** P99 latency increased by > 2x

**Actions:**
```bash
# 1. Check recent deployments
git log --oneline -10

# 2. Compare performance metrics (Grafana)
# Before vs. after deployment

# 3. Profile slow endpoints
# Use Jaeger distributed tracing

# 4. Check database query performance
# Review slow query logs

# 5. If deployment caused it, rollback
./scripts/rollback-production.sh --previous
```

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

## Team Communication

### Deployment Announcement Template

```
📦 **Deploying to Production**

**What:** [Brief description]
**When:** Now (ETA: 15 minutes)
**Impact:** [Expected user impact]
**Rollback plan:** Automated rollback available

Monitoring deployment... 🔍
```

### Incident Report Template

```
🚨 **Production Incident**

**Status:** [Investigating/Mitigating/Resolved]
**Impact:** [Description of user impact]
**Started:** [Timestamp]
**Actions taken:**
- [Action 1]
- [Action 2]

**Next steps:** [What's being done]
**ETA:** [Expected resolution time]
```

---

## Post-Deployment

### Success Criteria

- ✅ All deployments completed successfully
- ✅ Smoke tests passing
- ✅ Error rate < 1% for 1 hour
- ✅ Zero rollbacks required
- ✅ No user-reported issues

### Post-Mortem (If Issues Occurred)

1. **Document timeline** of events
2. **Identify root cause**
3. **List action items** to prevent recurrence
4. **Update runbooks** with learnings
5. **Share in team retro**

---

## Appendix

### Useful Commands

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

### Environment Variables Quick Reference

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| VITE_SUPABASE_URL | Local Supabase | Staging DB | Prod DB |
| NODE_ENV | development | staging | production |
| LOG_LEVEL | debug | info | warn |

---

**Last Updated:** 2026-01-08
**Maintained By:** DevOps Team
**Review Frequency:** Monthly
