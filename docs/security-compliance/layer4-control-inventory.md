# Layer 4 Control Inventory (Enforcement + Code Locations)

This inventory captures the Layer 4 environment-control checks and adjacent governance drift gates enforced in backend policy evaluation.

| Control objective                   | What is enforced                                                                                                    | Enforcement location(s)                                                                                                                                | Failure mode / gate behavior                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Production approval gate            | In `prod`, actions in `PROD_APPROVAL_REQUIRED_ACTIONS` must have explicit approval entries in `workflow.approvals`. | `packages/backend/src/lib/rules.ts` (`Layer 4: Environment controls` block), `packages/backend/src/lib/governance/driftPrimitives.ts`                  | Deny with `DENY_MISSING_APPROVAL` (direct Layer 4 check) or high-severity drift denial when workflow context is inconsistent.                  |
| Stage-sensitive payload invariant   | Stage-required payload fields must exist (`governanceConfig.stageRequiredFields[stage]`).                           | `packages/backend/src/lib/governance/driftPrimitives.ts`                                                                                               | Drift emitted as `CRITICAL_CONFIG_INVARIANT`; remediation is `REQUIRE_APPROVAL` in `prod`, `READ_ONLY` in non-prod; may deny if high severity. |
| RBAC/role-to-permission consistency | Actor with roles must not resolve to an empty permission set.                                                       | `packages/backend/src/lib/governance/driftPrimitives.ts`, remediation flow in `packages/backend/src/lib/rules.ts` (`tryRefreshPermissionsRemediation`) | Drift emitted as `ROLE_PERMISSION_STALENESS`; remediation attempts permission cache invalidation + refresh; fail-closed deny when unresolved.  |
| High-severity drift fail-closed     | Any high-severity detected drift blocks action execution.                                                           | `packages/backend/src/lib/rules.ts` (Layer 6 drift check + deny path)                                                                                  | Deny with `DENY_POLICY`, increment drift denied counter.                                                                                       |
| Drift telemetry integrity           | Every drift event is counted and labeled by type, severity, remediation action, stage, and action name.             | `packages/backend/src/lib/rules.ts` (`createCounter`, `emitDriftTelemetry`) and `packages/backend/src/workers/GovernanceDriftReconciliationWorker.ts`  | Missing telemetry is treated as observability defect; release readiness fails under evidence requirements.                                     |

## Source of truth

The canonical readiness contract remains `docs/security-compliance/layer4-governance-drift-readiness.md`; this file is a focused extract for control-inventory reviews.


## Cross-links

- Readiness and operations: `docs/security-compliance/layer4-governance-drift-readiness.md`
- Alerts: `docs/observability/governance-drift-alerts.md`
- Incident runbook: `docs/operations/runbooks/governance-drift.md`
