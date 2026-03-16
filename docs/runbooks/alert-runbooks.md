# Alert Runbooks

Runbooks for Prometheus alert rules defined in:

- `infra/k8s/observability/prometheus/alert-rules.yaml`
- `infra/prometheus/alerts/resource-pressure-alerts.yml` (duplicate host-level `HighCPUUsage` and `HighMemoryUsage` variants)

## Status

| Alert | Runbook status | Owning team | Rule file(s) |
|---|---|---|---|
| HighErrorRate | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighResponseTime | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| PodDown | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighCPUUsage | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml`, `infra/prometheus/alerts/resource-pressure-alerts.yml` |
| HighMemoryUsage | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml`, `infra/prometheus/alerts/resource-pressure-alerts.yml` |
| PodRestarting | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| DatabaseConnectionPoolExhausted | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| HighRequestRate | [x] complete | Backend Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintP95Regression | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintTotalExecTimeRegression | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| QueryFingerprintCallVolumeSpike | [x] complete | Data Platform | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeNotReady | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeDiskPressure | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| NodeMemoryPressure | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| DeploymentReplicasMismatch | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |
| PVCAlmostFull | [x] complete | Platform SRE | `infra/k8s/observability/prometheus/alert-rules.yaml` |

## HighErrorRate
- **Trigger meaning:** 5xx ratio per pod exceeds 5% for 5m. Indicates user-visible failures and potential SLO burn.
- **Triage commands:** `kubectl -n <ns> get pods`; `kubectl -n <ns> logs <pod> --since=10m | rg -n "error|exception|timeout"`; `kubectl -n <ns> top pod <pod>`.
- **Common causes:** bad deploy/config rollout; upstream dependency outage; database saturation; rate-limit or auth regression.
- **Remediation:** rollback most recent release; disable offending feature flag; restart unhealthy pod only after root cause identified; mitigate downstream dependency (queue shed / cache fallback).
- **Escalation:** Page **Backend Platform** immediately if alert lasts >10m or impacts >1 namespace.
- **Post-incident actions:** add regression test for failure mode; adjust alert threshold only with SLO review; document dependency guardrails.
- **Ownership:** Backend Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## HighResponseTime
- **Trigger meaning:** API p95 latency per pod exceeds 1s for 5m.
- **Triage commands:** `kubectl -n <ns> top pod <pod>`; `kubectl -n <ns> logs <pod> --since=10m | rg -n "slow|timeout|latency"`; inspect Grafana RED dashboard.
- **Common causes:** noisy neighbor CPU contention; DB query slowdown; external API latency; cold cache after deploy.
- **Remediation:** scale deployment replicas; enable cached path / reduce expensive feature; roll back recent query or route change.
- **Escalation:** Engage **Backend Platform** and **Data Platform** if sustained >15m or if DB alerts co-fire.
- **Post-incident actions:** capture latency profile; add route-level SLO guardrail; tune autoscaling floor.
- **Ownership:** Backend Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## PodDown
- **Trigger meaning:** Pod scrape target reports `up == 0` for 2m.
- **Triage commands:** `kubectl -n <ns> get pod <pod> -o wide`; `kubectl -n <ns> describe pod <pod>`; `kubectl -n <ns> get events --sort-by=.lastTimestamp | tail -n 30`.
- **Common causes:** crash loop; image pull failure; node eviction; failing readiness/liveness probes.
- **Remediation:** fix config/secret/image; restart deployment; cordon/drain bad node when node-related.
- **Escalation:** Page **Platform SRE** if >2 pods down or a critical service has zero healthy pods.
- **Post-incident actions:** tighten health checks; add canary gate; update capacity/resilience runbooks.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## HighCPUUsage
- **Trigger meaning:** Pod or node CPU usage remains above 80% for >5–10m.
- **Triage commands:** `kubectl top pods -A | sort -k3 -nr | head`; `kubectl top nodes`; `kubectl -n <ns> describe pod <pod>`.
- **Common causes:** traffic surge; infinite retry loop; expensive query/path; undersized resource requests/limits.
- **Remediation:** scale out replicas; apply temporary traffic shaping; roll back regressed release; raise limits after confirming safe headroom.
- **Escalation:** Page **Platform SRE** when cluster node saturation appears; involve **Backend Platform** for app regression.
- **Post-incident actions:** adjust HPA targets; add perf test for offending endpoint; tune requests/limits.
- **Ownership:** Platform SRE. **Rule files:** `infra/k8s/observability/prometheus/alert-rules.yaml`, `infra/prometheus/alerts/resource-pressure-alerts.yml`.

