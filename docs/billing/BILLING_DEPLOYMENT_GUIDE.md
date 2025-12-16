# Billing System Deployment Guide

**Version:** 1.0  
**Date:** 2025-12-06  
**Target:** Staging and Production Environments

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Migrations](#database-migrations)
3. [Stripe Configuration](#stripe-configuration)
4. [Cron Job Setup](#cron-job-setup)
5. [Testing Procedures](#testing-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring Setup](#monitoring-setup)

---

## Pre-Deployment Checklist

### Code Review
- [ ] All code changes reviewed and approved
- [ ] All tests passing (11/11 billing tests)
- [ ] No TypeScript compilation errors
- [ ] Documentation updated

### Environment Preparation
- [ ] Staging environment accessible
- [ ] Production environment accessible
- [ ] Database credentials available
- [ ] Stripe API keys available (test and live)
- [ ] Backup of current database taken

### Team Coordination
- [ ] Deployment window scheduled
- [ ] Team notified of deployment
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed

---

## Database Migrations

### Overview

Three new migrations need to be applied:

1. **20260101091000_billing_audit_log.sql** - Audit logging table
2. **20260101092000_grace_periods.sql** - Grace period tracking
3. **20260101093000_webhook_retry.sql** - Webhook retry mechanism

### Migration Order

**IMPORTANT:** Migrations must be applied in order.

### Staging Deployment

#### Step 1: Verify Current State

```bash
# Connect to staging database
psql $STAGING_DATABASE_URL

# Check current migration status
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;

# Verify billing tables exist
\dt billing_*

# Exit
\q
```

#### Step 2: Backup Database

```bash
# Create backup
pg_dump $STAGING_DATABASE_URL > staging_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh staging_backup_*.sql
```

#### Step 3: Apply Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
# Navigate to project root
cd /workspaces/ValueCanvas

# Apply migrations to staging
supabase db push --db-url $STAGING_DATABASE_URL

# Verify migrations applied
supabase db diff --db-url $STAGING_DATABASE_URL
```

**Option B: Manual Application**

```bash
# Apply each migration in order
psql $STAGING_DATABASE_URL -f supabase/migrations/20260101091000_billing_audit_log.sql
psql $STAGING_DATABASE_URL -f supabase/migrations/20260101092000_grace_periods.sql
psql $STAGING_DATABASE_URL -f supabase/migrations/20260101093000_webhook_retry.sql
```

#### Step 4: Verify Migrations

```bash
# Connect to database
psql $STAGING_DATABASE_URL

# Verify new tables exist
\dt billing_audit_log
\dt grace_periods
\dt webhook_dead_letter_queue

# Verify columns added to webhook_events
\d webhook_events

# Test audit log function
SELECT log_billing_action(
  p_organization_id := (SELECT id FROM organizations LIMIT 1),
  p_action := 'test_action',
  p_actor_type := 'system',
  p_actor_id := NULL,
  p_resource_type := 'test',
  p_resource_id := NULL,
  p_metadata := '{"test": true}'::JSONB
);

# Verify audit log entry created
SELECT * FROM billing_audit_log ORDER BY created_at DESC LIMIT 1;

# Clean up test entry
DELETE FROM billing_audit_log WHERE action = 'test_action';

# Exit
\q
```

#### Step 5: Verify RLS Policies

```bash
psql $STAGING_DATABASE_URL

# Check RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('billing_audit_log', 'grace_periods', 'webhook_dead_letter_queue');

# Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('billing_audit_log', 'grace_periods', 'webhook_dead_letter_queue');

\q
```

### Production Deployment

**CRITICAL:** Only proceed after successful staging deployment and testing.

#### Step 1: Schedule Maintenance Window

```bash
# Recommended: Low-traffic period (e.g., 2 AM - 4 AM)
# Duration: 30 minutes
# Impact: None (migrations are additive)
```

#### Step 2: Backup Production Database

```bash
# Create backup with timestamp
pg_dump $PRODUCTION_DATABASE_URL > production_backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip production_backup_*.sql

# Upload to secure storage
aws s3 cp production_backup_*.sql.gz s3://valuecanvas-backups/database/

# Verify backup integrity
gunzip -t production_backup_*.sql.gz
```

#### Step 3: Apply Migrations

```bash
# Apply migrations to production
supabase db push --db-url $PRODUCTION_DATABASE_URL

# OR manually
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101091000_billing_audit_log.sql
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101092000_grace_periods.sql
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101093000_webhook_retry.sql
```

#### Step 4: Verify Production Migrations

```bash
# Same verification steps as staging
psql $PRODUCTION_DATABASE_URL

# Verify tables
\dt billing_audit_log
\dt grace_periods
\dt webhook_dead_letter_queue

# Verify RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('billing_audit_log', 'grace_periods', 'webhook_dead_letter_queue');

\q
```

### Migration Troubleshooting

#### Issue: Migration Fails

```bash
# Check error message
psql $DATABASE_URL

# Check for conflicting objects
SELECT tablename FROM pg_tables WHERE tablename LIKE 'billing_%';

# Check for missing dependencies
SELECT tablename FROM pg_tables WHERE tablename = 'organizations';
SELECT tablename FROM pg_tables WHERE tablename = 'users';
SELECT tablename FROM pg_tables WHERE tablename = 'webhook_events';
```

#### Issue: RLS Policies Not Working

```bash
# Verify RLS enabled
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;

# Recreate policies if needed
DROP POLICY IF EXISTS billing_audit_log_select ON billing_audit_log;
CREATE POLICY billing_audit_log_select ON billing_audit_log
  FOR SELECT USING (organization_id = auth.get_current_org_id());
```

---

## Stripe Configuration

### Webhook Endpoint Setup

#### Staging Configuration

1. **Login to Stripe Dashboard**
   - Navigate to: https://dashboard.stripe.com/test/webhooks
   - Click "Add endpoint"

2. **Configure Endpoint**
   ```
   Endpoint URL: https://staging.valuecanvas.com/api/billing/webhooks/stripe
   Description: ValueCanvas Staging Webhook Handler
   Version: Latest API version
   ```

3. **Select Events**
   ```
   Select events to listen to:
   ✓ invoice.created
   ✓ invoice.finalized
   ✓ invoice.updated
   ✓ invoice.payment_succeeded
   ✓ invoice.payment_failed
   ✓ customer.subscription.created
   ✓ customer.subscription.updated
   ✓ customer.subscription.deleted
   ✓ charge.succeeded
   ✓ charge.failed
   ✓ payment_method.attached
   ✓ payment_method.detached
   ```

4. **Save and Get Signing Secret**
   ```bash
   # Copy the webhook signing secret (starts with whsec_)
   # Add to staging environment variables
   export STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Test Webhook**
   ```bash
   # Send test event from Stripe dashboard
   # Click "Send test webhook" button
   # Select "invoice.payment_succeeded"
   # Verify event received in application logs
   ```

#### Production Configuration

1. **Login to Stripe Dashboard**
   - Navigate to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"

2. **Configure Endpoint**
   ```
   Endpoint URL: https://api.valuecanvas.com/api/billing/webhooks/stripe
   Description: ValueCanvas Production Webhook Handler
   Version: Latest API version
   ```

3. **Select Same Events as Staging**

4. **Save and Update Environment**
   ```bash
   # Update production environment variables
   # Use production webhook secret
   export STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Enable Webhook**
   - Verify endpoint is enabled
   - Monitor initial webhook deliveries

### Webhook Verification

```bash
# Check webhook endpoint is accessible
curl -X POST https://staging.valuecanvas.com/api/billing/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Expected: 400 Bad Request (missing signature)

# Check application logs
kubectl logs -f deployment/valuecanvas-api -n staging | grep webhook
```

### Stripe API Keys

#### Verify Environment Variables

**Staging:**
```bash
# Test keys (start with sk_test_ and pk_test_)
export STRIPE_SECRET_KEY=sk_test_...
export VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
```

**Production:**
```bash
# Live keys (start with sk_live_ and pk_live_)
export STRIPE_SECRET_KEY=sk_live_...
export VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Test API Connection

```bash
# Test Stripe connection
node -e "
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
stripe.customers.list({ limit: 1 })
  .then(() => console.log('✓ Stripe API connection successful'))
  .catch(err => console.error('✗ Stripe API error:', err.message));
"
```

---

## Cron Job Setup

### Webhook Retry Job

#### Create Job Script

**File:** `scripts/jobs/webhook-retry.js`

```javascript
#!/usr/bin/env node

/**
 * Webhook Retry Cron Job
 * Processes failed webhook events with exponential backoff
 * 
 * Usage: node scripts/jobs/webhook-retry.js
 * Schedule: Every 5 minutes
 */

const WebhookRetryService = require('../../dist/services/billing/WebhookRetryService').default;
const { createLogger } = require('../../dist/lib/logger');

const logger = createLogger({ component: 'WebhookRetryCron' });

async function run() {
  try {
    logger.info('Starting webhook retry job');
    
    const result = await WebhookRetryService.processRetries();
    
    logger.info('Webhook retry job completed', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
    
    // Exit with error if any retries failed
    if (result.failed > 0) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Webhook retry job failed', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { run };
```

#### Make Script Executable

```bash
chmod +x scripts/jobs/webhook-retry.js
```

#### Test Script Locally

```bash
# Set environment variables
export DATABASE_URL=postgresql://...
export VITE_SUPABASE_URL=https://...
export SUPABASE_SERVICE_ROLE_KEY=...

# Run script
node scripts/jobs/webhook-retry.js

# Expected output:
# [INFO] Starting webhook retry job
# [INFO] Processing 0 webhook retries
# [INFO] Webhook retry job completed { processed: 0, succeeded: 0, failed: 0 }
```

### Kubernetes CronJob (Recommended)

**File:** `k8s/cronjobs/webhook-retry.yaml`

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: webhook-retry
  namespace: production
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  concurrencyPolicy: Forbid  # Don't run concurrent jobs
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: webhook-retry
            image: valuecanvas/api:latest
            command:
            - node
            - scripts/jobs/webhook-retry.js
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
            - name: VITE_SUPABASE_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: supabase-url
            - name: SUPABASE_SERVICE_ROLE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-credentials
                  key: service-role-key
            resources:
              requests:
                memory: "128Mi"
                cpu: "100m"
              limits:
                memory: "256Mi"
                cpu: "200m"
```

#### Deploy CronJob

```bash
# Staging
kubectl apply -f k8s/cronjobs/webhook-retry.yaml -n staging

# Production
kubectl apply -f k8s/cronjobs/webhook-retry.yaml -n production

# Verify CronJob created
kubectl get cronjobs -n production

# Check job history
kubectl get jobs -n production | grep webhook-retry

# View logs
kubectl logs -l job-name=webhook-retry-<timestamp> -n production
```

### Alternative: System Cron (VMs)

```bash
# Edit crontab
crontab -e

# Add entry (runs every 5 minutes)
*/5 * * * * cd /opt/valuecanvas && node scripts/jobs/webhook-retry.js >> /var/log/valuecanvas/webhook-retry.log 2>&1

# Verify cron entry
crontab -l

# Check logs
tail -f /var/log/valuecanvas/webhook-retry.log
```

### Grace Period Cleanup Job (Optional)

**File:** `scripts/jobs/grace-period-cleanup.js`

```javascript
#!/usr/bin/env node

const GracePeriodService = require('../../dist/services/metering/GracePeriodService').default;
const { createLogger } = require('../../dist/lib/logger');

const logger = createLogger({ component: 'GracePeriodCleanupCron' });

async function run() {
  try {
    logger.info('Starting grace period cleanup job');
    
    // Clean up grace periods older than 30 days
    const count = await GracePeriodService.cleanupOldGracePeriods(30);
    
    logger.info('Grace period cleanup completed', { cleaned: count });
    
    process.exit(0);
  } catch (error) {
    logger.error('Grace period cleanup failed', error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
```

**Schedule:** Daily at 3 AM

```yaml
# k8s/cronjobs/grace-period-cleanup.yaml
schedule: "0 3 * * *"  # Daily at 3 AM
```

---

## Testing Procedures

### End-to-End Billing Tests

#### Test 1: Invoice Preview

```bash
# Get auth token
TOKEN=$(curl -X POST https://staging.valuecanvas.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  | jq -r '.token')

# Preview plan change
curl -X POST https://staging.valuecanvas.com/api/billing/subscription/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planTier":"standard"}' \
  | jq

# Expected: JSON with proration details
```

#### Test 2: Grace Period Enforcement

```bash
# Simulate quota exceeded
# 1. Set low quota for test tenant
# 2. Make API calls to exceed quota
# 3. Verify grace period started
# 4. Check response headers

curl -X POST https://staging.valuecanvas.com/api/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","input":"test"}' \
  -v

# Check headers:
# X-Quota-Warning: true
# X-Grace-Period-Expires: 2025-12-07T...
```

#### Test 3: Webhook Processing

```bash
# Send test webhook from Stripe dashboard
# 1. Go to Stripe Dashboard > Webhooks
# 2. Click on staging endpoint
# 3. Click "Send test webhook"
# 4. Select "invoice.payment_succeeded"
# 5. Check application logs

kubectl logs -f deployment/valuecanvas-api -n staging | grep webhook

# Expected: "Webhook received" and "Webhook event processed"
```

#### Test 4: Webhook Retry

```bash
# Simulate webhook failure
# 1. Temporarily break webhook processing (e.g., invalid DB connection)
# 2. Send test webhook
# 3. Verify event marked for retry
# 4. Fix issue
# 5. Wait for retry job (5 minutes)
# 6. Verify event processed

# Check retry status
psql $STAGING_DATABASE_URL -c "
SELECT stripe_event_id, event_type, retry_count, next_retry_at, processed
FROM webhook_events
WHERE processed = false
ORDER BY received_at DESC
LIMIT 5;
"
```

#### Test 5: Audit Logging

```bash
# Perform billing action (e.g., upgrade subscription)
curl -X PUT https://staging.valuecanvas.com/api/billing/subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planTier":"standard"}'

# Verify audit log entry
psql $STAGING_DATABASE_URL -c "
SELECT action, actor_type, resource_type, created_at
FROM billing_audit_log
ORDER BY created_at DESC
LIMIT 5;
"
```

### Load Testing (Optional)

```bash
# Install k6
brew install k6  # macOS
# or
apt-get install k6  # Linux

# Run load test
k6 run scripts/load-tests/billing-api.js

# Monitor metrics
kubectl top pods -n staging
```

---

## Rollback Procedures

### Database Rollback

#### If Migrations Fail During Application

```bash
# Restore from backup
psql $DATABASE_URL < staging_backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
psql $DATABASE_URL -c "\dt billing_*"
```

#### If Issues Discovered After Deployment

**Option 1: Drop New Tables (Staging Only)**

```sql
-- Connect to database
psql $STAGING_DATABASE_URL

-- Drop tables in reverse order
DROP TABLE IF EXISTS webhook_dead_letter_queue CASCADE;
DROP TABLE IF EXISTS grace_periods CASCADE;
DROP TABLE IF EXISTS billing_audit_log CASCADE;

-- Remove columns from webhook_events
ALTER TABLE webhook_events DROP COLUMN IF EXISTS retry_count;
ALTER TABLE webhook_events DROP COLUMN IF EXISTS next_retry_at;
```

**Option 2: Restore from Backup (Production)**

```bash
# Stop application
kubectl scale deployment valuecanvas-api --replicas=0 -n production

# Restore database
psql $PRODUCTION_DATABASE_URL < production_backup_YYYYMMDD_HHMMSS.sql

# Restart application
kubectl scale deployment valuecanvas-api --replicas=3 -n production
```

### Application Rollback

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/valuecanvas-api -n production

# Verify rollback
kubectl rollout status deployment/valuecanvas-api -n production

# Check pods
kubectl get pods -n production
```

### Stripe Configuration Rollback

```bash
# Disable webhook endpoint
# 1. Go to Stripe Dashboard > Webhooks
# 2. Click on endpoint
# 3. Click "Disable endpoint"

# Or delete endpoint
# 1. Click "Delete endpoint"
# 2. Confirm deletion
```

---

## Monitoring Setup

### Metrics to Monitor

#### Webhook Processing

```promql
# Webhook success rate
rate(stripe_webhook_events_total{status="processed"}[5m])
/ rate(stripe_webhook_events_total[5m])

# Webhook retry rate
rate(stripe_webhook_events_total{status="failed"}[5m])

# Dead letter queue size
webhook_dead_letter_queue_size
```

#### Grace Periods

```promql
# Active grace periods
grace_periods_active_total

# Grace period expirations
rate(grace_periods_expired_total[1h])
```

#### Audit Log

```promql
# Audit log write rate
rate(billing_audit_log_entries_total[5m])

# Audit log errors
rate(billing_audit_log_errors_total[5m])
```

### Alerts

**File:** `monitoring/alerts/billing.yaml`

```yaml
groups:
- name: billing
  interval: 30s
  rules:
  - alert: WebhookDeadLetterQueueHigh
    expr: webhook_dead_letter_queue_size > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Webhook dead letter queue is growing"
      description: "{{ $value }} events in dead letter queue"

  - alert: WebhookRetryFailureRateHigh
    expr: rate(stripe_webhook_events_total{status="failed"}[5m]) > 0.2
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "High webhook retry failure rate"
      description: "{{ $value }} webhook retries failing per second"

  - alert: GracePeriodExpirationsHigh
    expr: rate(grace_periods_expired_total[1h]) > 10
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "High grace period expiration rate"
      description: "{{ $value }} grace periods expiring per hour"
```

### Dashboards

Create Grafana dashboards for:

1. **Webhook Processing**
   - Events received per minute
   - Processing success rate
   - Retry attempts
   - Dead letter queue size

2. **Grace Periods**
   - Active grace periods by metric
   - Expiration rate
   - Conversion rate (grace → upgrade)

3. **Audit Log**
   - Actions per minute
   - Actions by type
   - Storage growth

---

## Post-Deployment Checklist

### Immediate (0-1 hour)

- [ ] All migrations applied successfully
- [ ] No database errors in logs
- [ ] Webhook endpoint receiving events
- [ ] Cron job running successfully
- [ ] No application errors

### Short-term (1-24 hours)

- [ ] Webhook retry job processing events
- [ ] Grace periods being created
- [ ] Audit log entries being written
- [ ] No dead letter queue growth
- [ ] Performance metrics normal

### Medium-term (1-7 days)

- [ ] Invoice preview working correctly
- [ ] Grace period enforcement working
- [ ] Webhook retry success rate > 95%
- [ ] No unexpected billing issues
- [ ] Customer feedback positive

---

## Support Contacts

- **On-Call Engineer:** [Name] - [Phone]
- **Database Admin:** [Name] - [Email]
- **DevOps Lead:** [Name] - [Slack]
- **Stripe Support:** https://support.stripe.com

---

## Appendix

### Useful Commands

```bash
# Check migration status
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"

# Count webhook events
psql $DATABASE_URL -c "SELECT COUNT(*) FROM webhook_events WHERE processed = false;"

# Check dead letter queue
psql $DATABASE_URL -c "SELECT COUNT(*) FROM webhook_dead_letter_queue;"

# View recent audit log entries
psql $DATABASE_URL -c "SELECT * FROM billing_audit_log ORDER BY created_at DESC LIMIT 10;"

# Check grace periods
psql $DATABASE_URL -c "SELECT * FROM grace_periods WHERE expires_at > NOW();"
```

### Troubleshooting

**Issue:** Webhook signature verification fails

```bash
# Verify webhook secret is correct
echo $STRIPE_WEBHOOK_SECRET

# Check Stripe dashboard for correct secret
# Ensure no trailing whitespace in environment variable
```

**Issue:** Cron job not running

```bash
# Check CronJob status
kubectl get cronjobs -n production

# Check recent jobs
kubectl get jobs -n production | grep webhook-retry

# View job logs
kubectl logs -l job-name=webhook-retry-<timestamp> -n production
```

**Issue:** Grace period not enforcing

```bash
# Check middleware is loaded
kubectl logs deployment/valuecanvas-api -n production | grep "PlanEnforcementMiddleware"

# Verify grace period table has data
psql $DATABASE_URL -c "SELECT * FROM grace_periods LIMIT 5;"
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-06  
**Next Review:** After production deployment
