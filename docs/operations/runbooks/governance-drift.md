# Runbook: Governance Drift

## Scheduled reconciliation

- Worker: `GovernanceDriftReconciliationWorker` (BullMQ queue `governance-drift-reconciliation`).
- Schedule cadence: every `GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES` (default **15 minutes**).
- Sampling modes:
  - `explicit-context`: evaluates one provided `GovernanceContext` + resolved permissions (used for direct/manual reconciliation jobs).
  - `scan`: evaluates sampled records from active tenants/workflows using cursor windows.
- Scan semantics (exact):
  - `batchSize` is clamped to `[1, GOVERNANCE_DRIFT_RECONCILIATION_MAX_BATCH_SIZE]` (default max **100**, default requested **25**).
  - Tenant window uses `cursor.tenantOffset` over active tenants.
  - Workflow window uses `cursor.workflowOffset` over candidate workflows for those tenants.
  - For each sampled workflow, reconciliation constructs a concrete `GovernanceContext` from tenant, workflow, action/step, and sampled actor.
- Remediation mode:
  - `auto-safe`: automatically remediates safe cases (`REFRESH_PERMISSIONS`, `READ_ONLY`).
  - `approval-gated`: records drift and escalates unresolved/high-risk items for explicit approval.

## Concurrency/retry/failure safeguards

- Worker concurrency: **3** jobs in parallel.
- Repeatable scheduling is idempotent via fixed `jobId=governance-drift-reconciliation-repeatable`.
- Retry policy: `attempts=3` with exponential backoff (`delay=5000ms`).
- Timeout policy: `GOVERNANCE_DRIFT_RECONCILIATION_TIMEOUT_MS` (default **30000ms**) per scheduled job execution.
- Partial failure isolation: per-sample exceptions are logged and counted, and do not fail the full batch.

## Signals and telemetry

- Existing counters (unchanged names):
  - `governance_drift_reconciliation_detected_total`
  - `governance_drift_reconciliation_remediated_total`
  - `governance_drift_reconciliation_unresolved_total`
- Added sampling counters:
  - `governance_drift_reconciliation_sampled_total{tenant_id,action_name}`
  - `governance_drift_reconciliation_sample_failures_total{tenant_id,action_name,failure_reason}`
- Structured logs:
  - `governance.drift.reconciliation` with severity, drift type, tenant/workflow IDs, action name, remediation recommendation, escalation flag.
  - `governance.drift.reconciliation.sample_failed` for isolated sample failures.

## Operational thresholds

- Investigate within 15 minutes when `governance_drift_reconciliation_unresolved_total` increases continuously for 2 consecutive cadences.
- Page on-call when high-risk unresolved drift persists for 3 cadences (45 minutes at default interval).
- Open incident when `sample_failures_total / sampled_total > 0.10` over 30 minutes.

## Recovery validation

- `governance_drift_reconciliation_unresolved_total` slope returns to baseline.
- `governance_drift_reconciliation_remediated_total` grows for impacted dimensions.
- `governance_drift_reconciliation_sample_failures_total` stabilizes below 10% failure ratio.
