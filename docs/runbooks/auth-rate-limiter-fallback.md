# Runbook: AuthRateLimiterFallbackActive

**Alert:** `AuthRateLimiterFallbackActive`
**Severity:** Warning
**Team:** security
**Source:** [infra/observability/prometheus/alerts/auth-rate-limiter.yml](../../infra/observability/prometheus/alerts/auth-rate-limiter.yml)

## Symptom

The Redis-backed auth rate limiter has fallen back to per-pod in-memory enforcement. Under autoscaling, effective rate limits become N pods × maxAttempts, creating a brute-force bypass window.

## Triage Checklist

1. Check Redis connectivity from the backend pods.
2. Check if Redis Sentinel is healthy.
3. Determine if the fallback is affecting all pods or a subset.

## Diagnostic Commands

```bash
# Check Redis pod health
kubectl get pods -l app=redis-broker -n production
kubectl exec -it redis-broker-primary-0 -n production -- redis-cli ping

# Check Redis Sentinel status
kubectl exec -it redis-sentinel-0 -n production -- redis-cli -p 26379 sentinel masters

# Check backend logs for rate limiter warnings
kubectl logs -l app=backend -n production --tail=200 | grep -i "rate limiter\|redis.*fail"

# Check the metric directly
# Prometheus: rate(auth_rate_limiter_fallback_active_total[5m])
```

## Resolution Steps

1. **If Redis is down:** Restart Redis pods.
   ```bash
   kubectl rollout restart statefulset/redis-broker -n production
   ```
2. **If Redis is healthy but unreachable:** Check network policies.
   ```bash
   kubectl get networkpolicies -n production
   ```
3. **If circuit breaker is open:** Wait for auto-reconnect (30s delay, 3-failure threshold). The store auto-recovers; no restart needed.
4. **If all else fails:** Restart backend pods to force fresh Redis connections.
   ```bash
   kubectl rollout restart deployment/backend-green -n production
   ```

## Escalation

- If Redis remains unreachable after 15 minutes → page DevOps lead.
- If brute-force attempts are detected during fallback → page Security lead immediately.

## Verification

- `auth_rate_limiter_fallback_active_total` rate drops to 0.
- `redis-cli ping` returns PONG from all backend pods.
- Alert resolves.
