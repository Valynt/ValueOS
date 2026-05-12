# Layer 4 Governance Drift Readiness Standard

> Cross-links: [Layer 4 control inventory (focused extract)](./layer4-control-inventory.md), [Governance drift alerts](../observability/governance-drift-alerts.md), [Governance drift runbook](../operations/runbooks/governance-drift.md), [Production contract](./production-contract.md), [Architecture overview](../architecture/architecture-overview.md)

This document defines the production readiness contract for governance **Layer 4 environment controls** and adjacent drift enforcement paths in `enforceRulesDetailed()`.

## 1) Layer 4 control inventory (what is enforced, where in code)

| Control objective | What is enforced | Enforcement location(s) | Failure mode / gate behavior |
| --- | --- | --- | --- |
| Production approval gate | In `prod`, actions in `PROD_APPROVAL_REQUIRED_ACTIONS` must have explicit approval entries in `workflow.approvals`. | `packages/backend/src/lib/rules.ts` (`Layer 4: Environment controls` block), `packages/backend/src/lib/governance/driftPrimitives.ts` | Deny with `DENY_MISSING_APPROVAL` (direct Layer 4 check) or high-severity drift denial when workflow context is inconsistent. |
| Stage-sensitive payload invariant | Stage-required payload fields must exist (`governanceConfig.stageRequiredFields[stage]`). | `packages/backend/src/lib/governance/driftPrimitives.ts` | Drift emitted as `CRITICAL_CONFIG_INVARIANT`; remediation is `REQUIRE_APPROVAL` in `prod`, `READ_ONLY` in non-prod; may deny if high severity. |
| RBAC/role-to-permission consistency | Actor with roles must not resolve to an empty permission set. | `packages/backend/src/lib/governance/driftPrimitives.ts`, remediation flow in `packages/backend/src/lib/rules.ts` (`tryRefreshPermissionsRemediation`) | Drift emitted as `ROLE_PERMISSION_STALENESS`; remediation attempts permission cache invalidation + refresh; fail-closed deny when unresolved. |
| Approval/workflow contract consistency | Workflow context IDs and approvals must align with the gated action contract. | `packages/backend/src/lib/governance/driftPrimitives.ts`, `packages/backend/src/lib/rules.ts` | Drift emitted as `WORKFLOW_APPROVAL_INCONSISTENCY`; action is denied or forced through approval obligation before re-run. |
| High-severity drift fail-closed | Any high-severity detected drift blocks action execution. | `packages/backend/src/lib/rules.ts` (Layer 6 drift check + deny path) | Deny with `DENY_POLICY`, increment deny counters, require incident triage if in `prod`. |
| Drift telemetry integrity | Every drift event is counted and labeled by type, severity, remediation action, stage, and action name. | `packages/backend/src/lib/rules.ts` (`createCounter`, `emitDriftTelemetry`), `packages/backend/src/workers/GovernanceDriftReconciliationWorker.ts` | Missing telemetry is treated as observability evidence failure; readiness is blocked until instrumentation is restored and verified. |

## 2) Drift taxonomy map (config/schema/validation/contract/migration/state)

The runtime drift types currently emitted by policy evaluation are:

- `ROLE_PERMISSION_STALENESS`
- `WORKFLOW_APPROVAL_INCONSISTENCY`
- `CRITICAL_CONFIG_INVARIANT`

The operational taxonomy below maps broader audit categories to concrete checks and remediation.

| Taxonomy category | Runtime drift type(s) / signal | Concrete check(s) | Required remediation |
| --- | --- | --- | --- |
| **Configuration drift** | `CRITICAL_CONFIG_INVARIANT` | Validate `stageRequiredFields` for each `stage` against incoming action payload shape. | Non-prod: enforce `READ_ONLY` obligation and fix payload/config mismatch. Prod: require `REQUIRE_APPROVAL` and attach approver evidence before retry. |
| **Schema drift** | Reconciliation findings + schema-drift CI failures | Run schema/migration consistency checks in CI and drift reconciliation reports for missing/extra expected fields. | Block release, repair schema definitions or migrations, rerun checks, archive passing artifacts. |
| **Validation drift** | `CRITICAL_CONFIG_INVARIANT`, sustained `drift_unresolved_total` | Compare expected validation preconditions (required fields, policy predicates) with observed request/workflow data. | Patch validation contract or producer payload, run targeted regression tests, reconcile backlogged unresolved entries. |
| **Contract drift** | `WORKFLOW_APPROVAL_INCONSISTENCY` | Verify action contract requires approval and workflow state includes matching approval object + context ID linkage. | Repair workflow approval state, rerun action via approved path, verify deny/detected counters normalize. |
| **Migration drift** | Migration/rollback parity failures | Check migration chain continuity and required rollback pair presence in release gates. | Stop promotion, add/fix forward and rollback SQL, rerun release gates with evidence bundle. |
| **State drift** | `ROLE_PERMISSION_STALENESS`, unresolved reconciliation records | Compare actor role assignment state with resolved permission cache at evaluation time. | Execute permission refresh remediation, invalidate stale caches, escalate RBAC repair if unresolved. |

