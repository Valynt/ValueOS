# Runbook: Governance Drift

## Scheduled reconciliation

- Worker: `GovernanceDriftReconciliationWorker` (BullMQ queue `governance-drift-reconciliation`).
- Schedule: every `GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES` (default **15 minutes**).
- Runs independently from user-traffic request paths and continuously samples for Layer 6 drift signatures.
- Remediation mode:
  - `auto-safe`: automatically remediates safe cases (`REFRESH_PERMISSIONS`, `READ_ONLY` style state/cache refresh constraints).
  - `approval-gated`: records drift and escalates unresolved/high-risk items for explicit approval.

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

- BullMQ retry policy applies per worker defaults; repeated failures keep jobs in failed state for triage.
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


## Agent drift guard env validation (Layer 5)

- `AGENT_DRIFT_GUARD_INTERVAL_MS` must be a finite positive integer between **1000** and **3600000** milliseconds (1s to 60m).
- Default is **300000** milliseconds (5m).
- Invalid values are automatically clamped by fallback behavior to `300000`, and a structured warning is emitted:
  - event: `agent.drift_guard_config_invalid`
  - fields: `field`, `raw_value`, `fallback_value`, `min_ms`, `max_ms`, `reason`

### Operator actions

1. Search logs for `event=agent.drift_guard_config_invalid`.
2. Correct `AGENT_DRIFT_GUARD_INTERVAL_MS` in environment config to an integer in range `[1000, 3600000]`.
3. Restart backend worker/runtime if required by deployment platform.
4. Verify warnings stop and drift guard still executes on expected cadence.
