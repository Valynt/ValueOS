# Domain Event Migration Notes

## `narrative.drafted` payload normalization

`narrative.drafted` now follows the same envelope semantics as the other domain events.

### What changed

- Removed redundant tenant identity field from payload body:
  - `organization_id` ❌ removed
  - Use envelope `tenantId` ✅
- Normalized narrative-specific fields to camelCase to match domain-event conventions:
  - `value_case_id` → `valueCaseId`
  - `defense_readiness_score` → `defenseReadinessScore`

### New payload shape

```ts
{
  id: string;
  emittedAt: string;
  traceId: string;
  tenantId: string;
  actorId: string;
  valueCaseId?: string;
  defenseReadinessScore: number;
  format: string;
}
```

### Required downstream updates

Any `narrative.drafted` consumer must:

1. Read tenant identity from `tenantId` in the envelope (not `organization_id`).
2. Read `valueCaseId` and `defenseReadinessScore` instead of snake_case fields.
3. Remove assumptions that duplicate tenant identifiers are present in event payload bodies.

### Compatibility behavior

- New schema defines and requires only the normalized camelCase field names.
- Payloads that use only legacy snake_case fields fail validation because required camelCase fields are missing.
- Legacy snake_case fields that appear alongside the normalized fields are ignored/stripped by non-strict schema validation.
