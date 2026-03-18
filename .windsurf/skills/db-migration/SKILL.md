---
name: db-migration
description: |
  Use when the user wants to add or change database tables, columns, indexes,
  or row-level security policies. Handles requests like "add a billing events
  table", "add a status column to workflow_runs", "create a tenant-scoped
  table", "update RLS on value_cases", or "add an index to hypothesis_outputs".
  Covers migration file creation, RLS policy scaffolding, tenant isolation
  checks, TypeScript type updates, rollback file, and validation.
---

# Database Migration

Migrations live in `infra/supabase/supabase/migrations/`.
Rollbacks live in `infra/supabase/rollbacks/`.

## Workflow

### Step 1: Name the migration file

Format: `YYYYMMDDHHMMSS_<snake_case_description>.sql`

Use the current UTC timestamp. Example:
```
20260320000000_add_status_to_workflow_runs.sql
```

### Step 2: Write the migration

Follow the template in [references/migration-template.sql](references/migration-template.sql).

Rules:
- `SET search_path = public, pg_temp;` at the top — always
- Use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
- Every table MUST have `organization_id uuid NOT NULL`
- Every table MUST have `created_at timestamptz NOT NULL DEFAULT now()`
- Enable RLS immediately after table creation: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Create all four RLS policies (SELECT, INSERT, UPDATE, DELETE) using `security.user_has_tenant_access(organization_id::text)`
- Add indexes on `(organization_id)` and any foreign keys or frequent filter columns

### Step 3: Write the rollback file

File: `infra/supabase/rollbacks/<timestamp>_<description>_rollback.sql`

The rollback must undo every change in the migration in reverse order. See [references/rollback-template.sql](references/rollback-template.sql).

### Step 4: Update TypeScript types

If the migration adds a new table, add its row type to the relevant service or create a new type file in `packages/backend/src/types/`.

If the migration adds columns to an existing table, update the corresponding Zod schema and TypeScript interface.

### Step 5: Verify

```bash
pnpm run db:migrate
pnpm run test:rls
pnpm run lint
```

## Do not proceed if

- The table has no `organization_id` column — tenant isolation is broken
- RLS is not enabled on the table — all rows are world-readable
- The rollback file is missing — the migration cannot be safely deployed
- `security.user_has_tenant_access` does not exist in the target environment — verify before using

## Completion report

```
Migration file:   infra/supabase/supabase/migrations/<timestamp>_<name>.sql
Rollback file:    infra/supabase/rollbacks/<timestamp>_<name>_rollback.sql
Types updated:    packages/backend/src/types/<file>.ts  (or "none")
Commands run:     pnpm run db:migrate  →  ok
                  pnpm run test:rls    →  X passed
                  pnpm run lint        →  no errors
Unresolved:       [any open items]
```

## Anti-patterns

| Pattern | Fix |
|---|---|
| Table without `organization_id` | Add `organization_id uuid NOT NULL` |
| RLS enabled but no policies | Add all four policies (SELECT/INSERT/UPDATE/DELETE) |
| `USING (true)` in RLS policy | Use `security.user_has_tenant_access(organization_id::text)` |
| No rollback file | Write it before merging |
| `DROP TABLE` without `IF EXISTS` | Always use `IF EXISTS` |
| Missing index on `organization_id` | Add `CREATE INDEX IF NOT EXISTS idx_<table>_org_id ON <table> (organization_id)` |