## HighMemoryUsage
- **Trigger meaning:** Pod or node memory usage exceeds 90% for >5–10m.
- **Triage commands:** `kubectl top pods -A --containers`; `kubectl describe node <node> | rg -n "MemoryPressure|Allocated resources"`; `kubectl -n <ns> logs <pod> --previous`.
- **Common causes:** memory leak; oversized in-memory cache; OOM restart loop; undersized memory limits.
- **Remediation:** restart leaking pods to restore service; scale out; reduce cache size; patch leak and deploy fix.
- **Escalation:** Page **Platform SRE** if MemoryPressure appears or OOMKills are ongoing.
- **Post-incident actions:** add memory profiling to CI/perf; revise limits and JVM/Node heap settings.
- **Ownership:** Platform SRE. **Rule files:** `infra/k8s/observability/prometheus/alert-rules.yaml`, `infra/prometheus/alerts/resource-pressure-alerts.yml`.

## PodRestarting
- **Trigger meaning:** container restart rate >0 over 15m for 5m.
- **Triage commands:** `kubectl -n <ns> get pod <pod>`; `kubectl -n <ns> describe pod <pod>`; `kubectl -n <ns> logs <pod> --previous`.
- **Common causes:** OOMKill; bad startup config; failing dependency health checks; probe timeouts.
- **Remediation:** fix failing config/env; increase startup probe thresholds; rollback recent image.
- **Escalation:** Page **Platform SRE** when restart loops affect production traffic; page owning app team for config defects.
- **Post-incident actions:** improve startup/readiness probes; add deployment preflight checks.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## DatabaseConnectionPoolExhausted
- **Trigger meaning:** active DB connections >90% of max for 5m.
- **Triage commands:** inspect DB dashboard; `kubectl -n <ns> logs <pod> --since=10m | rg -n "connection|pool|timeout"`; run DB active session query per DBA playbook.
- **Common causes:** connection leak; sudden query fan-out; long-running transactions; pool size too small for load.
- **Remediation:** kill pathological sessions; scale API pods carefully; deploy fix for connection release; raise pool cap only with DB capacity confirmation.
- **Escalation:** Immediate **Data Platform** page; involve **Backend Platform** if application leak suspected.
- **Post-incident actions:** enforce connection timeout defaults; add pool saturation SLO and query budget review.
- **Ownership:** Data Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## HighRequestRate
- **Trigger meaning:** namespace request throughput exceeds 1000 rps for 5m.
- **Triage commands:** inspect ingress metrics; `kubectl -n <ns> get hpa`; `kubectl top pods -n <ns>`.
- **Common causes:** expected launch traffic; retry storm from clients; abusive client/token; cache miss spike.
- **Remediation:** ensure autoscaling catches up; apply rate limits/WAF rules; enable degraded but cached responses.
- **Escalation:** Notify **Backend Platform** if traffic is legitimate; page **Platform SRE** if capacity risk is imminent.
- **Post-incident actions:** update capacity model; add launch readiness checklist for traffic spikes.
- **Ownership:** Backend Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## QueryFingerprintP95Regression
- **Trigger meaning:** tenant-critical query p95 exceeds 125% of 7d baseline for 15m.
- **Triage commands:** inspect query fingerprint dashboard; run `EXPLAIN (ANALYZE, BUFFERS)` on fingerprint query in staging replica; check recent schema/index changes.
- **Common causes:** missing/unused index; planner regression after stats drift; changed filter cardinality; lock contention.
- **Remediation:** add/tune index; refresh stats/vacuum; mitigate lock contention; rollback problematic migration.
- **Escalation:** Page **Data Platform** after 15m persistence or if user-facing latencies degrade.
- **Post-incident actions:** add query plan snapshot to CI; tighten migration review checklist.
- **Ownership:** Data Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## QueryFingerprintTotalExecTimeRegression
- **Trigger meaning:** total execution time for a tenant-critical fingerprint exceeds 130% baseline for 15m.
- **Triage commands:** check top query consumers and call sites; review deployment diff; inspect lock/wait events.
- **Common causes:** increased call fan-out; N+1 regression; stale caches; broader tenant dataset scans.
- **Remediation:** ship batching/caching fix; reduce query frequency; add index or partition predicate.
- **Escalation:** Page **Data Platform** and notify **Backend Platform** when burn threatens SLO budget.
- **Post-incident actions:** add guardrails for query volume in performance tests.
- **Ownership:** Data Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## QueryFingerprintCallVolumeSpike
- **Trigger meaning:** query call volume exceeds 140% baseline for 20m.
- **Triage commands:** identify caller route/service from tracing; compare recent release traffic patterns; inspect cache hit rates.
- **Common causes:** retry loops; disabled cache; duplicate job execution; product launch/tenant onboarding burst.
- **Remediation:** cap retries, restore cache layer, pause duplicate jobs, or scale DB read capacity for expected spikes.
- **Escalation:** Notify **Data Platform** during business hours; page if paired with latency/error alerts.
- **Post-incident actions:** add anomaly detector at caller level and stronger idempotency controls.
- **Ownership:** Data Platform. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## NodeNotReady
- **Trigger meaning:** node `Ready` condition false for 5m.
- **Triage commands:** `kubectl get nodes`; `kubectl describe node <node>`; inspect cloud provider instance health.
- **Common causes:** kubelet failure; network partition; underlying VM disruption; disk full.
- **Remediation:** cordon and drain node; restart kubelet/instance; replace failed node.
- **Escalation:** Immediate **Platform SRE** page for production clusters.
- **Post-incident actions:** review node autoscaling and disruption budgets.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## NodeDiskPressure
- **Trigger meaning:** node reports `DiskPressure=true` for 5m.
- **Triage commands:** `kubectl describe node <node>`; check image/container fs usage; inspect log volume growth.
- **Common causes:** runaway logs; image garbage collection lag; large temporary files.
- **Remediation:** prune images/volumes; rotate/compress logs; expand node disk if persistent.
- **Escalation:** Page **Platform SRE** when multiple nodes affected or eviction begins.
- **Post-incident actions:** enforce log retention/limits and node disk alerts at earlier threshold.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## NodeMemoryPressure
- **Trigger meaning:** node reports `MemoryPressure=true` for 5m.
- **Triage commands:** `kubectl describe node <node>`; `kubectl top node <node>`; check top memory pods on node.
- **Common causes:** under-provisioned nodes; memory leak in high-density workloads; burst traffic.
- **Remediation:** drain node, rebalance workloads, increase node size/count, patch leaking workloads.
- **Escalation:** Page **Platform SRE** if critical workloads risk eviction.
- **Post-incident actions:** tune requests/limits and cluster autoscaler memory thresholds.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## DeploymentReplicasMismatch
- **Trigger meaning:** desired replicas differ from available replicas for 10m.
- **Triage commands:** `kubectl -n <ns> get deploy <name>`; `kubectl -n <ns> describe deploy <name>`; `kubectl -n <ns> get rs`.
- **Common causes:** failing pods/probes; image pull/auth issues; resource quota or scheduling constraints.
- **Remediation:** fix deployment config/image; resolve quota/node capacity; rollback failed rollout.
- **Escalation:** Page **Platform SRE** if mismatch affects customer-facing paths.
- **Post-incident actions:** add rollout health gates and capacity checks before deploy.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.

## PVCAlmostFull
- **Trigger meaning:** PVC usage exceeds 90% for 5m.
- **Triage commands:** `kubectl get pvc -A`; inspect workload write rates; confirm retention jobs are healthy.
- **Common causes:** retention/compaction job failure; traffic burst; unexpected large artifact uploads.
- **Remediation:** clean old data per retention policy; expand PVC/storage class; hotfix runaway writers.
- **Escalation:** Page **Platform SRE** and service owner if projected exhaustion <24h.
- **Post-incident actions:** add forecast alerting, retention tests, and storage growth dashboards.
- **Ownership:** Platform SRE. **Rule file:** `infra/k8s/observability/prometheus/alert-rules.yaml`.
