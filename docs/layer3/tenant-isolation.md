# Layer 3 Tenant Isolation Invariant and Enforcement

## 1) Canonical invariant

The Layer 3 tenant isolation model is governed by two non-negotiable rules:

- **All tenant-scoped nodes must use `tenant_id` (snake_case).**
- **No API query path may execute without resolved tenant context.**

These invariants apply across schema design, migration lineage, runtime API dependencies, Cypher query authoring, and regression tests.

## 2) Enforcement layers with code pointers

Tenant isolation is enforced across schema, runtime, and migration layers.

### A) Schema constraints and indexes

Canonical schema-level enforcement points:

- `value_fabric/layer3/schema/constraints.py`
- `value_fabric/layer3/schema/initializer.py`

Expected responsibilities at this layer:

- Define/verify tenant-qualified uniqueness and lookup constraints.
- Ensure composite indexes for `tenant_id` + entity key(s).
- Prevent creation of tenant-scoped node patterns without `tenant_id`.

### B) Runtime guard and session behavior

Canonical runtime guard points:

- `value_fabric/layer3/api/dependencies_tenant.py`
- `services/layer3-knowledge/src/api/dependencies_tenant.py`

Expected responsibilities at this layer:

- Resolve tenant context from authenticated/session metadata before route execution.
- Reject requests with missing, invalid, or unresolved tenant context.
- Bind all downstream read/write operations to the resolved `tenant_id`.

### C) Migration lineage

Canonical migration lineage for tenant normalization and index standardization:

- `services/layer3-knowledge/src/migrations/migrate_tenant_ids.py`
- `services/layer3-knowledge/src/migrations/028_l3_tenant_standardization.py`
- `services/layer3-knowledge/src/migrations/create_composite_tenant_indexes.py`

Lineage requirements:

- Preserve backwards-compatible tenant ID normalization.
- Enforce idempotent migration behavior for repeated runs.
- Validate post-migration data consistency before traffic cutover.

## 3) Query authoring rules

### Required Cypher patterns (lookup and mutation)

All tenant-scoped queries MUST include explicit `tenant_id` predicates in `MATCH` and mutation preconditions.

```cypher
// Lookup (required)
MATCH (e:Entity {tenant_id: $tenant_id, entity_id: $entity_id})
RETURN e
```

```cypher
// Mutation (required: tenant-qualified match before update)
MATCH (e:Entity {tenant_id: $tenant_id, entity_id: $entity_id})
SET e.name = $name,
    e.updated_at = datetime()
RETURN e
```

```cypher
// Create (required: explicit tenant_id on new node)
CREATE (e:Entity {
  tenant_id: $tenant_id,
  entity_id: $entity_id,
  name: $name,
  created_at: datetime()
})
RETURN e
```

### Disallowed patterns

The following patterns are prohibited:

- Unscoped `MATCH (e:Entity {entity_id: $entity_id})` on tenant-scoped entities.
- Any mutation that identifies records without `tenant_id` in the match predicate.
- Implicit tenant inference (for example, deriving tenant from entity shape, global IDs, or unrelated relationships instead of resolved request context).
- Session/query paths that execute before tenant dependency resolution.

## 4) Test requirements

Tenant isolation regressions are validated in:

- `services/layer3-knowledge/tests/test_tenant_isolation.py`
- `services/layer3-knowledge/tests/test_entities_route_tenant_scoped_regression.py`

### Minimum test cases for any new entity or route

Any new tenant-scoped entity type or API route must include, at minimum:

1. **Positive in-tenant read path:** tenant can fetch only its own records.
2. **Positive in-tenant write path:** tenant can create/update only its own records.
3. **Cross-tenant denial:** tenant A cannot read or mutate tenant B records.
4. **Missing context rejection:** request fails when tenant context is absent/unresolved.
5. **Query scoping assertion:** executed query/match includes explicit `tenant_id` scope.

## 5) Operational checklist

### Adding a new entity type

1. **Constraint and index definition**
   - Add/extend tenant-aware constraints in `value_fabric/layer3/schema/constraints.py`.
   - Ensure initialization wiring in `value_fabric/layer3/schema/initializer.py`.
2. **Migration impact assessment**
   - Determine whether historical records need `tenant_id` backfill/normalization.
   - Update lineage migrations when required (`migrate_tenant_ids.py`, `028_l3_tenant_standardization.py`, `create_composite_tenant_indexes.py`).
3. **Route/runtime guard coverage**
   - Verify tenant dependency resolution is mandatory in both runtime dependency modules.
   - Confirm no route can run data access without resolved tenant context.
4. **Test coverage**
   - Add/update tenant isolation tests in both regression suites listed above.

### Pre-production migration verification checklist (staging)

- Run migrations in staging using production-like data shape and volume.
- Verify every tenant-scoped node has non-null, correctly normalized `tenant_id`.
- Validate composite tenant indexes exist and are used for core query paths.
- Execute regression suites for tenant isolation and entity-route scoping.
- Perform negative tests for cross-tenant read/write attempts.
- Capture migration logs, row-count deltas, and rollback readiness evidence before promotion.
