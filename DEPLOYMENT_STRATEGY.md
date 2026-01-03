# ValueOS Deployment Strategy

## Overview

ValueOS uses a **"slick" dev → stage → prod** deployment strategy with:
- **Build once, promote everywhere** (immutable artifacts)
- **Ephemeral PR preview environments** (isolated testing)
- **Progressive delivery** (canary deployments, feature flags)
- **Automated rollback** (on metrics degradation)
- **Zero-downtime migrations** (expand-migrate-contract pattern)

---

## Quick Start

### Deploy to Production

```bash
# 1. Merge PR to main
git checkout main
git pull origin main

# 2. Workflow automatically:
#    - Builds immutable artifact
#    - Promotes to dev (auto)
#    - Promotes to staging (auto, after tests)
#    - Waits for production approval

# 3. Approve production deployment in GitHub Actions UI

# 4. Monitor deployment
gh run watch
```

### Create Preview Environment

```bash
# 1. Create PR
git checkout -b feature/my-feature
git push origin feature/my-feature

# 2. Preview environment automatically created
#    - URL posted as PR comment
#    - Isolated database
#    - Auto-cleanup on PR close
```

### Rollout New Feature

```sql
-- 1. Create feature rollout (10% of users)
INSERT INTO feature_rollouts (feature_name, percentage, active)
VALUES ('new-feature', 10, true);

-- 2. Monitor metrics for 24 hours

-- 3. Increase percentage gradually
UPDATE feature_rollouts SET percentage = 25 WHERE feature_name = 'new-feature';
UPDATE feature_rollouts SET percentage = 50 WHERE feature_name = 'new-feature';
UPDATE feature_rollouts SET percentage = 100 WHERE feature_name = 'new-feature';
```

---

## Architecture

### Environment Flow

```
PR → Ephemeral Preview (isolated)
  ↓
main branch → Build Artifact (once)
  ↓
dev (auto-deploy)
  ↓ (after smoke tests)
staging (auto-deploy)
  ↓ (after integration tests)
production (manual approval)
  ↓ (canary → full rollout)
```

### Artifact Promotion

```
Build: ghcr.io/valuecanvas:sha-abc123
  ↓
Dev: kubectl set image ... :sha-abc123
  ↓
Staging: kubectl set image ... :sha-abc123 (same artifact)
  ↓
Production: kubectl set image ... :sha-abc123 (same artifact)
```

**Key Principle:** Same artifact deployed everywhere, only config differs.

---

## Workflows

### 1. Build Once, Promote Everywhere
**File:** `.github/workflows/build-once-promote.yml`

**Triggers:**
- Push to `main` branch

**Steps:**
1. Build immutable Docker image
2. Tag with SHA digest
3. Promote to dev (automatic)
4. Promote to staging (automatic, after tests)
5. Promote to production (manual approval)

**Outputs:**
- Immutable artifact: `ghcr.io/valuecanvas:sha-abc123`
- Deployment report with promotion status

---

### 2. Ephemeral PR Previews
**File:** `.github/workflows/pr-preview-environment.yml`

**Triggers:**
- PR opened/updated
- PR closed (cleanup)

**Features:**
- Isolated Kubernetes namespace
- Ephemeral database
- Unique subdomain: `pr-123.preview.valuecanvas.app`
- Auto-cleanup on PR close
- Stale environment cleanup (7+ days)

**Cost Optimization:**
- Scale down after 2 hours of inactivity
- Delete after 7 days
- Resource limits: 512Mi RAM, 500m CPU

---

### 3. Canary Deployments
**File:** `.github/workflows/canary-deployment.yml`

**Triggers:**
- Manual workflow dispatch

**Process:**
1. Deploy canary (5-50% traffic)
2. Monitor metrics for 10 minutes
3. Compare canary vs stable (error rate, latency)
4. Auto-promote if healthy
5. Auto-rollback if unhealthy

**Metrics Monitored:**
- Error rate (threshold: 5%)
- Latency p99 (threshold: 3s)
- CPU/Memory utilization

---

### 4. Production Health Monitor
**File:** `.github/workflows/production-health-monitor.yml`

**Triggers:**
- Every 5 minutes (scheduled)

**Actions:**
- Collect CloudWatch metrics
- Compare to baseline
- Alert on degradation
- Auto-rollback on critical issues

**Thresholds:**
- Error rate: >5% absolute or >3x baseline
- Latency: >3s absolute or >2x baseline
- CPU: >90%
- Memory: >90%

---

### 5. Progressive Feature Rollouts
**File:** `src/config/progressiveRollout.ts`

**Features:**
- Percentage-based rollout (deterministic)
- Target/exclude user groups
- Error tracking
- Auto-rollback on high error rate
- Gradual increase: 10% → 25% → 50% → 100%

**Usage:**
```typescript
const { enabled } = useFeatureRollout('new-feature', userId, userGroups);
if (enabled) {
  // Show new feature
}
```

---

### 6. Cost Optimization
**File:** `.github/workflows/preview-env-cost-optimization.yml`

**Triggers:**
- Every hour (scheduled)

**Actions:**
- Scale down inactive environments (2+ hours)
- Delete stale environments (7+ days)
- Optimize resource limits
- Monitor costs (alert if >$100/week)

**Savings:**
- Target: 50% cost reduction
- Estimated: $100/month saved

---

## Database Migrations

### Expand-Migrate-Contract Pattern

