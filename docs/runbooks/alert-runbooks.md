# Alert Runbooks

Runbooks for Prometheus alert rules defined in
`infra/k8s/observability/prometheus/alert-rules.yaml`.

## Status

| Alert | Runbook status |
|---|---|
| HighErrorRate | [x] done |
| HighResponseTime | [x] done |
| PodDown | [x] done |
| HighCPUUsage | [x] done |
| HighMemoryUsage | [x] done |
| PodRestarting | [x] done |
| DatabaseConnectionPoolExhausted | [x] done |
| HighRequestRate | [x] done |
| QueryFingerprintP95Regression | [x] done |
| QueryFingerprintTotalExecTimeRegression | [x] done |
| QueryFingerprintCallVolumeSpike | [x] done |
| NodeNotReady | [x] done |
| NodeDiskPressure | [x] done |
| NodeMemoryPressure | [x] done |
| DeploymentReplicasMismatch | [x] done |
| PVCAlmostFull | [x] done |

---

## HighErrorRate

**What fired:** 5xx response rate exceeded 0.1% of total requests over a 5-minute window.

**Immediate triage:**
```bash
kubectl logs -n valynt -l app=valueos-backend --tail=200 | grep '"level":"error"'
kubectl logs -n valynt -l app=valueos-backend --tail=500 | grep '"status_code":"5'
kubectl get pods -n valynt -l app=valueos-backend
```

**Common causes (by frequency):**
1. Unhandled exception in a new deployment — compare deploy time to alert start time.
2. Downstream dependency failure (Supabase, Redis, LLM provider) — check `/health/dependencies`.
3. Database connection exhaustion — see `DatabaseConnectionPoolExhausted`.
4. OOM kill causing pod restart mid-request — check `PodRestarting`.

**Remediation:**
```bash
# Roll back a bad deploy
kubectl rollout undo deployment/valueos-backend -n valynt

# Check dependency health
curl https://<api-host>/health/dependencies
```

**Escalation:** Page on-call if error rate > 1% for > 5 minutes or rollback does not resolve within 15 minutes. Owner: Platform team.

**Post-incident:** File GitHub issue with `incident-followup` label. Update alert threshold if producing false positives.

---

## HighResponseTime

**What fired:** P95 HTTP request latency exceeded 200ms over a 5-minute window.

**Immediate triage:**
```bash
kubectl logs -n valynt -l app=valueos-backend --tail=500 \
  | jq 'select(.duration_ms > 200) | {route, duration_ms}'

cat infra/observability/query-fingerprint-latest.json | jq '.[] | select(.p95_ms > 200)'

redis-cli -h $REDIS_HOST --latency-history -i 1
```

**Common causes (by frequency):**
1. Slow database query — new query without index, or table growth.
2. LLM provider latency spike — check Together.ai status.
3. Redis latency — check memory usage and eviction policy.
4. Cold-start after deploy — normalises within 2–3 minutes.

**Remediation:**
```bash
# Update table statistics if a query regressed
psql "$DATABASE_URL" -c "ANALYZE <table_name>;"

# Check Redis memory
redis-cli -h $REDIS_HOST info memory
```

**Escalation:** Page on-call if P95 > 500ms for > 10 minutes. Owner: Platform team.

**Post-incident:** Add the slow query to `query-fingerprint-budgets.json` with a tighter budget.

---

## PodDown

**What fired:** A pod in the `valynt` namespace has been in a non-Running state for more than 2 minutes.

**Immediate triage:**
```bash
kubectl get pods -n valynt
kubectl describe pod <pod-name> -n valynt
kubectl logs <pod-name> -n valynt --previous
```

**Common causes (by frequency):**
1. OOM kill — check `kubectl describe pod` for `OOMKilled` in last state.
2. Liveness probe failure — app running but not responding to `/health`.
3. Image pull failure — bad tag or registry credentials expired.
4. Crash loop from unhandled startup error.

**Remediation:**
```bash
# OOM kill: increase memory limit
kubectl edit deployment valueos-backend -n valynt

# Image pull failure
kubectl describe pod <pod-name> -n valynt | grep "Failed to pull"

# Crash loop: inspect logs before restarting
kubectl logs <pod-name> -n valynt --previous | tail -50
```

**Escalation:** Page on-call immediately if pod does not recover within 5 minutes or multiple pods are down. Owner: Platform team.

---

## HighCPUUsage

**What fired:** A pod's CPU usage exceeded 80% of its limit for more than 5 minutes.

**Immediate triage:**
```bash
kubectl top pods -n valynt
kubectl top nodes
kubectl exec -it <pod-name> -n valynt -- top -b -n 1
```

