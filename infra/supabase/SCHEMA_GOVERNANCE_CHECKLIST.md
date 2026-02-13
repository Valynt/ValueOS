# Schema Governance Checklist

This checklist is the migration-governance baseline for the shared platform Supabase project.

## Academy domain decision

- **Decision:** Academy is **not** a separate Supabase project.
- **Rationale:** Academy tables (`academy_*`) are created in the same `public` schema migration set as platform tables and governed by the same RLS/migration controls.

## Table scope classification rules

Before merging any migration, classify each table as one of:

1. **Tenant-scoped**
   - Data belongs to a tenant/org boundary.
   - Must include `tenant_id` (or legacy `organization_id`) and enforce RLS.

2. **Global reference**
   - Shared metadata/catalog/reference data with no tenant ownership.
   - Must **not** be forced to include tenant columns.
   - RLS may still be enabled for privilege hardening, but tenant-column requirement is exempt.

## Academy table classification

- `academy_modules` → **Global reference**
- `academy_lessons` → **Global reference**
- `academy_progress` → **Tenant-scoped**
- `academy_certifications` → **Tenant-scoped**

## Merge checklist (required)

- [ ] New/changed table is explicitly classified: tenant-scoped or global reference.
- [ ] Tenant-scoped tables include `tenant_id` (or approved `organization_id`) and appropriate FK/indexes.
- [ ] Tenant-scoped tables have RLS enabled and at least one isolation policy.
- [ ] Tenant-scoped policies enforce tenant membership using approved helpers (for example `get_user_tenant_ids(auth.uid())`).
- [ ] Global reference tables are excluded from tenant-column enforcement.
- [ ] `scripts/validate-tenant-rls.sql` passes in CI for current schema.

## Governance enforcement

Use `scripts/validate-tenant-rls.sql` as the enforcement script. It validates:

- tenant-column + RLS requirements on tenant-scoped tables, and
- tenant-column exemptions for global Academy reference tables.
