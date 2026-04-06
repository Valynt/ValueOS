# Runbook: WorkflowStuckDetected / WorkflowWatchdogFailing

**Alerts:**

- `WorkflowStuckDetected` (Warning)
- `WorkflowWatchdogFailing` (Critical)

**Team:** agent-platform
**Source:** [infra/observability/prometheus/alerts/stuck-workflows.yml](../../infra/observability/prometheus/alerts/stuck-workflows.yml)

---

## WorkflowStuckDetected

### Symptom

One or more workflow executions have been running longer than their timeout threshold. The watchdog has detected them and attempted to requeue or fail them.

### Triage Checklist

1. Check how many workflows are stuck.
2. Identify the lifecycle stage (discovery, hypothesis, modeling, integrity, etc.).
3. Determine if a specific agent is hanging (LLM timeout, DB lock).

### Diagnostic Commands

```bash
# Check watchdog metrics
# Prometheus: increase(workflow_stuck_detected_total[5m])

# Check WorkflowWatchdogWorker logs
kubectl logs -l app=workers -n production --tail=300 | grep -i "watchdog\|stuck\|timeout"

# Check BullMQ queue depth
kubectl exec -it redis-broker-primary-0 -n production -- redis-cli llen bull:workflow:active

# Check active workflow executions in database
# Via Supabase dashboard or psql:
# SELECT id, status, lifecycle_stage, updated_at FROM workflow_executions
#   WHERE status = 'running' AND updated_at < NOW() - INTERVAL '30 minutes';
```

### Resolution Steps

1. **If watchdog already handled it:** Verify the stuck workflows were requeued or failed. No action needed if the metric rate drops back to 0.
2. **If workflows keep getting stuck:**
   - Check LLM provider status (Together.ai, OpenAI) — agent timeouts cause workflow hangs.
   - Check database connection pool — exhausted pool causes query hangs.
   - Check Redis — BullMQ requires Redis for job coordination.
3. **Manual intervention for a specific workflow:**
   ```sql
   UPDATE workflow_executions SET status = 'failed', error = 'Manual intervention: stuck workflow'
   WHERE id = '<workflow_id>' AND status = 'running';
   ```

### Escalation

- If >10 workflows stuck simultaneously → page Backend lead.
- If the same lifecycle stage is consistently stuck → file a bug for that agent.

---

## WorkflowWatchdogFailing

### Symptom

The watchdog worker itself is failing. Without the watchdog, stuck workflows go undetected indefinitely.

### Triage Checklist

1. Check watchdog worker pod status.
2. Check if Redis is reachable (watchdog uses BullMQ).
3. Check if database is reachable (watchdog queries workflow_executions).

### Diagnostic Commands

```bash
# Check worker pod status
kubectl get pods -l app=workers -n production

# Check worker logs for watchdog errors
kubectl logs -l app=workers -n production --tail=300 | grep -i "watchdog\|WorkflowWatchdog"

# Check Redis connectivity from worker
kubectl exec -it <worker-pod> -n production -- node -e "
  const Redis = require('ioredis');
  const r = new Redis(process.env.REDIS_URL);
  r.ping().then(p => { console.log('Redis:', p); r.disconnect(); })
"
```

### Resolution Steps

1. **If worker pod crashed:** Check restart count and OOMKill events.
   ```bash
   kubectl describe pod <worker-pod> -n production | grep -A5 "Last State"
   ```
2. **If Redis is unreachable:** Fix Redis first (see auth-rate-limiter-fallback runbook).
3. **If database is unreachable:** Check Supabase health endpoint and connection pool.
4. **Restart workers:**
   ```bash
   kubectl rollout restart deployment/workers -n production
   ```

### Escalation

- **Immediate:** This is critical — without the watchdog, stuck workflows accumulate silently.
- Page Backend lead and DevOps lead.

### Verification

- `workflow_watchdog_failures_total` stops incrementing.
- Watchdog logs show successful scan cycles.
- Previously stuck workflows are resolved.
