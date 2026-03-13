# Alert Runbooks

Runbooks for Prometheus alert rules defined in:

- `infra/k8s/observability/prometheus/alert-rules.yaml`
- `infra/prometheus/alerts/backend-api-alerts.yml`
- `infra/prometheus/alerts/resource-pressure-alerts.yml`
- `infra/prometheus/alerts/slo-alerts.yml`

Each alert below has a complete triage and response procedure. Alert annotations include
a `runbook` URL that deep-links to the section anchor in this document.

## Status

| Alert | Runbook status | Owning team | Rule file |
|---|---|---|---|
| HighErrorRate | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighResponseTime | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| PodDown | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighCPUUsage | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighMemoryUsage | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| PodRestarting | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| DatabaseConnectionPoolExhausted | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighRequestRate | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintP95Regression | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintTotalExecTimeRegression | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintCallVolumeSpike | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeNotReady | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeDiskPressure | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeMemoryPressure | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| DeploymentReplicasMismatch | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| PVCAlmostFull | [x] complete | SRE / Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |

## Alert: HighErrorRate
- **Owning team:** Backend Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Per-pod HTTP 5xx ratio is above 5% for 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get pods -o wide`
  - `kubectl -n <namespace> logs <pod> --since=15m | rg " 5[0-9]{2} "`
  - `kubectl -n <namespace> describe pod <pod>`
- **Common causes:** bad deployment, downstream dependency outage, exhausted DB/Redis pool, malformed request burst.
- **Remediation:** rollback recent release, restart unhealthy pods, scale deployment (`kubectl -n <namespace> scale deploy/<name> --replicas=<n>`), mitigate failing dependency.
- **Escalation:** page Backend Platform on-call immediately if sustained for >10 minutes or customer-facing APIs return 5xx.
- **Post-incident actions:** add regression test for failure mode, tune alert threshold if needed, document root-cause timeline.

## Alert: HighResponseTime
- **Owning team:** Backend Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Pod-level p95 request latency exceeds 1 second for 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> top pod <pod>`
  - `kubectl -n <namespace> logs <pod> --since=15m | rg -i "timeout|slow|latency"`
  - `kubectl -n <namespace> get hpa`
- **Common causes:** hot shard/tenant traffic, DB query slowdown, CPU throttling, external API latency.
- **Remediation:** scale horizontally, enable cached responses, rollback expensive endpoint change, temporarily rate-limit noisy clients.
- **Escalation:** page Backend Platform if p95 >2s for 15 minutes or correlated with SLA/SLO burn.
- **Post-incident actions:** create dashboard panel for top slow routes and add load-test scenario.

## Alert: PodDown
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Prometheus reports `up == 0` for a Kubernetes pod target for 2+ minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get pod <pod> -o wide`
  - `kubectl -n <namespace> describe pod <pod>`
  - `kubectl -n <namespace> get events --sort-by=.lastTimestamp | tail -n 30`
- **Common causes:** crash loop, failed readiness probe, image pull error, node eviction.
- **Remediation:** fix probe/image/env config, cordon + drain unhealthy node if needed, redeploy workload.
- **Escalation:** page SRE immediately for critical workloads or if >1 replica is down.
- **Post-incident actions:** improve health checks and add canary validation in CI/CD.

## Alert: HighCPUUsage
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Pod CPU usage is above 80% of requested quota for 10 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> top pod <pod> --containers`
  - `kubectl -n <namespace> describe pod <pod> | rg -n "Limits|Requests|cpu"`
  - `kubectl -n <namespace> logs <pod> --since=15m`
- **Common causes:** traffic surge, runaway loop, under-provisioned CPU request/limit, noisy background jobs.
- **Remediation:** scale replicas, increase CPU limits, disable expensive feature flags/jobs, rollback recent CPU-heavy build.
- **Escalation:** page SRE if throttling causes user-visible latency or if multiple namespaces are affected.
- **Post-incident actions:** resize requests/limits and update autoscaling policy.