**Common causes (by frequency):**
1. Agent fabric processing a large batch — check if it resolves naturally.
2. Infinite loop or runaway retry — look for repeated identical log lines.
3. Insufficient replicas for current load — check HPA status.

**Remediation:**
```bash
# Scale up
kubectl scale deployment valueos-backend --replicas=<n> -n valynt

# Roll back if a deploy caused the spike
kubectl rollout undo deployment/valueos-backend -n valynt
```

**Escalation:** Page on-call if CPU > 95% sustained for > 10 minutes. Owner: Platform team.

**Post-incident:** Review CPU limits and HPA min/max replica settings.

---

## HighMemoryUsage

**What fired:** A pod's memory usage exceeded 85% of its limit for more than 5 minutes. OOM kill risk.

**Immediate triage:**
```bash
kubectl top pods -n valynt --sort-by=memory
kubectl exec -it <pod-name> -n valynt -- node -e "console.log(process.memoryUsage())"
kubectl logs <pod-name> -n valynt --tail=200 | grep -i "heap\|memory\|oom"
```

**Common causes (by frequency):**
1. Memory leak in a long-running agent session.
2. In-memory cache growing unbounded — check Redis TTL config.
3. Supabase realtime subscriptions accumulating.

**Remediation:**
```bash
# Immediate: restart to release memory (temporary)
kubectl rollout restart deployment/valueos-backend -n valynt

# Increase memory limit if workload has grown
kubectl edit deployment valueos-backend -n valynt
```

**Escalation:** Page on-call if memory > 95% (OOM kill imminent). Owner: Platform team.

**Post-incident:** Add heap profiling. Review in-memory cache eviction policies.

---

## PodRestarting

**What fired:** A pod has restarted more than 3 times in the last 15 minutes.

**Immediate triage:**
```bash
kubectl get pods -n valynt
kubectl describe pod <pod-name> -n valynt | grep -A5 "Last State"
kubectl logs <pod-name> -n valynt --previous | tail -100
```

**Common causes (by frequency):**
1. Unhandled exception at startup — missing env var, failed DB connection.
2. OOM kill — exit code 137.
3. Liveness probe timeout.
4. Bad deploy introducing a fatal error.

**Remediation:**
```bash
# Check exit code
kubectl describe pod <pod-name> -n valynt | grep "Exit Code"

# Roll back if bad deploy
kubectl rollout undo deployment/valueos-backend -n valynt

# Check env/secret mounting
kubectl describe pod <pod-name> -n valynt | grep -A10 "Environment"
```

**Escalation:** Page on-call if restart count > 5 within 15 minutes. Owner: Platform team.

---

## DatabaseConnectionPoolExhausted

**What fired:** The PostgreSQL connection pool is at or near its limit. New requests will fail.

**Immediate triage:**
```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';"
psql "$DATABASE_URL" -c "SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
kubectl logs -n valynt -l app=valueos-backend --tail=200 | grep -i "connection\|pool"
```

**Common causes (by frequency):**
1. Long-running agent queries holding connections without a timeout.
2. Connection leak — connections not released after request.
3. Traffic spike without pool scaling.
4. Idle connections from crashed pods not cleaned up.

**Remediation:**
```bash
# Kill idle connections older than 5 minutes
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';"

# Kill long-running queries (> 2 minutes)
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle' AND query_start < now() - interval '2 minutes';"

# Temporarily reduce replicas to lower connection demand
kubectl scale deployment valueos-backend --replicas=2 -n valynt
```

**Escalation:** Page on-call immediately — connection exhaustion causes 100% error rate. Owner: Platform team.

**Post-incident:** Review `DATABASE_POOL_SIZE`. Add statement timeouts to agent DB calls.

---

## HighRequestRate

**What fired:** Request rate exceeded the configured threshold — traffic spike or potential abuse.

**Immediate triage:**
```bash
kubectl logs -n valynt -l app=valueos-backend --tail=500 \
  | jq '{ip: .ip, tenant: .tenantId, route: .route}' | sort | uniq -c | sort -rn | head -20
```

**Common causes (by frequency):**
1. Legitimate traffic spike — product launch or marketing campaign.
2. Runaway client retry loop — client ignoring 429 responses.
3. Scraper or bot.
4. DDoS — check for single-IP concentration.

**Remediation:**
```bash
# Apply stricter rate limit for the offending tenant via Redis config

# Block an IP at the Caddy layer
# Edit infra/caddy/Caddyfile and add the IP to the blocklist

# Scale up for legitimate spikes
kubectl scale deployment valueos-backend --replicas=<n> -n valynt
```

