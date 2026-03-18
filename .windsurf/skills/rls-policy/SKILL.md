---
name: rls-policy
description: |
  Use when the user asks to add, fix, or audit row-level security policies,
  tenant isolation, or access control on database tables. Handles requests like
  "add RLS to this table", "fix the tenant isolation on workflow_runs", "audit
  RLS policies", "a table is leaking data across tenants", "add row-level
  security for a new table", or "check that RLS is correctly configured".
  Covers enabling RLS, writing the four standard policies using
  security.user_has_tenant_access, granting function permissions, and
  validating with pnpm run test:rls.
---

# RLS Policy

All tenant-scoped tables must have RLS enabled and four policies covering
SELECT, INSERT, UPDATE, and DELETE. The canonical authorization function is
`security.user_has_tenant_access(organization_id::text)`.

## How `security.user_has_tenant_access` works

```sql
-- Returns true when:
-- 1. The caller is authenticated (auth.uid() IS NOT NULL)
-- 2. The target_tenant_id is not null
-- 3. The caller has an active row in public.user_tenants for that tenant
security.user_has_tenant_access(target_tenant_id TEXT) RETURNS BOOLEAN
```

Both `TEXT` and `UUID` overloads exist. Always cast: `organization_id::text`.

## Workflow

### Step 1: Enable RLS

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

### Step 2: Add the four standard policies

Follow the template in [references/rls-policy-template.sql](references/rls-policy-template.sql).

Policy naming convention: `<table_name>_tenant_<operation>`.

```sql
CREATE POLICY <table_name>_tenant_select
  ON public.<table_name> FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_insert
  ON public.<table_name> FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_update
  ON public.<table_name> FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_delete
  ON public.<table_name> FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));
```

### Step 3: Verify the security schema exists

If adding policies to a new environment, confirm the `security` schema and
`user_has_tenant_access` function are present. If not, apply:
`infra/supabase/supabase/migrations/_deferred_archived/20260205000000_canonical_tenant_authorization_rls.sql`

### Step 4: Validate

```bash
pnpm run test:rls
```

All tests must pass before the migration is merged.

## Auditing existing tables

To check which tables are missing RLS or policies:

```sql
-- Tables with RLS disabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT relname FROM pg_class WHERE relrowsecurity = true
  );

-- Tables with RLS enabled but no policies
SELECT c.relname FROM pg_class c
WHERE c.relrowsecurity = true
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
  );
```

See [references/rls-audit-queries.sql](references/rls-audit-queries.sql) for the full audit query set.

## Do not proceed if

- `security.user_has_tenant_access` does not exist — apply the canonical migration first
- The table has no `organization_id` column — RLS cannot be tenant-scoped without it; add the column first
- Using `USING (true)` — this makes all rows world-readable; replace with the tenant check

## Completion report

```
Table:            public.<table_name>
RLS enabled:      yes
Policies added:   SELECT, INSERT, UPDATE, DELETE
Validation:       pnpm run test:rls  →  X passed
Unresolved:       [any open items]
```

## Anti-patterns

| Pattern | Fix |
|---|---|
| `USING (true)` | Use `security.user_has_tenant_access(organization_id::text)` |
| `FOR ALL` single policy | Split into four separate policies (SELECT/INSERT/UPDATE/DELETE) |
| `organization_id = auth.jwt() ->> 'organization_id'` | Use `security.user_has_tenant_access()` — it checks `user_tenants`, not just the JWT claim |
| RLS enabled with no policies | Add all four policies — enabled-but-no-policies blocks all access |
| Missing `WITH CHECK` on INSERT/UPDATE | `USING` alone does not restrict writes; add `WITH CHECK` |
