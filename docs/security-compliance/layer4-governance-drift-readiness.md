# Layer 4 Governance Drift Readiness Standard

> Cross-links: [Governance drift alerts](../observability/governance-drift-alerts.md), [Governance drift runbook](../operations/runbooks/governance-drift.md), [Production contract](./production-contract.md), [Architecture overview](../architecture/architecture-overview.md)

This document defines the production readiness contract for governance **Layer 4 environment controls** and adjacent drift enforcement paths in `enforceRulesDetailed()`.

> Focused extract: [Layer 4 control inventory](./layer4-control-inventory.md)

## 1) Layer 4 control inventory (enforcement + code locations)

| Control objective                   | What is enforced                                                                                                    | Enforcement location(s)                                                                                                                                | Failure mode / gate behavior                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Production approval gate            | In `prod`, actions in `PROD_APPROVAL_REQUIRED_ACTIONS` must have explicit approval entries in `workflow.approvals`, cryptographically verifiable provenance, persisted workflow-approval record match (tenant/action/resource/request/session), TTL-valid `approvedAt`, replay-resistant nonce/sequence single-use semantics, and supported contract schema (`approvalSchemaVersion: v1`). | `packages/backend/src/lib/rules.ts` (`Layer 4: Environment controls` + approval provenance validation), `packages/backend/src/lib/governance/driftPrimitives.ts`, `packages/backend/src/lib/__tests__/rules.test.ts` (contract-drift adversarial permutations) | Fail-closed deny (`DENY_MISSING_APPROVAL` or `DENY_POLICY`) whenever approval provenance/signature/replay/expiry/schema checks cannot complete or do not match persisted state.                  |
| Stage-sensitive payload invariant   | Stage-required payload fields must exist (`governanceConfig.stageRequiredFields[stage]`).                           | `packages/backend/src/lib/governance/driftPrimitives.ts`                                                                                               | Drift emitted as `CRITICAL_CONFIG_INVARIANT`; remediation is `REQUIRE_APPROVAL` in `prod`, `READ_ONLY` in non-prod; may deny if high severity. |
| RBAC/role-to-permission consistency | Actor with roles must not resolve to an empty permission set.                                                       | `packages/backend/src/lib/governance/driftPrimitives.ts`, remediation flow in `packages/backend/src/lib/rules.ts` (`tryRefreshPermissionsRemediation`) | Drift emitted as `ROLE_PERMISSION_STALENESS`; remediation attempts permission cache invalidation + refresh; fail-closed deny when unresolved.  |
| High-severity drift fail-closed     | Any high-severity detected drift blocks action execution.                                                           | `packages/backend/src/lib/rules.ts` (Layer 6 drift check + deny path)                                                                                  | Deny with `DENY_POLICY`, increment drift denied counter.                                                                                       |
| Drift telemetry integrity           | Every drift event is counted and labeled by type, severity, remediation action, stage, and action name.             | `packages/backend/src/lib/rules.ts` (`createCounter`, `emitDriftTelemetry`) and `packages/backend/src/workers/GovernanceDriftReconciliationWorker.ts`  | Missing telemetry is treated as observability defect; release readiness fails under evidence requirements below.                               |

## 2) Drift taxonomy map (type -> checks -> remediation)

The current runtime drift types are implemented as:

- `ROLE_PERMISSION_STALENESS`
- `WORKFLOW_APPROVAL_INCONSISTENCY`
- `CRITICAL_CONFIG_INVARIANT`

To operationalize the broader taxonomy used by security/compliance reviews, map categories as follows.

| Taxonomy category       | Runtime drift type(s) / signal                                            | Concrete check(s)                                                                                           | Required remediation path                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configuration drift** | `CRITICAL_CONFIG_INVARIANT`                                               | `stageRequiredFields` validation for action payloads by environment stage.                                  | Non-prod: enforce `READ_ONLY` obligation and remediate payload/config mismatch. Prod: require explicit approval (`REQUIRE_APPROVAL`) before retry. |
| **Schema drift**        | Reconciliation + migration drift signals (outside `enforceRulesDetailed`) | CI and DB governance checks (migration consistency / schema drift scripts referenced in platform controls). | Block release until migration chain is corrected and drift checks pass on clean environment; attach evidence artifact.                             |
| **Validation drift**    | `CRITICAL_CONFIG_INVARIANT`, high `drift_unresolved_total`                | Rule evaluation failures between expected and actual payload/approval preconditions.                        | Patch validation contract or producer payload, replay via safe reconciliation, confirm counters stabilize.                                         |
| **Contract drift**      | `WORKFLOW_APPROVAL_INCONSISTENCY`                                         | Prod-gated action missing matching workflow approval or workflow context ID.                                | Restore approval contract in workflow state, re-run action with explicit approval trace.                                                           |
| **Migration drift**     | Migration chain / rollback inconsistencies                                | Migration chain integrity + rollback parity checks in CI/release gates.                                     | Stop deploy, produce corrected forward + rollback SQL pair, rerun release gate evidence bundle.                                                    |
| **State drift**         | `ROLE_PERMISSION_STALENESS`, unresolved reconciliation records            | Role assignments and resolved permissions diverge at evaluation time.                                       | Run permission refresh remediation; if unresolved, deny and escalate incident with RBAC state repair.                                              |

## 3) Alerting and SLO expectations (using existing drift counters)

> Enforcement sources: `packages/backend/src/lib/rules.ts` (request-path counters) and `packages/backend/src/workers/GovernanceDriftReconciliationWorker.ts` (reconciliation counters + escalation telemetry).

