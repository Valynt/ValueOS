# Agent Stalls (Queues Not Draining)

**Goal:** Restore forward progress when background agents appear hung or queues stop draining.

## Symptoms
- Task queue depth grows while throughput trends to zero.
- Agent heartbeats stop updating in Redis or the database.
- API callers wait indefinitely for agent-produced results.

## First-Response Checklist
1. Page the **On-Call SRE** and notify the **Feature Owner** for the affected service.
2. Announce the investigation in `#incidents` with the ticket link and time started.
3. Capture current queue metrics screenshots (Grafana "Worker/Queue Overview").

## Quick Health Checks
- Redis availability: `redis-cli -u "$REDIS_URL" PING`
- Queue visibility: `redis-cli -u "$REDIS_URL" LLEN agent:pending`
- Worker pods: `kubectl get pods -l app=agent-worker`

## Triage Procedure
1. **Confirm queue congestion**
   - If LLEN > baseline for 5+ minutes, treat as active stall.
   - Compare against alerts in Grafana panel `Queues › Backlog`.
2. **Check worker liveness**
   - Inspect pod readiness and restarts: `kubectl describe pod <name>`.
   - Review worker logs for retry storms or unhandled exceptions.
3. **Validate Redis connectivity and auth**
   - Run `redis-cli -u "$REDIS_URL" INFO clients` and verify `blocked_clients` < 5.
   - If `MISCONF` appears, persistence is failing—fail over to the replica.
4. **Identify blocked jobs**
   - List stuck jobs older than 10 minutes:
     ```sql
     SELECT id, task_type, status, updated_at
     FROM agent_jobs
     WHERE status IN ('running', 'retry')
       AND updated_at < now() - interval '10 minutes'
     ORDER BY updated_at ASC
     LIMIT 50;
     ```
   - If many jobs are stuck on one task type, open the corresponding service logs.
5. **Restart unhealthy workers**
   - Drain one pod at a time to avoid thundering herds:
     ```bash
     kubectl cordon <node-with-bad-pod>
     kubectl delete pod <agent-worker-pod>
     ```
   - Verify new pod pulls the latest image and reconnects to Redis.
6. **Redis inspection**
   - Look for oversized payloads causing timeouts:
     ```bash
     redis-cli -u "$REDIS_URL" --bigkeys | head -n 20
     ```
   - If `agent:pending` entries exceed 100k, enable rate limiting on producers until drain catches up.
7. **Validate recovery**
   - Ensure LLEN decreases for 10 consecutive minutes.
   - Close the incident only after backlog returns to baseline and no retries are piling up.

## Observability Queries
- **Loki (LogQL) to find stalled task types**
  ```logql
  sum by(task_type) (rate({app="agent-worker", level="error"} |= "timeout" [5m]))
  ```
  A spike on a single `task_type` points to a bad upstream dependency.
- **Loki to find reconnect loops**
  ```logql
  count_over_time({app="agent-worker"} |= "ECONNREFUSED" [10m])
  ```
- **PostgreSQL to confirm heartbeats**
  ```sql
  SELECT worker_id, max(heartbeat_at) AS last_seen
  FROM agent_worker_heartbeats
  GROUP BY worker_id
  ORDER BY last_seen ASC;
  ```

## Escalation
- If Redis is unavailable for >10 minutes, fail over to the replica and open a P1 infrastructure incident.
- If a code regression is suspected, ask the **Release Captain** to prepare rollback per `docs/ops/runbooks/rollback.md`.
