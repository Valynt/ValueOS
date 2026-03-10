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