## 3) Alerting + SLO expectations (using existing drift counters)

### Required counters

- `drift_detected_total`
- `drift_remediated_total`
- `drift_unresolved_total`
- `drift_denied_total`

These counters are emitted in governance policy evaluation and reconciliation worker paths.

### Alert expectations

Baseline thresholds and paging behavior are defined in `docs/observability/governance-drift-alerts.md` and must remain aligned to these conditions:

- **Critical**: sustained denied-rate spike in production (`drift_denied_total` growth beyond policy threshold).
- **High**: sustained unresolved-rate spike in production (`drift_unresolved_total` growth with inadequate remediation).
- **Warning**: elevated detection with no remediation progress (`drift_detected_total` rising while `drift_remediated_total` is flat).
- **Info**: statistically significant anomaly versus baseline day/week.

### SLO expectations

- **Detection SLO:** 99% of drift events are counted in `drift_detected_total` with complete labels (`driftType`, `severity`, `stage`, `actionName`, `remediationAction`).
- **Remediation SLO:** >=95% of non-high-severity drift events transition to `drift_remediated_total` or explicit controlled obligation within 60 minutes.
- **Containment SLO:** 100% of high-severity drift events in `prod` are denied or approval-gated (no silent allow path).
- **Operational response SLO:** critical drift alerts acknowledged within 15 minutes and incident commander assigned within 30 minutes.

## 4) Operational procedures

### Reconciliation cadence

- Continuous: run governance drift reconciliation worker for asynchronous recovery.
- Daily: review unresolved drift by `driftType`, `stage`, `actionName`, and tenant scope.
- Weekly: review trends for detected/remediated/denied ratios; open corrective actions for regressions.

### Incident response

1. Triage severity and confirm whether `stage=prod` is affected.
2. Scope blast radius by tenant, action, workflow ID, and drift taxonomy category.
3. Apply safe containment first (`DENY`, `REQUIRE_APPROVAL`, or `READ_ONLY` depending on severity and environment).
4. Execute `docs/operations/runbooks/governance-drift.md` procedure.
5. Record timeline, root cause, remediation, and prevention actions in incident evidence.

### Safe remediation procedure

1. Reproduce with immutable audit context (`requestId`, `sessionId`, actor ID, tenant ID, action).
2. Confirm drift taxonomy category and runtime drift type.
3. Apply least-privilege fix (permission refresh, approval repair, validation/payload correction, migration correction).
4. Re-run targeted automated checks and verify expected counter movement.
5. Close only after alerts clear and evidence artifacts are archived.

### Rollback guidance

- Roll back to last known-good governance config or migration state if remediation introduces policy risk.
- Never bypass Layer 4 approval controls in production as a rollback shortcut.
- Every rollback record must include reason, scope, operator, timestamp, and post-rollback verification evidence.

## 5) Production readiness evidence (mandatory checks + artifacts)

Readiness package **must** include all required automated checks and generated artifacts below.

| Evidence requirement | Command / source | Expected passing output / artifact |
| --- | --- | --- |
| Governance Layer 4 and drift unit tests | `pnpm test -- packages/backend/src/lib/__tests__/rules.test.ts` (or equivalent workspace test target) | Exit code 0 with passing Layer 4 approval, config invariant, and drift denial/remediation scenarios. |
| Architecture/runtime drift gate | `node scripts/ci/check-architecture-doc-drift.mjs` | `Architecture drift gate: PASS` in console/CI logs. |
| Release gate manifest inclusion | `scripts/ci/release-gate-manifest.json` + CI artifact | Manifest includes architecture drift and related governance drift gate references for the release candidate. |
| Governance drift alert policy | `docs/observability/governance-drift-alerts.md` | Thresholds documented for critical/high/warning/info using required counters. |
| Governance drift runbook | `docs/operations/runbooks/governance-drift.md` | Actionable triage/investigation/remediation/closure steps for on-call responders. |
| Drift telemetry instrumentation evidence | `packages/backend/src/lib/rules.ts`, `packages/backend/src/workers/GovernanceDriftReconciliationWorker.ts` | Instrumentation present for detected/remediated/unresolved/denied counters with required labels. |

### Readiness assertion checklist (hard gate)

- [ ] Required evidence artifacts are present for the candidate revision.
- [ ] Required automated checks are present and passing in CI artifacts.
- [ ] No open critical/high unresolved production drift incidents remain.
- [ ] Alert thresholds and ownership are configured and routed to on-call.
- [ ] Runbook links resolve and are executable without tribal knowledge.

> **Production readiness is NOT claimed unless every required evidence artifact is present and every required automated check is passing.**

If any required evidence is missing, stale, or failing, the candidate is **NOT READY** and production promotion is blocked.
