# Runbook: Governance Drift

## Symptoms

- Increases in `drift_unresolved_total` and/or `drift_denied_total`.
- Structured logs with `governance.drift.telemetry` events.

## Immediate checks

1. Query logs for `outcome=denied` and `severity=high`.
2. Break down by `actionName` and `driftType`.
3. Verify whether the issue is tenant-specific or global.

## Containment

- If caused by malformed rollout payloads, rollback deployment.
- If caused by approval workflow drift, temporarily enforce manual approval gate.
- If tenant-scoped, isolate and notify affected tenant administrators.

## Recovery validation

- `drift_denied_total` returns to baseline.
- `drift_remediated_total` rises for previously affected dimensions.
- No new governance incidents in 60 minutes.

## Post-incident

- File RCA with policy and payload examples.
- Add missing test case under `packages/backend/src/lib/__tests__/rules.test.ts` if branch was untested.
