# Layer 3 Tenant Isolation Standard

## 1) Canonical invariant

The following invariant is mandatory for all Layer 3 data-model, API, and migration work:

- All tenant-scoped nodes must use `tenant_id` (snake_case).
- No API query path may execute without resolved tenant context.

## 2) Enforcement layers and code pointers

Tenant isolation is enforced in three distinct layers. Any implementation or review must check all three.

### A. Schema constraints and indexes

Apply and validate schema-level guarantees in:

- `value_fabric/layer3/schema/constraints.py`
- `value_fabric/layer3/schema/initializer.py`

Expectations:

- Tenant-scoped labels/entities have explicit tenant key constraints based on `tenant_id`.
- Composite indexes include `tenant_id` for hot lookup paths.
- Initializer flows are idempotent and preserve tenant constraint/index guarantees across re-runs.

### B. Runtime guard and session behavior

Apply and validate request-time tenant resolution and enforcement in:

- `value_fabric/layer3/api/dependencies_tenant.py`
- `services/layer3-knowledge/src/api/dependencies_tenant.py`

Expectations:

- Request/session dependency resolution must fail closed when tenant context is absent.
- Tenant context must be propagated to all downstream query builders/services.
- Guard behavior must prevent fallback to global/unscoped queries.

### C. Migration lineage and compatibility

Apply and validate tenant standardization lineage in:

- `services/layer3-knowledge/src/migrations/migrate_tenant_ids.py`
- `services/layer3-knowledge/src/migrations/028_l3_tenant_standardization.py`
- `services/layer3-knowledge/src/migrations/create_composite_tenant_indexes.py`

Expectations:

- Historical tenant key variants are normalized to `tenant_id`.
- Migration ordering preserves forward-only, replay-safe semantics.
- Post-migration indexes preserve lookup performance under tenant scoping.

## 3) Query authoring rules

All Cypher authored for Layer 3 must enforce explicit tenant scoping.

### Required patterns

Use these patterns (or stricter equivalents) for all tenant-scoped operations.

#### Node lookup (read)

```cypher
MATCH (n:Entity {tenant_id: $tenant_id, id: $id})
RETURN n
```

Or:

```cypher
MATCH (n:Entity)
WHERE n.tenant_id = $tenant_id AND n.id = $id
RETURN n
```

#### Mutation (create/update/delete)

```cypher
CREATE (n:Entity {
  tenant_id: $tenant_id,
  id: $id,
  ...
})
```

```cypher
MATCH (n:Entity {tenant_id: $tenant_id, id: $id})
SET n += $patch
RETURN n
```

```cypher
MATCH (n:Entity {tenant_id: $tenant_id, id: $id})
DELETE n
```

#### Relationship traversal

```cypher
MATCH (a:EntityA {tenant_id: $tenant_id, id: $a_id})-[r:REL]->(b:EntityB {tenant_id: $tenant_id})
RETURN a, r, b
```

### Disallowed patterns

The following patterns are prohibited:

- Unscoped `MATCH` on tenant-scoped labels (for example: `MATCH (n:Entity)` without `tenant_id` predicate).
- Implicit tenant inference from user/account/session metadata without explicit query predicate.
- Queries that rely on application-layer filtering after unscoped graph reads.
- Mixed key usage (`tenantId`, `org_id`, etc.) in place of canonical `tenant_id`.

## 4) Test requirements

Tenant isolation regressions are covered in:

- `services/layer3-knowledge/tests/test_tenant_isolation.py`
- `services/layer3-knowledge/tests/test_entities_route_tenant_scoped_regression.py`

### Minimum required tests for any new entity or route

For each new tenant-scoped entity type or route, add tests that cover at minimum:

1. **Positive scoped access**: tenant can read/write its own records with `tenant_id`.
2. **Cross-tenant denial**: tenant A cannot read/write/delete tenant B records.
3. **Missing context rejection**: request/query fails when tenant context is absent.
4. **No unscoped query path**: route-level regression check that generated query includes `tenant_id`.
5. **Migration compatibility** (if applicable): legacy records are correctly normalized and remain isolated.

## 5) Operational checklist

Use this checklist for design reviews, implementation, and pre-release verification.

### A. Adding a new entity type

1. Add/verify schema constraint(s) for entity + `tenant_id` uniqueness/safety as required.
2. Add/verify tenant-aware index strategy (single or composite, based on access paths).
3. Assess migration impact:
   - backfill existing rows/nodes,
   - normalize legacy tenant key names,
   - preserve rollback/forward compatibility.
4. Enforce route/service guard:
   - resolve tenant context at boundary,
   - fail closed when unresolved,
   - pass `tenant_id` into every query.
5. Add regression tests:
   - scoped success,
   - cross-tenant denial,
   - missing-tenant rejection,
   - query scoping assertion.

### B. Pre-production migration verification (staging)

1. Run migration chain in staging with production-like dataset shape.
2. Verify all tenant-scoped nodes now contain canonical `tenant_id`.
3. Validate expected constraints and composite indexes exist and are online.
4. Execute tenant isolation test suite and confirm pass.
5. Run smoke tests on tenant-scoped routes for:
   - happy path,
   - cross-tenant access attempts,
   - missing-tenant requests.
6. Capture verification artifacts:
   - migration logs,
   - constraint/index inspection output,
   - test run output,
   - sign-off record before production promotion.
