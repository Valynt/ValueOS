# Runbook: Blue-Green Rollback Procedure

**Last Rehearsed:** _TBD (update after S2-02 rehearsal)_
**Target RTO:** ≤2 minutes
**Owner:** DevOps

## Prerequisites

- `kubectl` configured for the production cluster.
- Verified which slot (blue/green) is currently active.

## Identify Current Active Slot

```bash
kubectl get service backend-active -n production -o jsonpath='{.spec.selector.slot}'
# Expected output: "blue" or "green"
```

## Rollback Steps

### 1. Switch traffic to the inactive (last-known-good) slot

```bash
# If current active is "green", roll back to "blue" (and vice versa)
CURRENT_SLOT=$(kubectl get service backend-active -n production -o jsonpath='{.spec.selector.slot}')

if [ "$CURRENT_SLOT" = "green" ]; then
  ROLLBACK_SLOT="blue"
else
  ROLLBACK_SLOT="green"
fi

echo "Rolling back from $CURRENT_SLOT to $ROLLBACK_SLOT"

# Switch backend traffic
kubectl patch service backend-active -n production \
  -p "{\"spec\":{\"selector\":{\"slot\":\"$ROLLBACK_SLOT\"}}}"

# Switch frontend traffic
kubectl patch service frontend-active -n production \
  -p "{\"spec\":{\"selector\":{\"slot\":\"$ROLLBACK_SLOT\"}}}"
```

### 2. Verify rollback (within 30 seconds)

```bash
# Health check
curl -s https://app.valynt.com/health | jq .status
# Expected: "ok"

# Readiness probe
curl -s -o /dev/null -w "%{http_code}" https://app.valynt.com/ready
# Expected: 200

# Verify the active slot changed
kubectl get service backend-active -n production -o jsonpath='{.spec.selector.slot}'
# Expected: $ROLLBACK_SLOT
```

### 3. Monitor for 5 minutes

```bash
# Watch error rate (should be near 0)
# Grafana → ValueOS Production Overview → Error Rate panel

# Check for pod restarts
kubectl get pods -l slot=$ROLLBACK_SLOT -n production

# Check recent logs for errors
kubectl logs -l app=backend,slot=$ROLLBACK_SLOT -n production --tail=50 --since=5m | grep -i error
```

### 4. Confirm rollback success

- Error rate stable at <0.1%.
- p95 latency ≤300ms.
- No CrashLoopBackOff pods.
- Health/readiness endpoints return 200.

## If Rollback Fails

If both slots are unhealthy:

1. **Scale down the broken slot:**
   ```bash
   kubectl scale deployment backend-$CURRENT_SLOT --replicas=0 -n production
   ```
2. **Check if the rollback slot pods are running:**
   ```bash
   kubectl get pods -l slot=$ROLLBACK_SLOT -n production
   ```
3. **If rollback slot has 0 replicas, scale it up:**
   ```bash
   kubectl scale deployment backend-$ROLLBACK_SLOT --replicas=3 -n production
   kubectl rollout status deployment backend-$ROLLBACK_SLOT -n production --timeout=120s
   ```
4. **Escalate to P0 incident** if neither slot recovers within 5 minutes.

## Post-Rollback

1. **Notify team** in `#launch-ops` Slack channel.
2. **Create incident ticket** with: time of rollback, affected slot, root cause (if known).
3. **Do NOT redeploy** until root cause is identified and fixed.
4. **Update this runbook** with rehearsal date and any learnings.

## Rehearsal Log

| Date  | Slot Tested | Rollback Time | Issues Found | Operator |
| ----- | ----------- | ------------- | ------------ | -------- |
| _TBD_ | green→blue  | _s_           | _none_       | _name_   |
