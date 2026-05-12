# Layer 3 Tenant Migration Readiness Runbook

## Purpose

This runbook defines migration readiness, execution controls, and acceptance criteria for Layer 3 tenant standardization changes covering:

- `migrate_tenant_ids.py`
- `028_l3_tenant_standardization.py`
- `create_composite_tenant_indexes.py`

Use this runbook for staging and production approvals whenever a release changes Layer 3 graph tenant identity fields, constraints, or indexes.

---

## Scope and risks

### In scope

- Standardizing legacy `tenantId` usage to canonical `tenant_id`.
- Backfilling missing `tenant_id` on scoped graph entities.
- Enforcing uniqueness and query-performance indexes across all `ENTITY_TYPES`.

### Primary risks

- Partial tenant backfill (mixed `tenantId` and `tenant_id` states).
- Missing `tenant_id` causing tenant-isolation gaps.
- Constraint/index drift between staging and production.
- Runtime regressions if index creation runs during peak write traffic.

---

## Preconditions

Complete these checks before any migration execution:

1. Confirm migration SQL/Python scripts match the release SHA.
2. Confirm recent backup/snapshot exists and restore was validated.
3. Confirm maintenance window and on-call coverage are in place.
4. Confirm staging dry-run completed with artifacts attached (see Evidence section).

---

## Acceptance criteria (required)

A release is **not approved** unless all criteria below are satisfied with attached evidence.

### 1) Pre-migration inventory counts by label and tenant property state

Capture inventory counts for all scoped labels and state buckets:

- `tenant_id present`
- `tenant_id missing`
- `legacy tenantId present`
- `both tenant_id and tenantId present`

Example Cypher pattern (adapt label list for all `ENTITY_TYPES`):

```cypher
UNWIND $labels AS label
CALL {
  WITH label
  CALL apoc.cypher.run(
    'MATCH (n:`' + label + '`)
     RETURN
       count(*) AS total,
       sum(CASE WHEN n.tenant_id IS NOT NULL THEN 1 ELSE 0 END) AS tenant_id_present,
       sum(CASE WHEN n.tenant_id IS NULL THEN 1 ELSE 0 END) AS tenant_id_missing,
       sum(CASE WHEN n.tenantId IS NOT NULL THEN 1 ELSE 0 END) AS legacy_tenantId_present,
       sum(CASE WHEN n.tenant_id IS NOT NULL AND n.tenantId IS NOT NULL THEN 1 ELSE 0 END) AS both_present',
    {}
  ) YIELD value
  RETURN value.total AS total,
         value.tenant_id_present AS tenant_id_present,
         value.tenant_id_missing AS tenant_id_missing,
         value.legacy_tenantId_present AS legacy_tenantId_present,
         value.both_present AS both_present
}
RETURN label, total, tenant_id_present, tenant_id_missing, legacy_tenantId_present, both_present
ORDER BY label;
```

**Pass condition:** Inventory artifact exists and includes every scoped label.

### 2) Post-migration verification proving zero legacy `tenantId` and zero missing `tenant_id`

Run post-migration verification queries per scoped label.

Example assertions:

```cypher
// zero legacy tenantId usage
UNWIND $labels AS label
CALL apoc.cypher.run(
  'MATCH (n:`' + label + '`)
   WHERE n.tenantId IS NOT NULL
   RETURN count(*) AS c',
  {}
) YIELD value
RETURN label, value.c AS legacy_tenantId_count
ORDER BY label;
```

```cypher
// zero missing tenant_id
UNWIND $labels AS label
CALL apoc.cypher.run(
  'MATCH (n:`' + label + '`)
   WHERE n.tenant_id IS NULL
   RETURN count(*) AS c',
  {}
) YIELD value
RETURN label, value.c AS missing_tenant_id_count
ORDER BY label;
```

**Pass condition:** Every returned count is `0`.

### 3) Constraint/index existence checks for all `ENTITY_TYPES`

Verify required constraints/indexes created by `create_composite_tenant_indexes.py` and `028_l3_tenant_standardization.py` exist and are online.

