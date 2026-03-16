---
title: RBAC Degraded-Security Runbook — Redis Unavailable
owner: team-security
review_date: 2027-01-01
status: active
---

# RBAC Degraded-Security Runbook: Redis Unavailable

**Severity:** High  
**Impact:** Cross-instance RBAC cache invalidation is broken. Permission changes (role assignments, revocations) made on one instance will not propagate to other instances until the in-process cache TTL expires (`RBAC_CACHE_TTL_SECONDS`, default 300s).

---

## Detection

**Prometheus alert:** `RbacRedisUnavailable` (defined in `infra/k8s/monitoring/rbac-alerts.yaml`)

Fires when `increase(rbac_redis_unavailable_total[5m]) > 0` is sustained for 5 minutes.

**Manual check:**

```bash
# Check the counter directly
kubectl exec -n valynt deploy/api -- \
  curl -s http://localhost:9090/metrics | grep rbac_redis_unavailable_total

# Check Redis connectivity from the API pod
kubectl exec -n valynt deploy/api -- \
  redis-cli -u "$REDIS_URL" ping
```

**Log signal** (`packages/backend/src/lib/rbacInvalidation.ts`):

```
WARN  Redis unavailable — RBAC invalidation publish skipped; cross-instance caches will not be cleared
ERROR Redis unavailable — RBAC invalidation subscription skipped; this instance will not receive cross-instance cache invalidations (degraded-security mode)
```

---

## Diagnosis

1. **Check Redis pod health:**
   ```bash
   kubectl get pods -n valynt -l app=redis
   kubectl logs -n valynt -l app=redis --tail=50
   ```

2. **Check Redis connectivity from API pods:**
   ```bash
   kubectl exec -n valynt deploy/api -- redis-cli -u "$REDIS_URL" ping
   ```

3. **Check `rbacInvalidation.ts` logs for the specific error:**
   ```bash
   kubectl logs -n valynt -l app=api --since=10m | grep -i "rbac\|redis"
   ```

4. **Confirm the counter is incrementing (not a stale alert):**
   ```bash
   kubectl exec -n valynt deploy/api -- \
     curl -s http://localhost:9090/metrics | grep rbac_redis_unavailable_total
   ```

---

## Impact Assessment

| Condition | Effect |
|---|---|
| Redis down < `RBAC_CACHE_TTL_SECONDS` (default 300s) | Stale permissions possible on instances that cached a role before the change |
| Redis down > `RBAC_CACHE_TTL_SECONDS` | All instances will re-fetch from DB on next permission check — effectively self-healing |
| Role revocation during outage | Revoked role may remain active on cached instances for up to TTL seconds |

---

## Remediation

### Option A — Restore Redis (preferred)

1. Identify the Redis failure cause (OOM, crash, network partition).
2. Restart the Redis pod if crashed:
   ```bash
   kubectl rollout restart deployment/redis -n valynt
   ```
3. Verify connectivity:
   ```bash
   kubectl exec -n valynt deploy/api -- redis-cli -u "$REDIS_URL" ping
   # Expected: PONG
   ```
4. Confirm `rbac_redis_unavailable_total` stops incrementing.
5. If a sensitive role was revoked during the outage, force cache flush by restarting API pods:
   ```bash
   kubectl rollout restart deployment/api -n valynt
   ```

### Option B — Reduce TTL to limit stale window (performance cost)

If Redis cannot be restored quickly and a role revocation is security-critical:

1. Set `RBAC_CACHE_TTL_SECONDS=0` in the environment secret to disable in-process caching:
   ```bash
   kubectl set env deployment/api RBAC_CACHE_TTL_SECONDS=0 -n valynt
   ```
   **Warning:** This causes every permission check to hit the database. Expect increased DB load and higher API latency until Redis is restored.

2. Restore the default after Redis is back:
   ```bash
   kubectl set env deployment/api RBAC_CACHE_TTL_SECONDS=300 -n valynt
   ```

---

## Escalation

| Time since alert | Action |
|---|---|
| 0–5 min | On-call engineer investigates |
| 5–15 min | If Redis not restored, apply Option B to limit stale window |
| 15+ min | Restart all API instances (`kubectl rollout restart deployment/api -n valynt`) and escalate to platform lead |

---

## Related

- Alert definition: `infra/k8s/monitoring/rbac-alerts.yaml`
- Source: `packages/backend/src/lib/rbacInvalidation.ts`
- Permission cache: `packages/backend/src/services/auth/PermissionService.ts`
- Environment variable: `RBAC_CACHE_TTL_SECONDS` (see `.env.example`)
