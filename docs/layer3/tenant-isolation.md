# Layer 3 Tenant Isolation Invariant and Enforcement

## 1) Canonical invariant

The Layer 3 tenant isolation model is governed by two non-negotiable rules:

- **All tenant-scoped nodes must use `tenant_id` (snake_case).**
- **No API query path may execute without resolved tenant context.**

These rules apply to schema design, migrations, API dependencies, and Cypher query authoring.

## 2) Enforcement layers with code pointers

Tenant isolation is enforced across three layers.

### A. Schema constraints and indexes

Tenant-scoped graph entities must have constraint/index support that includes `tenant_id`:

- `value_fabric/layer3/schema/constraints.py`
- `value_fabric/layer3/schema/initializer.py`

These files are the schema-level enforcement points for ensuring tenant-qualified lookup and uniqueness behavior are materialized in the graph.

### B. Runtime guard and session behavior

Tenant context must be resolved and attached before route/service logic runs:

- `value_fabric/layer3/api/dependencies_tenant.py`
- `services/layer3-knowledge/src/api/dependencies_tenant.py`

These dependencies are responsible for rejecting unresolved tenant context and for ensuring request/session execution is tenant-scoped.

### C. Migration lineage

Tenant standardization and backfill lineage must be preserved and reviewable in:

- `services/layer3-knowledge/src/migrations/migrate_tenant_ids.py`
- `services/layer3-knowledge/src/migrations/028_l3_tenant_standardization.py`
- `services/layer3-knowledge/src/migrations/create_composite_tenant_indexes.py`

Any new migration affecting tenant-scoped data must be compatible with this lineage and maintain invariant continuity.

## 3) Query authoring rules

### Required Cypher patterns

All node lookup and mutation statements must explicitly scope by `tenant_id`.

**Lookup pattern (required):**

```cypher
MATCH (n:Entity {tenant_id: $tenant_id, id: $id})
RETURN n
```

**Scoped match with predicate (required):**

```cypher
MATCH (n:Entity)
WHERE n.tenant_id = $tenant_id
  AND n.status = $status
RETURN n
```

**Mutation pattern (required):**

```cypher
MATCH (n:Entity {tenant_id: $tenant_id, id: $id})
SET n.name = $name,
    n.updated_at = datetime()
RETURN n
```

**Create pattern (required):**

```cypher
CREATE (n:Entity {
  id: $id,
  tenant_id: $tenant_id,
  created_at: datetime(),
  updated_at: datetime()
})
RETURN n
```

### Disallowed patterns

The following are prohibited:

- **Unscoped `MATCH`** on tenant-scoped labels (for example `MATCH (n:Entity) RETURN n` without tenant predicate).
- **Implicit tenant inference** (for example deriving tenant from email/domain/path metadata without validated tenant dependency resolution).
- **Mutation by global identifier only** when entity is tenant-scoped (for example `MATCH (n:Entity {id: $id}) SET ...`).

## 4) Test requirements

Tenant isolation regressions are validated in:

- `services/layer3-knowledge/tests/test_tenant_isolation.py`
- `services/layer3-knowledge/tests/test_entities_route_tenant_scoped_regression.py`

### Minimum test cases for any new entity or route

For each new tenant-scoped entity type or API route, include at least:

1. **Positive in-tenant access:** same-tenant read/write succeeds.
2. **Cross-tenant denial:** other-tenant read/write is rejected or returns no data.
3. **Missing tenant context rejection:** request/query path fails fast when tenant context is absent.
4. **Tenant-qualified mutation safety:** update/delete operations require tenant-qualified match criteria.
5. **List/query scoping:** collection/list endpoints return only records for requesting tenant.

## 5) Operational checklist

### Steps for adding a new entity type

1. **Schema contract**
   - Add/confirm `tenant_id` property in entity model.
   - Add required constraints/indexes in `value_fabric/layer3/schema/constraints.py` and initialize via `initializer.py`.
2. **Cypher query safety**
   - Ensure all CRUD queries include explicit `tenant_id` predicates or maps.
3. **Migration impact**
   - Evaluate whether existing records require backfill/normalization.
   - Add migration(s) aligned with the existing tenant migration lineage.
4. **Route guard integration**
   - Ensure route/service path uses tenant dependency guard (`dependencies_tenant.py`) before query execution.
5. **Regression tests**
   - Add/extend tenant isolation tests for entity routes and service-level query behavior.

### Pre-production migration verification checklist (staging)

Before promoting tenant-related migrations to production:

1. Run migration in staging against production-like data volume.
2. Verify all touched tenant-scoped nodes contain non-null `tenant_id`.
3. Verify composite tenant indexes/constraints are present and healthy.
4. Execute tenant isolation regression suites:
   - `services/layer3-knowledge/tests/test_tenant_isolation.py`
   - `services/layer3-knowledge/tests/test_entities_route_tenant_scoped_regression.py`
5. Validate API behavior:
   - unresolved tenant context is rejected,
   - cross-tenant access is denied,
   - same-tenant access continues to succeed.
6. Confirm rollback procedure and data repair plan are documented for the migration set.
7. Capture staging evidence (logs/test output/index checks) in release artifacts.
