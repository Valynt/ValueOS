# Layer 3 Workflow-State Contract

Layer 3 governance validation enforces fail-closed workflow mutation checks for production mutating actions:

- `proposal.publish`
- `value_model.finalize`
- `commitment.publish`

## Shared state-loading contract

All Layer 3 validators use a tenant-scoped state loader against `value_cases` with:
- `id = action.target.resourceId`
- `tenant_id = actor.tenantId`

The loader retrieves `workflow_state`, `integrity_status`, `approval_status`, `evidence_count`, and `required_evidence_count`.

## Per-action preconditions

- `proposal.publish`
  - requires target `resourceId`
  - requires `integrity_status = passed`
  - requires `evidence_count >= required_evidence_count`
  - denies with `DENY_INVALID_STATE` or `DENY_MISSING_APPROVAL`

- `value_model.finalize`
  - requires target `resourceId`
  - requires `workflow_state = draft`
  - requires `evidence_count >= required_evidence_count`
  - denies with `DENY_INVALID_STATE` or `DENY_MISSING_APPROVAL`

- `commitment.publish`
  - requires target `resourceId`
  - requires `workflow_state = approved`
  - requires `integrity_status = passed` and `approval_status = approved`
  - denies with `DENY_INVALID_STATE` or `DENY_MISSING_APPROVAL`

## Fail-closed behavior

Any missing state, stale/invalid state, missing target, or tenant mismatch denies mutation. `proposal.publish` reason-code behavior remains backward compatible.