## Alert: HighMemoryUsage
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Pod memory working set exceeds 90% of memory limit for 10 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> top pod <pod> --containers`
  - `kubectl -n <namespace> describe pod <pod> | rg -n "OOMKilled|Memory"`
  - `kubectl -n <namespace> logs <pod> --previous --since=30m`
- **Common causes:** memory leak, oversized in-memory cache, unusually large payloads, low memory limits.
- **Remediation:** restart impacted pod, reduce in-memory cache footprint, increase memory limit, ship hotfix for leak.
- **Escalation:** page SRE + service owner if OOMKills repeat or >25% of replicas affected.
- **Post-incident actions:** add heap profiling and memory saturation dashboard alerts.

## Alert: PodRestarting
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Container restart rate is >0 over the last 15 minutes for 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get pod <pod> -o jsonpath='{.status.containerStatuses[*].restartCount}'`
  - `kubectl -n <namespace> describe pod <pod>`
  - `kubectl -n <namespace> logs <pod> --previous --since=30m`
- **Common causes:** crash-loop bug, failing startup probes, OOM kill, missing secret/config.
- **Remediation:** restore missing config/secret, fix failing dependency, rollback bad release, temporarily increase startupProbe thresholds.
- **Escalation:** page owning service on-call when restart loop persists >15 minutes.
- **Post-incident actions:** add startup validation checks and preflight dependency smoke tests.

## Alert: DatabaseConnectionPoolExhausted
- **Owning team:** Data Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Active DB connections exceed 90% of configured maximum for 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> logs <pod> --since=15m | rg -i "connection|pool"`
  - `kubectl -n <namespace> exec -it <db-pod> -- psql -c "select datname,count(*) from pg_stat_activity group by 1 order by 2 desc;"`
  - `kubectl -n <namespace> top pod`
- **Common causes:** leaked client connections, traffic spike, long-running queries, low pool cap.
- **Remediation:** terminate idle/blocking sessions, raise pool size if headroom exists, deploy fix for connection leak, reduce concurrency.
- **Escalation:** page Data Platform immediately when auth or transactional APIs begin failing.
- **Post-incident actions:** add pool-usage dashboards and connection leak regression tests.

## Alert: HighRequestRate
- **Owning team:** Backend Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Namespace request rate exceeds 1000 req/s for 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get hpa`
  - `kubectl -n <namespace> logs deploy/<api-deployment> --since=10m | rg -i "429|rate limit"`
  - `kubectl -n <namespace> top pod`
- **Common causes:** legitimate product launch traffic, bot spikes, retry storm from clients, cache miss wave.
- **Remediation:** scale API and worker pools, enforce rate limits/WAF rules, warm caches, coordinate traffic shedding.
- **Escalation:** page Backend Platform if load threatens error budget or creates cascading failures.
- **Post-incident actions:** adjust autoscaling thresholds and publish traffic forecast assumptions.

## Alert: QueryFingerprintP95Regression
- **Owning team:** Data Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** A tenant-critical query fingerprint p95 latency is >125% of 7-day baseline for 15 minutes.
- **Triage commands:**
  - `kubectl -n observability port-forward svc/grafana 3000:3000`
  - `psql -c "select * from pg_stat_statements order by mean_exec_time desc limit 20;"`
  - `psql -c "explain (analyze,buffers) <query>;"`
- **Common causes:** missing index, plan regression after stats drift, larger tenant dataset, lock contention.
- **Remediation:** apply/rebuild index, run `ANALYZE`, tune query shape, mitigate lock contention, revert schema change.
- **Escalation:** page Data Platform if alert persists >30 minutes on tenant-critical workloads.
- **Post-incident actions:** pin query plan tests and update baseline after approved performance improvements.

## Alert: QueryFingerprintTotalExecTimeRegression
- **Owning team:** Data Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Total execution time for a fingerprint is >130% of baseline for 15 minutes.
- **Triage commands:**
  - `psql -c "select queryid,calls,total_exec_time from pg_stat_statements order by total_exec_time desc limit 20;"`
  - `kubectl -n <namespace> logs <pod> --since=20m | rg -i "slow query"`
  - `kubectl -n <namespace> top pod`
- **Common causes:** call volume increase, N+1 regression, cache disablement, increased contention.
- **Remediation:** restore caching, reduce request fan-out, optimize high-total-time query paths, scale DB resources if necessary.
- **Escalation:** page Data Platform + Backend Platform when total DB time consumes API latency budget.
- **Post-incident actions:** add query budget SLO review and regression guardrails in PR checks.

