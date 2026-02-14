# Schema Governance Checklist

This checklist is the migration-governance baseline for the shared platform Supabase project.

## Academy domain decision

- **Decision:** Academy is **not** a separate Supabase project.
- **Rationale:** Academy tables (`academy_*`) are created in the same `public` schema migration set as platform tables and governed by the same RLS/migration controls.

## Table scope classification rules

Before merging any migration, classify each table as one of:

1. **Tenant-scoped**
   - Data belongs to a tenant/org boundary.
   - Must include `tenant_id` (or legacy `organization_id`) **or** enforce tenant membership-based access via approved helpers.
   - Must have RLS enabled and policy predicates aligned to the chosen tenant access model.

2. **Global reference**
   - Shared metadata/catalog/reference data with no tenant ownership.
   - Must **not** be forced to include tenant columns.
   - RLS may still be enabled for privilege hardening, but tenant-column requirement is exempt.

3. **System/internal**
   - Platform-internal operational tables (for example queues, audit internals, infra-managed state) that are not directly tenant-owned application data.
   - Classification must explicitly document why tenant isolation is not required at row level and what access control boundary applies instead (service role, private schema, etc.).

## Academy table classification

- `academy_modules` → **Global reference**
- `academy_lessons` → **Global reference**
- `academy_progress` → **Tenant-scoped**
- `academy_certifications` → **Tenant-scoped**

## Merge checklist (required)

- [ ] New/changed table is explicitly classified: tenant-scoped, global reference, or system/internal.
- [ ] Classification is recorded in the deterministic tenant-scope inventory used by CI (`infra/supabase/tests/database/tenant_scope_inventory.sql`) when table is tenant-scoped.
- [ ] Tenant-scoped tables include `tenant_id` (or approved `organization_id`) **or** document approved membership-based isolation.
- [ ] Tenant-scoped tables have RLS enabled and at least one isolation policy.
- [ ] Tenant-scoped policies enforce tenant scoping via tenant columns or approved helpers (for example `get_user_tenant_ids(auth.uid())`).
- [ ] Global reference and system/internal tables have explicit RLS review notes before merge (enabled/not enabled and why).
- [ ] `infra/supabase/tests/database/rls_enabled_tables.test.sql` passes in CI for current schema.

## Governance enforcement

Use `infra/supabase/tests/database/rls_enabled_tables.test.sql` + `infra/supabase/tests/database/tenant_scope_inventory.sql` as the enforcement baseline. They validate:

- deterministic inventory coverage for tenant-column tables,
- RLS + policy presence for every tenant-scoped table, and
- required policy predicate coverage for each tenant access model.
