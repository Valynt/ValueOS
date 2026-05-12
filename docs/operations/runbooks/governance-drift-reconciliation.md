# Governance Drift Reconciliation Runbook

## Schedule / Cron Frequency

- Worker queue: `governance-drift-reconciliation`
- Repeat interval: every `GOVERNANCE_DRIFT_RECON_INTERVAL_MINUTES` minutes (default `15`)
- Triggered by `scheduleGovernanceDriftReconciliationJob()` in the standalone worker bootstrap.

## Failure Handling

1. BullMQ retries follow queue defaults and failed jobs are retained for 30 days.
2. Check worker logs for:
   - `governance.drift.detected`
   - `governance.drift.remediated`
   - `governance.drift.unresolved`
3. Monitor counter `governance_drift_reconciliation_events_total` with labels:
   - `status=detected|remediated|unresolved`
   - `drift_type`
   - `severity`
4. If scheduling fails at startup, worker emits `Failed to schedule governance drift reconciliation job` warning.

## Remediation Modes

- `automated`: safe remediations auto-apply (`REFRESH_PERMISSIONS`, `READ_ONLY`).
- `approval_gated`: all drift is unresolved until manual approval for high-risk actions.

## On-call Steps

1. Identify unresolved high-severity drift spikes in metrics dashboard.
2. Correlate by `tenantId` and `workflowId` from structured logs.
3. For `WORKFLOW_APPROVAL_INCONSISTENCY`, verify approval chain and workflow context.
4. For `CRITICAL_CONFIG_INVARIANT`, restore missing stage-sensitive payload fields.
5. Re-run reconciliation by enqueueing an ad-hoc job with explicit contexts.
6. If unresolved persists across 3 runs, open an incident and attach affected drift records.