Example checks:

```cypher
SHOW CONSTRAINTS
YIELD name, labelsOrTypes, properties, type, ownedIndex, entityType
RETURN name, labelsOrTypes, properties, type, ownedIndex, entityType
ORDER BY name;
```

```cypher
SHOW INDEXES
YIELD name, labelsOrTypes, properties, type, state
RETURN name, labelsOrTypes, properties, type, state
ORDER BY name;
```

**Pass condition:**

- Every expected `ENTITY_TYPE` has required tenant-scoped constraint/index entries.
- All required indexes are in `ONLINE` state.

### 4) Rollback/mitigation steps for partial outcomes

If any acceptance check fails, execute mitigation immediately:

1. Stop forward migration progression.
2. Snapshot failed query output and migration logs.
3. Re-run idempotent backfill logic for failed labels only.
4. Re-run post-migration checks.
5. If still failing, execute rollback plan:
   - Restore from pre-migration snapshot if consistency cannot be re-established quickly.
   - Or apply targeted remediation script to repair `tenant_id` and remove residual `tenantId`.
6. Block production promotion until staging rerun passes all acceptance criteria.

**Pass condition:** A documented rollback or mitigation path was executed and validated when partial outcomes occurred.

### 5) Timing/performance expectations and safe execution windows

Define and validate operational expectations:

- Run migrations in low-traffic windows only.
- Avoid peak write/load periods for composite index creation.
- Track migration stage durations and lock/contention indicators.

Recommended initial thresholds (update with environment baselines):

- `migrate_tenant_ids.py`: completes within approved migration window.
- `028_l3_tenant_standardization.py`: no sustained service degradation during apply.
- `create_composite_tenant_indexes.py`: all indexes reach `ONLINE` before promotion.

**Pass condition:** Staging and production execution timestamps and performance notes are recorded; no unresolved contention/performance alarms remain.

---

## Execution sequence

1. Run pre-migration inventory queries and archive output.
2. Execute `migrate_tenant_ids.py`.
3. Apply `028_l3_tenant_standardization.py`.
4. Execute `create_composite_tenant_indexes.py`.
5. Run post-migration verification and index/constraint checks.
6. Publish evidence artifacts for release gate review.

---

## Release process integration (required)

For deployment PRs/releases where Layer 3 tenant graph/migration scope changed, attach a required checklist artifact (conditional gate enforcement):

- `artifacts/layer3/tenant-migration-readiness-checklist.md`

The artifact must contain:

1. Link to this runbook.
2. Release SHA + environment (staging/production) + execution timestamps.
3. Pre-migration inventory query outputs.
4. Post-migration verification outputs proving:
   - `legacy_tenantId_count = 0` for all scoped labels.
   - `missing_tenant_id_count = 0` for all scoped labels.
5. Constraint/index verification outputs for all `ENTITY_TYPES`.
6. Migration logs for the three migration units.
7. Rollback/mitigation log section (or explicit `Not required`).
8. Sign-off lines for release owner + reviewer.

**Production approval gate:** staging query outputs/log evidence must be attached and reviewed before production deployment is approved.

---

## Required evidence artifacts

Attach all artifacts in deployment PR/release evidence bundle:

- Pre-migration inventory output (counts by label and tenant property state).
- Post-migration verification output (zero legacy `tenantId`, zero missing `tenant_id`).
- Constraint/index check output for all `ENTITY_TYPES`.
- Migration execution logs with timestamps and durations.
- Mitigation/rollback log if partial outcomes occurred.
- Final checklist artifact at `artifacts/layer3/tenant-migration-readiness-checklist.md`.

---

## Approval gate

Production approval is blocked unless:

- If Layer 3 tenant graph/migration scope changed: staging evidence includes all required artifacts.
- If that scope did not change: the readiness gate may mark the checklist `skipped (not applicable)` with release-diff evidence.
- All five acceptance criteria pass.
- Release owner and reviewer explicitly acknowledge this runbook in the deployment PR.
