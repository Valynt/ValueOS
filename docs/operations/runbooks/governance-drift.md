# Runbook: Governance Drift

## Scheduled reconciliation

- Worker: `GovernanceDriftReconciliationWorker` (BullMQ queue `governance-drift-reconciliation`).
- Schedule: every `GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES` (default **15 minutes**).
- Runs independently from user-traffic request paths and continuously samples for Layer 6 drift signatures.
- Producer/evaluator pattern: each interval first runs a producer pass that discovers active tenant + workflow contexts, then enqueues one evaluator job per tenant/workflow/action scope (no synthetic system actor context).
- Bounded fan-out: producer discovery is capped by `GOVERNANCE_DRIFT_RECONCILIATION_BATCH_SIZE` (default **250 tenant memberships** per schedule tick).
- Remediation mode:
  - `auto-safe`: automatically remediates safe cases (`REFRESH_PERMISSIONS`, `READ_ONLY` style state/cache refresh constraints).
  - `approval-gated`: records drift and escalates unresolved/high-risk items for explicit approval.

## Layer 6 drift environment contract

Set the following variables using plain non-empty strings (no surrounding quotes, no whitespace-only values):

- `GOVERNANCE_SCHEMA_HASH_EXPECTED` — canonical schema manifest hash expected at runtime (example: `sha256:8d90...`).
- `APP_MIGRATION_HEAD` — expected backend migration head identifier (example: `20260512000100_layer6_drift`).
- `REQUIRED_PAYLOAD_CONTRACT_VERSION` — required governance payload contract version (example: `2.4.0`).

Stage strictness:

- `prod`: all three variables are **required**; startup validation fails when any is missing/empty/malformed.
- `dev` / `staging`: optional; when omitted, drift checks for that dimension are skipped.

Rollout order (must be followed):

1. Set `REQUIRED_PAYLOAD_CONTRACT_VERSION` in all environments first, then deploy producers that emit `contract_version`.
2. Set `APP_MIGRATION_HEAD` after migration pipeline confirms the new head in the target stage.
3. Set `GOVERNANCE_SCHEMA_HASH_EXPECTED` last, after schema artifact publication and hash verification.
4. Promote the same three values from `staging` to `prod` in one release window; do not mix versions across stages.

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


## Agent drift guard env range (operations)

For hardening runtime checks in `AgentDriftGuard`, configure:

- `AGENT_DRIFT_GUARD_INTERVAL_MS`: integer milliseconds in **[1000, 3600000]**.
  - Default: `300000` (5 minutes).
  - Invalid examples (fallback + warning): empty string, non-numeric, float, `<1000`, `>3600000`, `Infinity`.
  - Invalid values emit structured warning log `agent.drift_guard.invalid_interval_ms` with:
    - `env_var`, `raw_value`, `default_value`, `min_value`, `max_value`.

Operator action on warnings:

1. Locate the deployment source of the bad env override.
2. Correct value into the valid integer range.
3. Redeploy/restart worker or service and verify warning stops appearing.
