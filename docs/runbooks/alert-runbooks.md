---
title: Alert Runbooks
owner: team-platform
system: valueos-platform
ops_labels: alerting,incident-response,observability
---

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
- **Trigger meaning:** One of the canonical latency-class thresholds has been breached:
  - interactive completion p95 exceeds **200ms** for 5m;
  - orchestration acknowledgment p95 exceeds **200ms** for 5m; or
  - orchestration completion p95 exceeds the **3000ms** exception policy for 10m.
- **Triage commands:** `kubectl -n <ns> top pod <pod>`; `kubectl -n <ns> logs <pod> --since=10m | rg -n "slow|timeout|latency|orchestration"`; inspect the Grafana backend latency-class dashboard.
- **Common causes:** noisy neighbor CPU contention; DB query slowdown; provider or queue latency on orchestration routes; cold cache after deploy.
- **Remediation:** scale interactive capacity when the 200ms completion budget is breached; restore fast acknowledgment on orchestration routes; move slow synchronous work behind async/streaming boundaries when completion approaches 3000ms.
- **Escalation:** Engage **Backend Platform** and **Data Platform** if interactive completion or orchestration acknowledgment stays above 200ms for >15m, or if the 3000ms orchestration completion exception is exhausted.
- **Post-incident actions:** capture the latency-class profile; confirm route classification is still correct; add or update route-level SLO guardrails and autoscaling floors.
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

## EntitlementsDependencyOutage
- **Trigger meaning:** entitlement checks (usage/quota enforcement dependency) are failing and requests may be denied by fail-closed policy.
- **Detection signals:** elevated 503 responses with `reason_code=ENTITLEMENTS_DEPENDENCY_UNAVAILABLE`; log event `Error in usage enforcement middleware`; optional override metric `usage_enforcement_fail_open_override_total` increments with labels `{metric, tenant_id, route}`.
- **Default behavior:** `USAGE_ENFORCEMENT_FAIL_OPEN=false` (default) keeps enforcement **fail-closed** to prevent unmetered/cross-policy usage during uncertainty.
- **Emergency override (SEV-approved only):** set `USAGE_ENFORCEMENT_FAIL_OPEN=true` to temporarily permit requests while dependency is unavailable. This is a security/commercial risk and must be time-boxed.
- **Triage commands:**
  - `kubectl -n <ns> logs deploy/<backend-deploy> --since=15m | rg -n "ENTITLEMENTS_DEPENDENCY_UNAVAILABLE|usage enforcement fail-open override"`
  - `kubectl -n <ns> set env deploy/<backend-deploy> USAGE_ENFORCEMENT_FAIL_OPEN=true`
  - `kubectl -n <ns> set env deploy/<backend-deploy> USAGE_ENFORCEMENT_FAIL_OPEN=false`
- **Remediation flow:**
  1. Confirm entitlement dependency outage scope and tenant impact.
  2. If customer impact is severe and approved by Incident Commander + Revenue Platform owner, enable fail-open override.
  3. Monitor override counter by `{metric, tenant_id, route}` to quantify un-enforced traffic.
  4. Restore entitlement dependency health.
  5. Disable override immediately after recovery and verify 503 rate returns to baseline.
  6. Initiate billing/reconciliation review for traffic served during override window.
- **Escalation:** Page **Revenue Platform** + **Backend Platform** immediately. Security on-call must be notified when override is enabled.
- **Post-incident actions:** attach outage timeline, override start/end timestamps, impacted tenants/routes, and reconciliation outcome.
- **Ownership:** Revenue Platform + Backend Platform.