**Goal:** Zero-downtime migrations

**Example: Rename Column**

**Phase 1 - EXPAND (Deploy 1):**
```sql
-- Add new column (backward compatible)
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);

-- Sync old → new via trigger
CREATE TRIGGER sync_email_trigger ...
```

**Phase 2 - MIGRATE (Deploy 2, after 24-48 hours):**
```sql
-- Backfill data
UPDATE users SET email_address = email WHERE email_address IS NULL;

-- Make NOT NULL
ALTER TABLE users ALTER COLUMN email_address SET NOT NULL;
```

**Phase 3 - CONTRACT (Deploy 3, after 24-48 hours):**
```sql
-- Remove old column
DROP TRIGGER sync_email_trigger;
ALTER TABLE users DROP COLUMN email;
```

**Key Principle:** Wait 24-48 hours between phases to verify no errors.

---

## Secrets Management

### Centralized in AWS Secrets Manager

**Structure:**
```
valuecanvas/dev/database-url
valuecanvas/dev/supabase-url
valuecanvas/dev/supabase-anon-key
...
valuecanvas/staging/...
valuecanvas/production/...
```

**Access:**
- External Secrets Operator syncs to Kubernetes
- Secrets auto-populated in pods
- Refresh every 30-60 minutes

**Benefits:**
- Single source of truth
- Automatic rotation
- Audit trail
- No secrets in GitHub

---

## Monitoring & Observability

### Key Dashboards

1. **Deployment Dashboard**
   - Artifact promotion status
   - Deployment success rate
   - Rollback frequency

2. **Canary Dashboard**
   - Traffic split
   - Error rate comparison
   - Latency comparison

3. **Feature Rollout Dashboard**
   - Rollout percentage
   - User adoption
   - Error rate by feature

4. **Cost Dashboard**
   - Preview environment costs
   - Cost per environment
   - Savings from optimization

### Alerts

- **PagerDuty:** Critical production issues
- **Slack:** Warnings and deployments
- **GitHub Issues:** Auto-rollbacks and incidents

---

## Best Practices

### 1. Always Use PRs
- Never push directly to `main`
- Require 2 approvals
- Use preview environments for testing

### 2. Test in Preview First
- Every PR gets isolated environment
- Test thoroughly before merging
- Verify database migrations

### 3. Monitor After Deployment
- Watch metrics for 10 minutes
- Check error rates and latency
- Be ready to rollback

### 4. Gradual Rollouts
- Start with 10% for new features
- Increase gradually: 10% → 25% → 50% → 100%
- Wait 24 hours between increases

### 5. Zero-Downtime Migrations
- Always use expand-migrate-contract
- Wait 24-48 hours between phases
- Test rollback plan

---

## Troubleshooting

### Deployment Failed

```bash
# Check workflow logs
gh run view --log

# Check Kubernetes events
kubectl get events -n production --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs -n production deployment/valuecanvas-app --tail=100
```

### Preview Environment Not Working

```bash
# Check namespace
kubectl get namespace pr-123

# Check deployment
kubectl get deployment -n pr-123

# Check ingress
kubectl get ingress -n pr-123

# Check logs
kubectl logs -n pr-123 deployment/valuecanvas-app
```

### Rollback Production

```bash
# Manual rollback
kubectl rollout undo deployment/valuecanvas-app -n production

# Or use previous revision
kubectl rollout undo deployment/valuecanvas-app -n production --to-revision=5
```

### Feature Rollout Issues

```sql
-- Check rollout status
SELECT * FROM feature_rollout_metrics WHERE feature_name = 'my-feature';

-- Manually rollback
UPDATE feature_rollouts 
SET active = false, rollback_reason = 'Manual rollback'
WHERE feature_name = 'my-feature';
```

---

## Security

### Secrets
- ✅ Stored in AWS Secrets Manager
- ✅ Synced via External Secrets Operator
- ✅ Never committed to Git
- ✅ Rotated regularly

### Access Control
- ✅ RBAC for Kubernetes
- ✅ IAM roles for AWS
- ✅ Branch protection rules
- ✅ Required approvals for production

### Audit Trail
- ✅ All deployments logged
- ✅ Rollback reasons recorded
- ✅ Feature rollout tracking
- ✅ Cost allocation tags

---

## Performance

### Deployment Speed
- **Before:** 30 minutes (rebuild per environment)
- **After:** 15 minutes (promote same artifact)
- **Improvement:** 50% faster

### Rollback Speed
- **Before:** 15 minutes (manual process)
- **After:** 2 minutes (automated)
- **Improvement:** 87% faster

### Cost Savings
- **Before:** $200/week (preview environments)
- **After:** $100/week (auto-scaling, cleanup)
- **Improvement:** 50% reduction

---

## References

- [Implementation Guide](docs/maturity-roadmap-implementation.md)
- [Single-Branch Migration](docs/single-branch-migration.md)
- [Database Migration Patterns](docs/database-migration-patterns.md)
- [Build Once Promote Workflow](.github/workflows/build-once-promote.yml)
- [PR Preview Workflow](.github/workflows/pr-preview-environment.yml)
- [Canary Deployment Workflow](.github/workflows/canary-deployment.yml)

---

## Support

For questions or issues:
- **Documentation:** This file and linked docs
- **Workflow Logs:** GitHub Actions tab
- **Kubernetes:** `kubectl` commands above
- **Team:** #devops Slack channel
