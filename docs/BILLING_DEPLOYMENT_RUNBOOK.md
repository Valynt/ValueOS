# Billing System Deployment Runbook

**Quick Reference Guide for Production Deployment**

---

## Pre-Flight Checklist

```bash
# 1. Verify all tests pass
npm test -- --run src/services/billing/__tests__/
npm test -- --run src/config/__tests__/billing.test.ts

# 2. Verify code builds
npm run build

# 3. Backup database
pg_dump $PRODUCTION_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Verify environment variables
echo $STRIPE_SECRET_KEY
echo $STRIPE_WEBHOOK_SECRET
echo $DATABASE_URL
```

---

## Deployment Steps

### 1. Apply Database Migrations (5 min)

```bash
# Apply migrations
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101091000_billing_audit_log.sql
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101092000_grace_periods.sql
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20260101093000_webhook_retry.sql

# Verify
psql $PRODUCTION_DATABASE_URL -c "\dt billing_audit_log"
psql $PRODUCTION_DATABASE_URL -c "\dt grace_periods"
psql $PRODUCTION_DATABASE_URL -c "\dt webhook_dead_letter_queue"
```

### 2. Deploy Application Code (10 min)

```bash
# Build and push Docker image
docker build -t valuecanvas/api:v1.2.0 .
docker push valuecanvas/api:v1.2.0

# Update Kubernetes deployment
kubectl set image deployment/valuecanvas-api api=valuecanvas/api:v1.2.0 -n production

# Watch rollout
kubectl rollout status deployment/valuecanvas-api -n production
```

### 3. Configure Stripe Webhook (5 min)

```bash
# 1. Go to https://dashboard.stripe.com/webhooks
# 2. Click "Add endpoint"
# 3. URL: https://api.valuecanvas.com/api/billing/webhooks/stripe
# 4. Select events: invoice.*, customer.subscription.*, charge.*
# 5. Copy webhook secret
# 6. Update Kubernetes secret:

kubectl create secret generic stripe-credentials \
  --from-literal=webhook-secret=whsec_... \
  --dry-run=client -o yaml | kubectl apply -f - -n production
```

### 4. Deploy Cron Jobs (5 min)

```bash
# Apply CronJob manifests
kubectl apply -f k8s/cronjobs/webhook-retry.yaml -n production

# Verify
kubectl get cronjobs -n production
kubectl get jobs -n production | grep webhook-retry
```

### 5. Run E2E Tests (10 min)

```bash
# Run test suite
./scripts/tests/billing-e2e.sh --env=production

# Expected: All tests pass
```

### 6. Monitor (30 min)

```bash
# Watch logs
kubectl logs -f deployment/valuecanvas-api -n production | grep -i billing

# Check metrics
# - Webhook processing rate
# - Grace period creation
# - Audit log entries
# - No errors in logs
```

---

## Rollback Procedure

### If Deployment Fails

```bash
# 1. Rollback Kubernetes deployment
kubectl rollout undo deployment/valuecanvas-api -n production

# 2. Verify rollback
kubectl rollout status deployment/valuecanvas-api -n production

# 3. Disable Stripe webhook
# Go to Stripe Dashboard > Webhooks > Disable endpoint

# 4. Delete CronJobs
kubectl delete cronjob webhook-retry -n production
kubectl delete cronjob grace-period-cleanup -n production
```

### If Database Issues

```bash
# 1. Stop application
kubectl scale deployment valuecanvas-api --replicas=0 -n production

# 2. Restore database
psql $PRODUCTION_DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 3. Restart application
kubectl scale deployment valuecanvas-api --replicas=3 -n production
```

---

## Verification Commands

```bash
# Check webhook events
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*), processed 
FROM webhook_events 
WHERE received_at > NOW() - INTERVAL '1 hour' 
GROUP BY processed;
"

# Check grace periods
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*) 
FROM grace_periods 
WHERE expires_at > NOW();
"

# Check audit log
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*) 
FROM billing_audit_log 
WHERE created_at > NOW() - INTERVAL '1 hour';
"

# Check dead letter queue
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*) 
FROM webhook_dead_letter_queue;
"
```

---

## Troubleshooting

### Webhook Not Receiving Events

```bash
# 1. Check Stripe dashboard for delivery attempts
# 2. Verify webhook secret is correct
kubectl get secret stripe-credentials -n production -o yaml

# 3. Check application logs
kubectl logs deployment/valuecanvas-api -n production | grep webhook

# 4. Test endpoint manually
curl -X POST https://api.valuecanvas.com/api/billing/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### CronJob Not Running

```bash
# Check CronJob status
kubectl describe cronjob webhook-retry -n production

# Check recent jobs
kubectl get jobs -n production | grep webhook-retry

# View job logs
kubectl logs -l job-name=webhook-retry-<timestamp> -n production

# Manually trigger job
kubectl create job webhook-retry-manual --from=cronjob/webhook-retry -n production
```

### Grace Period Not Enforcing

```bash
# Check middleware is loaded
kubectl logs deployment/valuecanvas-api -n production | grep PlanEnforcement

# Verify table has data
psql $PRODUCTION_DATABASE_URL -c "SELECT * FROM grace_periods LIMIT 5;"

# Check RLS policies
psql $PRODUCTION_DATABASE_URL -c "
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'grace_periods';
"
```

---

## Success Criteria

- ✅ All database migrations applied
- ✅ Application deployed and healthy
- ✅ Stripe webhook receiving events
- ✅ CronJobs running on schedule
- ✅ E2E tests passing
- ✅ No errors in logs
- ✅ Metrics showing normal activity

---

## Contacts

- **On-Call:** [Phone]
- **DevOps:** [Slack Channel]
- **Database:** [Email]

---

## Estimated Timeline

- **Total Duration:** 35 minutes
- **Rollback Time:** 10 minutes
- **Monitoring Period:** 30 minutes

---

**Last Updated:** 2025-12-06
