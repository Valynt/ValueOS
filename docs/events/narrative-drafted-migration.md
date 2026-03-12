# `narrative.drafted` Event Migration Notes

## What changed

The `narrative.drafted` payload now follows the same normalized envelope semantics as the other domain events:

- **Tenant identity** is represented only by envelope `tenantId`.
- Redundant payload `organization_id` has been removed from the normalized shape.
- Payload field names are normalized to camelCase:
  - `value_case_id` → `valueCaseId`
  - `defense_readiness_score` → `defenseReadinessScore`

## Compatibility window

`DomainEventSchemas` currently includes a compatibility mapping for incoming legacy payloads:

- `organization_id` is mapped to `tenantId` when `tenantId` is not present.
- `value_case_id` is mapped to `valueCaseId` when `valueCaseId` is not present.
- `defense_readiness_score` is mapped to `defenseReadinessScore` when `defenseReadinessScore` is not present.

Downstream consumers should migrate to the normalized fields immediately. Legacy fields are accepted only as a transitional read-path and should not be relied on long-term.

## Consumer migration checklist

1. Read `tenantId` for tenant isolation checks (do not read `organization_id`).
2. Read `valueCaseId` instead of `value_case_id`.
3. Read `defenseReadinessScore` instead of `defense_readiness_score`.
4. If your consumer emits or forwards this event, publish only the normalized shape.