**Escalation:** Page on-call if rate is > 10× normal and not resolving. Involve Security team if abuse suspected. Owner: Platform team.

---

## QueryFingerprintP95Regression

**What fired:** A tracked SQL query fingerprint's P95 execution time exceeded its budget in `infra/observability/query-fingerprint-budgets.json`.

**Immediate triage:**
```bash
cat infra/observability/query-fingerprint-latest.json | jq '.[] | select(.p95_ms > .budget_ms)'

# Run EXPLAIN ANALYZE on the regressed query
psql "$DATABASE_URL" -c "EXPLAIN (ANALYZE, BUFFERS) <query>;"

# Check recent migrations
git log --oneline infra/supabase/supabase/migrations/ | head -10
```

**Common causes (by frequency):**
1. Missing index after a migration added a new filter column.
2. Table growth crossing a threshold where a sequential scan becomes expensive.
3. Statistics not updated after bulk insert.
4. Lock contention from a concurrent migration.

**Remediation:**
```bash
# Update table statistics
psql "$DATABASE_URL" -c "ANALYZE <table_name>;"

# Add a missing index via a new migration
# CREATE INDEX CONCURRENTLY idx_<table>_<column> ON <table>(<column>);
```

**Escalation:** Page on-call if P95 > 1000ms for a T1 table query. Owner: Platform team.

**Post-incident:** Update the budget in `query-fingerprint-budgets.json` only if the new baseline is acceptable.

---

## QueryFingerprintTotalExecTimeRegression

**What fired:** The total cumulative execution time for a query fingerprint has increased significantly — either a slow query or a volume spike.

**Immediate triage:**
```bash
cat infra/observability/query-fingerprint-latest.json \
  | jq 'sort_by(-.total_exec_time_ms) | .[0:5]'
```

**Common causes (by frequency):**
1. N+1 query pattern introduced by a new feature.
2. Background job running more frequently than intended.
3. Query latency regression — see `QueryFingerprintP95Regression`.

**Remediation:**
- N+1: batch the queries or add a join.
- Background job: review the cron schedule.
- Latency: follow `QueryFingerprintP95Regression` remediation.

**Escalation:** Page on-call if total exec time is causing DB CPU > 80%. Owner: Platform team.

---

## QueryFingerprintCallVolumeSpike

**What fired:** A query fingerprint's call rate has spiked significantly above its baseline.

**Immediate triage:**
```bash
cat infra/observability/query-fingerprint-latest.json \
  | jq 'sort_by(-.calls_per_second) | .[0:5]'

# Correlate with recent deploys
git log --oneline --since="1 hour ago"
```

**Common causes (by frequency):**
1. New feature polling the DB instead of using Supabase Realtime.
2. Retry storm — a failing operation retrying in a tight loop.
3. Cache miss storm after a Redis flush or restart.

**Remediation:**
- Polling: migrate to Supabase Realtime subscriptions.
- Retry storm: add exponential backoff and a circuit breaker.
- Cache miss storm: pre-warm the cache or add a stampede protection lock.

**Escalation:** Page on-call if call volume is causing connection pool exhaustion. Owner: Platform team.

---

## NodeNotReady

**What fired:** A Kubernetes node has been in `NotReady` state for more than 2 minutes.

**Immediate triage:**
```bash
kubectl get nodes
kubectl describe node <node-name> | grep -A20 "Conditions:"
kubectl get events -n valynt --sort-by='.lastTimestamp' | tail -20
kubectl top node <node-name>
```

**Common causes (by frequency):**
1. Node out of disk space — see `NodeDiskPressure`.
2. Node out of memory — see `NodeMemoryPressure`.
3. kubelet crashed or lost connectivity to the control plane.
4. Cloud provider instance failure.

**Remediation:**
```bash
# Restart kubelet if it crashed
systemctl restart kubelet

# Cordon and drain if unrecoverable
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Provision a replacement node via Terraform
cd infra/terraform && terraform apply
```

**Escalation:** Page on-call immediately — a NotReady node reduces cluster capacity. Owner: Platform team.

---

## NodeDiskPressure

**What fired:** A Kubernetes node is reporting `DiskPressure` — available disk is below the kubelet eviction threshold.

**Immediate triage:**
```bash
kubectl describe node <node-name> | grep -A5 "DiskPressure"
df -h  # on the node
du -sh /var/lib/docker/* 2>/dev/null | sort -rh | head -10
du -sh /var/log/* 2>/dev/null | sort -rh | head -10
```