### Counters (required)

- `drift_detected_total`
- `drift_remediated_total`
- `drift_unresolved_total`
- `drift_denied_total`

These are emitted in governance runtime and reconciliation worker paths.

### Alert thresholds (baseline)

Adopt and maintain thresholds from `docs/observability/governance-drift-alerts.md`:

- Critical: sustained denied-rate spike in production.
- High: sustained unresolved-rate spike in production.
- Warning: high detected rate with zero remediation.
- Info: sudden anomaly versus prior-day baseline.

### SLO expectations

- **Detection SLO:** 99% of drift events are counted in `drift_detected_total` with complete label sets.
- **Remediation SLO:** >= 95% of non-high-severity drift events are either remediated (`drift_remediated_total`) or explicitly converted to controlled obligations within 60 minutes.
- **Containment SLO:** 100% of high-severity drift events in `prod` result in deny or approval-gated containment (no silent allow).
- **Operational response SLO:** Critical drift alerts are acknowledged within 15 minutes and have incident commander assignment within 30 minutes.

## 4) Operational procedures

### Reconciliation cadence

- Run governance drift reconciliation worker continuously for asynchronous recovery opportunities (default schedule every 15 minutes).
- Perform **daily** review of unresolved drift by `driftType`, `stage`, and `actionName`.
- Perform **weekly** trend review for drift ratios (detected vs remediated vs denied) and open corrective actions for regressions.
- Perform **monthly** control-owner sign-off that drift alerts, labels, runbooks, and remediation ownership mappings are still accurate.

### Incident response

1. Triage severity from alert threshold and `stage=prod` impact.
2. Scope blast radius by tenant/action labels and workflow IDs.
3. Apply safe containment first (deny/approval gate/read-only).
4. Execute runbook steps in `docs/operations/runbooks/governance-drift.md`.
5. Document timeline, root cause, and control hardening actions.

### Safe remediation sequence

1. Reproduce with immutable audit context (`requestId`/`sessionId`, actor, tenant, action).
2. Confirm drift classification (config/schema/validation/contract/migration/state).
3. Apply least-privilege fix:
   - permission refresh,
   - approval correction,
   - payload contract correction,
   - migration repair.
4. Re-run targeted checks/tests and verify counter movement (`detected` then `remediated` or controlled `denied`).
5. Close incident only after alert clears and evidence artifacts are archived.

### Rollback guidance

- If remediation introduces policy risk, rollback to last known-good governance config / migration state.
- Never bypass Layer 4 approval gates in production as a rollback shortcut.
- Every rollback must include: reason, scope, operator, timestamp, and post-rollback verification evidence.

## 5) Production readiness evidence (mandatory)

Readiness package **must** include the following automated checks and artifacts:

| Evidence requirement                                             | Command / source                                                                                 | Expected passing output / artifact                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Governance rules unit coverage (including Layer 4 + drift cases) | `pnpm test -- packages/backend/src/lib/__tests__/rules.test.ts` (or workspace-equivalent target) | Test suite exits 0, includes passing Layer 4 + drift scenarios.                                           |
| Layer 4 contract compatibility gate                              | `pnpm run test:layer4-contract-compatibility`                                                    | Dedicated contract suite exits 0 with payload/approval/workflow compatibility assertions passing.         |
| Architecture/runtime drift gate                                  | `node scripts/ci/check-architecture-doc-drift.mjs`                                               | `Architecture drift gate: PASS` output.                                                                   |
| Release gate manifest alignment                                  | `scripts/ci/release-gate-manifest.json` + CI run artifact                                        | Evidence entry includes architecture drift gate and related remediation references.                       |
| Governance drift alert policy present                            | `docs/observability/governance-drift-alerts.md`                                                  | Documented thresholds for critical/high/warning/info with counter references.                             |
| Governance drift runbook present                                 | `docs/operations/runbooks/governance-drift.md`                                                   | Documented triage, investigation, remediation, and closure steps.                                         |
| Drift telemetry instrumentation                                  | Code inspection in `packages/backend/src/lib/rules.ts` and worker                                | Counters defined and incremented for detected/remediated/unresolved/denied outcomes with required labels. |

### Readiness assertion checklist (hard gate)

- [ ] All required evidence artifacts listed above are present **for this exact candidate revision**.
- [ ] All required automated checks are passing in CI artifacts **for this exact candidate revision**.
- [ ] No critical/high unresolved drift incidents are open for production scope.
- [ ] Alert thresholds and ownership are configured for on-call routing.
- [ ] Runbook links resolve and are actionable by on-call responders.

> **Readiness is NOT claimed unless every required evidence artifact is present and every required automated check is passing for the same candidate revision. Any missing artifact, stale artifact, skipped check, or failing check means NOT READY.**


### Automated CI readiness gate

The release workflow now enforces an automated Layer 4 evidence gate:

- Command: `node scripts/ci/check-layer4-readiness-evidence.mjs`
- Machine-readable output: single-line JSON with `{"gate":"layer4-readiness-evidence","status":"PASS"|"FAIL",...}`.
- Pipeline contract: the command must emit `"status":"PASS"`; any `"status":"FAIL"` exits non-zero and blocks promotion.


If any item is missing, stale, or failing, status is **NOT READY** and production promotion is blocked.


## Related controls

- Layer 3 workflow mutation state contract: `docs/security-compliance/layer3-workflow-state-contract.md`.
