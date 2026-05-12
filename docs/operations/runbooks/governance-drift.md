# Runbook: Governance Drift

## Scheduled reconciliation

- Worker: `GovernanceDriftReconciliationWorker` (BullMQ queue `governance-drift-reconciliation`).
- Schedule: every `GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES` (default **15 minutes**).
- Runs independently from user-traffic request paths and continuously samples for Layer 6 drift signatures.
- Producer/evaluator pattern: each interval first runs a producer pass that discovers active tenant + workflow contexts, then enqueues one evaluator job per tenant/workflow/action scope (no synthetic system actor context).
- Bounded fan-out: producer discovery is capped by `GOVERNANCE_DRIFT_RECONCILIATION_BATCH_SIZE` (default **250 tenant memberships** per schedule tick).
- Remediation mode:
  - Env var: `GOVERNANCE_DRIFT_RECONCILIATION_MODE`.
  - Default: `approval-gated` (backward-compatible fail-closed behavior).
  - Allowed values: `auto-safe` | `approval-gated`.
  - `auto-safe`: automatically remediates safe cases (`REFRESH_PERMISSIONS`, `READ_ONLY` style state/cache refresh constraints).
  - `approval-gated`: records drift and escalates unresolved/high-risk items for explicit approval.

### Changing remediation mode

1. Update `GOVERNANCE_DRIFT_RECONCILIATION_MODE` in the worker environment configuration.
2. Roll out the worker deployment so new producer jobs are enqueued with the new mode.
3. Verify via logs that `governance.drift.reconciliation` records reflect expected behavior (`remediated=true` only when mode is `auto-safe` and drift action is safe).
4. For incident containment or uncertain drift posture, explicitly set `GOVERNANCE_DRIFT_RECONCILIATION_MODE=approval-gated` and redeploy workers.

## Signals and telemetry

- Counters:
  - `governance_drift_reconciliation_detected_total`
  - `governance_drift_reconciliation_remediated_total`
  - `governance_drift_reconciliation_unresolved_total`
- Structured logs:
  - `governance.drift.reconciliation` with severity, drift type, tenant/workflow IDs when available, remediation recommendation, and escalation flag.

## Symptoms

- Increases in `drift_unresolved_total`/`drift_denied_total` or reconciliation unresolved counters.
- Structured logs with `governance.drift.telemetry` or `governance.drift.reconciliation` events.

## Immediate checks

1. Query logs for `outcome=denied` and `severity=high`.
2. Break down by `actionName` and `driftType`.
3. Verify whether the issue is tenant-specific or global.
4. Check worker health endpoint and queue lag for `governance-drift-reconciliation`.

## Failure handling

- Retry guardrails: evaluator and producer jobs use exponential backoff with jitter and bounded attempts (`GOVERNANCE_DRIFT_RECONCILIATION_MAX_RETRIES`, default **5**).
- Idempotency: evaluator job IDs are deterministic per tenant/user/action/workflow scope to prevent duplicate replay amplification during Redis outages or scheduler retries.
- Dead-letter path: exhausted jobs are forwarded to `governance-drift-reconciliation-dlq` and must emit `governance.drift.reconciliation.dead_lettered` for incident routing.
- If scheduling fails at startup, `workerMain` logs a warning and continues serving other workers; restart worker deployment after env/config correction.
- If reconciliation repeatedly escalates unresolved high-risk drift, force `approval-gated` mode and pause risky rollout actions.

## Containment

- If caused by malformed rollout payloads, rollback deployment.
- If caused by approval workflow drift, enforce manual approval gate.
- If tenant-scoped, isolate and notify affected tenant administrators.

## Recovery validation

- `drift_denied_total` and unresolved reconciliation counters return to baseline.
- remediated counters rise for previously affected dimensions.
- no new high-severity governance incidents in 60 minutes.

## Post-incident

- File RCA with policy and payload examples.
- Add/extend tests under `packages/backend/src/workers/__tests__/GovernanceDriftReconciliationWorker.test.ts` and `packages/backend/src/lib/__tests__/rules.test.ts`.


## Backlog handling

1. Inspect `governance-drift-reconciliation` waiting/active/failed counts and isolate whether producer or evaluator jobs are accumulating.
2. If producer backlog grows, temporarily reduce `GOVERNANCE_DRIFT_RECONCILIATION_BATCH_SIZE` and increase worker replicas to restore queue latency.
3. If evaluator backlog grows for one tenant, shard triage by `tenantId` and `workflowId` from structured logs; do not pause global reconciliation unless Redis/DB is unstable globally.
4. Replay DLQ jobs only after root cause is fixed (schema drift, permission table outage, Redis instability), preserving original idempotency keys.

## Incident triage checklist

- Confirm unresolved **high-severity** drift remains fail-closed (`escalatedForApproval=true`, not remediated).
- Validate tenant isolation by sampling records: every record in a run must carry the source `tenantId`; no cross-tenant workflow IDs should appear in a single job context.
- Validate permission correctness by checking the evaluated actor against current `user_roles` + `user_permissions` rows for the same tenant.
- If Redis is degraded, pause producer scheduling first, keep evaluator retries enabled, and alert platform on-call if DLQ rate exceeds normal baseline for two consecutive intervals.
