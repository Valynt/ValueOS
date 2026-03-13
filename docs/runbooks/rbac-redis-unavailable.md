# Runbook: RBAC Redis Pub/Sub Unavailable

**Alert:** `RbacRedisPubSubUnavailable`  
**Source:** `infra/k8s/monitoring/rbac-alerts.yaml`  
**Metric:** `rbac_redis_unavailable_total`  
**Fires when:** `increase(rbac_redis_unavailable_total[5m]) > 0` sustained for 5 minutes

---

## What this means

`PermissionService` caches role definitions in-process with a 5-minute TTL (default 300 s).
When a role or permission changes, `publishRbacInvalidation()` broadcasts the event over
Redis pub/sub so every running instance clears its cache immediately.

When Redis is unavailable, that broadcast is skipped. Each instance continues serving
requests from its stale in-process cache until the TTL expires. In a multi-instance
deployment this means:

- A user whose role was **revoked** may retain access for up to 5 minutes on instances
  that did not receive the invalidation.
- A user whose role was **granted** may be denied access on those same instances.

Single-instance deployments are unaffected — in-process invalidation still fires.

---

## Detection

The alert fires when `rbac_redis_unavailable_total` increments. You can also detect it
from logs:

```
# Publish path (role change attempted)
"Redis unavailable — RBAC invalidation publish skipped; cross-instance caches will not be cleared"

# Subscribe path (instance startup)
"Redis unavailable — RBAC invalidation subscription skipped; this instance will not receive cross-instance cache invalidations (degraded-security mode)"
```

Both log at `error` level from `packages/backend/src/lib/rbacInvalidation.ts`.

---

## Diagnosis

**1. Confirm Redis connectivity:**

```bash
# From a backend pod
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
# Expected: PONG
```

**2. Check the counter rate:**

```promql
rate(rbac_redis_unavailable_total[5m])
```

A non-zero rate means the publish or subscribe path is failing on at least one instance.

**3. Check backend logs for the specific error:**

```bash
kubectl logs -l app=backend --since=10m | grep "rbac_redis_unavailable\|RBAC invalidation"
```

**4. Confirm which instances are affected:**

```promql
increase(rbac_redis_unavailable_total[5m]) by (pod)
```

---

## Remediation

### Option A — Restore Redis connectivity (preferred)

1. Verify Redis pod/service health: `kubectl get pods -l app=redis`
2. Check Redis memory usage — eviction under memory pressure can cause connection drops
3. Restart the Redis pod if it is in a crash loop: `kubectl rollout restart deployment/redis`
4. Confirm `rbac_redis_unavailable_total` stops incrementing after Redis recovers

### Option B — Force DB check on every request (emergency, performance cost)

If Redis cannot be restored quickly and the security risk is unacceptable, set the cache
TTL to zero so every permission check hits the database:

```bash
kubectl set env deployment/backend RBAC_CACHE_TTL_SECONDS=0
```

This eliminates stale-cache risk but increases database load. Revert once Redis is healthy:

```bash
kubectl set env deployment/backend RBAC_CACHE_TTL_SECONDS=300
```

`RBAC_CACHE_TTL_SECONDS` is read at startup by `PermissionService`. The default is 300 s
(5 minutes). Set it in `.env` for local development.

### Option C — Restart affected instances (last resort)

If neither option resolves the issue within 15 minutes, restart the backend deployment to
flush all in-process caches:

```bash
kubectl rollout restart deployment/backend
```

This forces all instances to re-subscribe to Redis pub/sub on startup. If Redis is still
unavailable they will log the subscription-skipped error and operate in degraded mode.

---

## Escalation

- **< 5 minutes:** Monitor — single-instance or transient blip, no action needed
- **5–15 minutes:** Follow Option A or B above; notify on-call platform engineer
- **> 15 minutes:** Page incident commander; consider Option C; open incident ticket

Owner: Platform team (`@platform` in Slack `#incidents`)

---

## Post-incident

1. Confirm `rbac_redis_unavailable_total` returns to zero
2. If `RBAC_CACHE_TTL_SECONDS=0` was set as a workaround, revert it
3. Document root cause in the incident ticket
4. If Redis OOM was the cause, review memory limits in `infra/k8s/base/redis.yaml`
