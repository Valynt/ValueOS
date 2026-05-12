# Layer 3 Tenant Isolation Invariant and Enforcement

## 1) Canonical invariant

The Layer 3 tenant isolation model is governed by two non-negotiable rules:

- **All tenant-scoped records must use `tenant_id` (snake_case).**
- **No API query path may execute without resolved tenant context.**

These rules apply to schema design, migrations, API dependencies, and query authoring.

## 2) Enforcement layers with code pointers

Tenant isolation is enforced across three canonical layers.

### A. Schema constraints and indexes (canonical source)

Tenant-scoped table constraints/indexes are enforced in the Supabase SQL lineage:

- `infra/supabase/sql/ops/rls-tenant-isolation-fixes.sql`
- `infra/supabase/supabase/migrations/20260303000001_harden_tenant_rls_service_role_exceptions.sql`
- `infra/supabase/supabase/migrations/20260326050000_value_tree_atomic_tenant_scope.sql`

These files are the schema-level enforcement points for tenant-qualified lookup and uniqueness behavior.

### B. Runtime guard and session behavior

Tenant context is resolved and attached before route/service logic runs in backend middleware:

- `packages/backend/src/middleware/tenantContext.ts`
- `packages/backend/src/middleware/tenantDbContext.ts`
- `packages/backend/src/api/tenantContext.ts`

These modules reject unresolved tenant context and ensure request/session execution is tenant-scoped.

### C. Migration lineage

Tenant standardization and backfill lineage is preserved in:

- `infra/supabase/supabase/migrations/20260302000000_webhook_tenant_isolation.sql`
- `infra/supabase/supabase/migrations/20260304000000_tenant_provisioning_workflow.sql`
- `infra/supabase/supabase/migrations/20260326050000_value_tree_atomic_tenant_scope.sql`

Any new migration affecting tenant-scoped data must be compatible with this lineage and maintain invariant continuity.

## 3) Query authoring rules

### Required SQL patterns

All tenant-scoped lookup and mutation statements must explicitly scope by `tenant_id`.

### Disallowed patterns

The following are prohibited:

- Unscoped SELECT/UPDATE/DELETE on tenant-scoped tables.
- Implicit tenant inference from unverified metadata.
- Mutation by global identifier only when entity is tenant-scoped.

## 4) Test requirements

Tenant isolation regressions are validated in:

- `infra/supabase/tests/tenant_rls_isolation.test.sql`
- `tests/security/tenant-isolation-e2e.test.ts`

### Minimum test cases for any new tenant-scoped endpoint/table

1. Positive in-tenant access.
2. Cross-tenant denial.
3. Missing tenant context rejection.
4. Tenant-qualified mutation safety.
5. List/query scoping.

## 5) Operational checklist

### Steps for adding a new tenant-scoped entity

1. **Schema contract**
   - Add/confirm `tenant_id`.
   - Add required constraints/indexes in canonical `infra/supabase/supabase/migrations/*.sql` files.
2. **Query safety**
   - Ensure all CRUD statements include explicit `tenant_id` predicates.
3. **Migration impact**
   - Evaluate backfill/normalization needs.
   - Add migration(s) aligned with tenant migration lineage.
4. **Route guard integration**
   - Ensure route/service paths use tenant middleware before query execution.
5. **Regression tests**
   - Add/extend tenant isolation tests for API and DB behavior.