**Common causes (by frequency):**
1. Container image layers accumulating — old images not pruned.
2. Log files growing unbounded — missing log rotation.
3. Tempo/Loki local storage filling up.
4. PVC not mounted correctly — data written to node disk instead.

**Remediation:**
```bash
# Prune unused Docker images and containers
docker system prune -f

# Remove old container logs
find /var/log/containers -name "*.log" -mtime +7 -delete

# Reduce Loki/Tempo retention if they are the cause
# infra/observability/loki/loki-config.yaml → limits_config.max_query_lookback
# infra/observability/tempo/tempo-config.yaml → compactor.compaction.block_retention
```

**Escalation:** Page on-call if disk > 90% — kubelet will start evicting pods. Owner: Platform team.

**Post-incident:** Configure log rotation on all nodes. Add a 70% disk usage warning alert.

---

## NodeMemoryPressure

**What fired:** A Kubernetes node is reporting `MemoryPressure` — available memory is below the kubelet eviction threshold.

**Immediate triage:**
```bash
kubectl describe node <node-name> | grep -A5 "MemoryPressure"
kubectl top node <node-name>
kubectl top pods -n valynt --sort-by=memory | head -10
```

**Common causes (by frequency):**
1. A pod without a memory limit consuming all available node memory.
2. Memory leak in a long-running pod — see `HighMemoryUsage`.
3. Node undersized for the current workload.
4. DaemonSet (Fluent Bit, node-exporter) consuming more memory than expected.

**Remediation:**
```bash
# Identify the top memory consumer
kubectl top pods --all-namespaces --sort-by=memory | head -10

# Evict the highest-memory pod if it has no memory limit
kubectl delete pod <pod-name> -n <namespace>

# Add memory limits to pods missing them
kubectl edit deployment <deployment-name> -n valynt
```

**Escalation:** Page on-call immediately — MemoryPressure causes pod evictions. Owner: Platform team.

**Post-incident:** Enforce memory limits on all deployments via admission webhook or OPA policy.

---

## DeploymentReplicasMismatch

**What fired:** The number of ready replicas does not match the desired count for more than 5 minutes.

**Immediate triage:**
```bash
kubectl get deployments -n valynt
kubectl describe deployment <deployment-name> -n valynt | grep -A10 "Replicas:"
kubectl get pods -n valynt -l app=<deployment-name>
kubectl get events -n valynt --sort-by='.lastTimestamp' | grep <deployment-name> | tail -20
```

**Common causes (by frequency):**
1. Pods failing to start — see `PodRestarting`.
2. Insufficient cluster resources — nodes at capacity.
3. Image pull failure — bad tag or registry credentials.
4. PodDisruptionBudget blocking the rollout.

**Remediation:**
```bash
kubectl describe pod <pod-name> -n valynt

# Check node capacity
kubectl describe nodes | grep -A5 "Allocated resources"

# Check PDB
kubectl get pdb -n valynt
kubectl describe pdb <pdb-name> -n valynt
```

**Escalation:** Page on-call if mismatch persists > 15 minutes or deployment is at 0 ready replicas. Owner: Platform team.

---

## PVCAlmostFull

**What fired:** A PersistentVolumeClaim is more than 85% full. At 100% the writing pod will crash.

**Immediate triage:**
```bash
kubectl get pvc -n valynt
kubectl describe pvc <pvc-name> -n valynt
kubectl exec -it <pod-name> -n valynt -- df -h
kubectl exec -it <pod-name> -n valynt -- du -sh /* 2>/dev/null | sort -rh | head -10
```

**Common causes (by frequency):**
1. Loki or Tempo storage growing beyond configured retention.
2. Postgres WAL archive accumulating.
3. Application writing temporary files without cleanup.
4. PVC sized too small for current data volume.

**Remediation:**
```bash
# Reduce Loki retention
# Edit infra/observability/loki/loki-config.yaml → limits_config.max_query_lookback
# Restart Loki to trigger compaction

# Reduce Tempo retention
# Edit infra/observability/tempo/tempo-config.yaml → compactor.compaction.block_retention

# Verify Postgres WAL archiving is working
aws s3 ls s3://valynt-wal-archive/ | tail -20

# Expand the PVC if the storage class supports it
kubectl patch pvc <pvc-name> -n valynt \
  -p '{"spec":{"resources":{"requests":{"storage":"<new-size>"}}}}'
```

**Escalation:** Page on-call if PVC > 95% — writes will fail imminently. Owner: Platform team.

**Post-incident:** Set PVC usage alerts at 70% (warn) and 85% (critical). Review retention policies for all stateful services.