## Alert: QueryFingerprintCallVolumeSpike
- **Owning team:** Data Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Query call volume is >140% of baseline for 20 minutes.
- **Triage commands:**
  - `psql -c "select queryid,calls from pg_stat_statements order by calls desc limit 20;"`
  - `kubectl -n <namespace> logs deploy/<api-deployment> --since=20m | rg -i "retry|poll|loop"`
  - `kubectl -n <namespace> get hpa`
- **Common causes:** retry storm, polling bug, feature rollout increasing query frequency, cache stampede.
- **Remediation:** cap retries, increase cache TTL, ship fix for polling loop, rate-limit abusive clients.
- **Escalation:** notify Data Platform; page if spike co-occurs with p95 or error-rate alerts.
- **Post-incident actions:** implement query-per-request budget checks and add canary metrics.

## Alert: NodeNotReady
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Kubernetes node reports `Ready=false` for more than 5 minutes.
- **Triage commands:**
  - `kubectl get nodes`
  - `kubectl describe node <node>`
  - `kubectl get pods -A -o wide | rg <node>`
- **Common causes:** kubelet failure, network partition, cloud instance degradation, disk exhaustion.
- **Remediation:** cordon/drain node, restart kubelet or recycle instance, rebalance workloads.
- **Escalation:** page SRE immediately for any production node not ready >10 minutes.
- **Post-incident actions:** open cloud provider incident follow-up and tune node auto-repair policies.

## Alert: NodeDiskPressure
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Node is reporting Kubernetes `DiskPressure=true`.
- **Triage commands:**
  - `kubectl describe node <node> | rg -n "DiskPressure|imagefs|nodefs"`
  - `kubectl debug node/<node> -it --image=busybox -- chroot /host df -h`
  - `kubectl get pods -A -o wide | rg <node>`
- **Common causes:** container log growth, image layer buildup, runaway temp files, undersized root disk.
- **Remediation:** clean old images/logs, relocate workloads, expand disk, enforce log retention.
- **Escalation:** page SRE when eviction threshold is crossed or workloads are already evicting.
- **Post-incident actions:** tighten image GC and log rotation defaults.

## Alert: NodeMemoryPressure
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Node is reporting Kubernetes `MemoryPressure=true`.
- **Triage commands:**
  - `kubectl describe node <node> | rg -n "MemoryPressure|Allocated resources"`
  - `kubectl top node <node>`
  - `kubectl top pods -A --sort-by=memory | head -n 20`
- **Common causes:** oversized pods on a small node, memory leak in daemonset/workload, burst workload packing.
- **Remediation:** evict or reschedule heavy pods, right-size requests/limits, add node capacity.
- **Escalation:** page SRE if kubelet begins memory-based evictions.
- **Post-incident actions:** rebalance bin-packing strategy and enforce memory request baselines.

## Alert: DeploymentReplicasMismatch
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** Deployment desired replicas differ from available replicas for 10 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get deploy <deployment>`
  - `kubectl -n <namespace> describe deploy <deployment>`
  - `kubectl -n <namespace> get rs,pods -l app=<label>`
- **Common causes:** failing readiness probes, pending pods from insufficient resources, bad image, PDB constraints.
- **Remediation:** fix readiness issue, add capacity, rollback image, adjust PDB/surge settings.
- **Escalation:** page service owner + SRE if desired state cannot be restored in 15 minutes.
- **Post-incident actions:** improve deployment guardrails and pre-deploy smoke checks.

## Alert: PVCAlmostFull
- **Owning team:** SRE / Platform
- **Owning rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`
- **Trigger meaning:** PVC usage is above 90% capacity for at least 5 minutes.
- **Triage commands:**
  - `kubectl -n <namespace> get pvc <pvc>`
  - `kubectl -n <namespace> describe pvc <pvc>`
  - `kubectl -n <namespace> exec -it <pod> -- df -h`
- **Common causes:** log/data retention growth, compaction lag, orphaned artifacts, under-sized volume.
- **Remediation:** prune stale data, run compaction/vacuum jobs, expand PVC, move cold data to object storage.
- **Escalation:** page SRE and service owner when projected exhaustion is <24h.
- **Post-incident actions:** add storage growth forecasts and automated cleanup tasks.
