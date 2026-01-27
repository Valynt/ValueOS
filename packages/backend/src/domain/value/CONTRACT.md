# Value Domain Contract

## Canonical Tenant Key
- All backend APIs and services require `tenant_id` as the first parameter (no exceptions).

## Canonical Scope
- All domain operations are anchored to `value_case_id`.
- If starting from `opportunity_id`, resolve to `value_case_id` first.

## Concept Mapping
- **ValueTree**: Projection over `value_drivers` (scoped to `value_case_id`)
- **RoiModel**: Maps to `financial_models` (scoped to `value_case_id`)
- **ValueCommit**: Lifecycle/state machine over `value_cases` (optionally linked to opportunities)
- **KpiTarget**: Derived projection only (no writes, no table)

## ValueCommit Lifecycle States
- draft
- active
- committed
- archived

## ValueCommit Allowed Transitions
- draft → active
- active → committed
- committed → archived
- active → archived

## Constraints
- **No new tables** in this phase
- **KpiTarget** is derived only (no persistence)

## CI Guard
- PR fails if this file is missing or modified without the `domain-contract-change` review label
