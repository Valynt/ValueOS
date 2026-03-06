---
title: Query Plan Baselines
owner: team-operations
review_date: 2026-06-30
status: active
---

# Query Plan Baselines (`EXPLAIN ANALYZE BUFFERS`)

Use template SQL from `infra/observability/sql/tenant_critical_explain_snapshots.sql`.

## Baseline snapshots

### 2026-03-06

#### `workflow_states` by tenant + status (latest queue view)

- fingerprint: `wf_state_by_tenant_status_started_at`
- planning: `0.41 ms`
- execution: `12.84 ms`
- shared read/hit: `read=0, hit=812`
- notes: index-only plan using `(tenant_id, status, started_at DESC, id DESC)`.

#### `agent_runs` failed list by tenant

- fingerprint: `agent_runs_by_tenant_status_created_at`
- planning: `0.37 ms`
- execution: `17.29 ms`
- shared read/hit: `read=3, hit=1194`
- notes: heap fetches elevated under burst retry traffic; monitor visibility map health.

#### `shared_artifacts` by tenant + case

- fingerprint: `shared_artifacts_by_tenant_case_created_at`
- planning: `0.28 ms`
- execution: `8.33 ms`
- shared read/hit: `read=0, hit=278`
- notes: stable index scan, low buffer pressure.

## Review checklist

- Compare current `execution` to previous baseline (`<= +25%` regression budget).
- Verify `Buffers: shared read` does not increase unexpectedly for identical parameters.
- If regression observed, check:
  - index bloat
  - stale statistics (`ANALYZE`)
  - changed row estimates from new predicates
