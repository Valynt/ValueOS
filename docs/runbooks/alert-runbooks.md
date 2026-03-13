# Alert Runbooks

Runbooks for Prometheus alert rules defined in
`infra/k8s/observability/prometheus/alert-rules.yaml`.

Alert rules are not active in production until each alert below has a
documented response procedure. Update this file and remove the `[ ]` marker
when a runbook is written.

## Status

| Alert | Runbook status |
|---|---|
| HighErrorRate | [ ] pending |
| HighResponseTime | [ ] pending |
| PodDown | [ ] pending |
| HighCPUUsage | [ ] pending |
| HighMemoryUsage | [ ] pending |
| PodRestarting | [ ] pending |
| DatabaseConnectionPoolExhausted | [ ] pending |
| HighRequestRate | [ ] pending |
| QueryFingerprintP95Regression | [ ] pending |
| QueryFingerprintTotalExecTimeRegression | [ ] pending |
| QueryFingerprintCallVolumeSpike | [ ] pending |
| NodeNotReady | [ ] pending |
| NodeDiskPressure | [ ] pending |
| NodeMemoryPressure | [ ] pending |
| DeploymentReplicasMismatch | [ ] pending |
| PVCAlmostFull | [ ] pending |

## Runbook template

Each runbook should cover:

1. **What fired** — what the alert expression measures and why it matters.
2. **Immediate triage** — first commands to run to confirm the issue.
3. **Common causes** — ordered by frequency.
4. **Remediation steps** — specific actions with commands.
5. **Escalation** — when to page on-call and who owns the service.
6. **Post-incident** — what to update (runbook, alert threshold, code).

## API availability

1. Validate active burn alerts in Alertmanager (`ApiAvailabilitySLOBurnRateTooHigh` / `Warning`).
2. Confirm regional health via API probes and `http_requests_total` by status code.
3. Mitigate by draining unhealthy region, then scale API replicas in healthy region.
4. Escalate to platform + incident commander if 5xx persists > 10 minutes.

## API latency

1. Confirm whether latency is route-specific by checking histogram labels.
2. Compare p95/p99 versus deployment timestamp and rollback if correlated.
3. Shift low-priority workloads to reduce contention and protect critical paths.
4. Escalate if critical route p95 remains > 300ms after mitigation.

## Messaging and queue health

1. Confirm queue backlog, oldest message age, and delivery error labels.
2. Pause non-critical consumers and increase worker parallelism in healthy region.
3. Validate dead-letter growth and retry safety before replay.
4. Escalate if delivery failure rate stays above SLO threshold for 15 minutes.
