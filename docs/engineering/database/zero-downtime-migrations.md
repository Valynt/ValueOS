# Zero-Downtime Migrations: Expand/Contract, Backfills, and Rollbacks

This guide defines a safe, repeatable strategy for schema changes that must ship without downtime. It focuses on **expand/contract** migrations, large-table backfills, concurrent index creation, and rollback-safe releases.

---

## 🔁 Standard Developer Workflow

Use the Supabase CLI to generate, apply, and reset migrations in local development:

- `supabase db diff --file <name>`: generate a new migration from schema changes.
- `supabase db push`: apply pending migrations.
- `supabase db reset`: reset to a clean local database state.

When a migration has a rollback path, include a matching rollback file under
`supabase/migrations/rollback/` and ensure it is validated alongside the forward migration.
If a rollback is unsafe (destructive change), document the forward-fix approach and sequencing
in the release plan before deploying.

---

## ✅ Strategy Overview

### 1) Expand/Contract Pattern
Use a multi-release approach to preserve backwards compatibility:

1. **Expand**: Add new columns, tables, or indexes in a backward-compatible way.
2. **Backfill**: Populate new data asynchronously (safe for large tables).
3. **Dual-Write**: Application writes to both old and new structures.
4. **Read Switch**: Application reads from new structures once data is consistent.
5. **Contract**: Remove old columns/paths only after full rollout + verification.

> **Rule:** Each migration must be safe to apply while both old and new app versions are running.

### 2) Backfill Strategy for Large Tables
For large tables (millions of rows), avoid single-statement updates:

- **Chunked updates** (e.g., 5k–50k rows per batch).
- **Idempotent** scripts (track last ID or use a backfill marker).
- **Background job** or controlled maintenance window for heavy workloads.
- **Verify progress** with counts and checksums.

### 3) Concurrent Index Creation
Use `CREATE INDEX CONCURRENTLY` to avoid blocking writes (Postgres):

- Must be run **outside of a transaction block**.
- Use with caution in Supabase migration scripts (split into separate files if needed).
- Prefer `CONCURRENTLY` for large tables and high-write traffic.
- Always verify index creation success with `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_name'` and check for invalid indexes with `SELECT * FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid WHERE i.indisvalid = false;`

### 4) Safe Rollbacks (Forward-Only Where Needed)
Not all migrations can be safely rolled back (e.g., destructive or data-loss changes). Treat them as **forward-only**:

- Create **forward-fix migrations** instead of rolling back destructive changes.
- Keep **rollback files** for non-destructive expansions and small changes.
- Record irreversible steps in release notes and runbooks.

### 5) Migration Testing in CI
Every migration PR should run:

- Syntax validation
- Apply all migrations to a fresh DB
- Verify rollback where applicable
- Migration safety checks

Use existing scripts:

```bash
pnpm run migration:validate
pnpm run migration:safety
```

---

## Example Migration Sequence for: "Add a required `billing_status` column to `organizations`"

**Goal**: Add a required `billing_status` column (enum-like text) to a large `organizations` table without downtime.

### Phase 1 — Expand (Schema Only)
**Migration 1**: Add nullable column + default

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orgs_billing_status
  ON public.organizations (billing_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orgs_billing_status
  ON public.organizations (billing_status);
```

**App change**: Start writing `billing_status` on new or updated records.

### Phase 2 — Backfill (Data Migration)
**Backfill job** (outside migration):

-- Example chunked backfill pattern
UPDATE public.organizations
SET billing_status = 'active'
WHERE billing_status IS NULL
  AND id IN (
    SELECT id
    FROM public.organizations
    WHERE billing_status IS NULL
    ORDER BY id
    LIMIT 10000
  )
  AND (last_retry_timestamp IS NULL OR last_retry_timestamp < NOW() - INTERVAL '1 hour');

-- Track problematic rows after several retries
INSERT INTO migration_issues (table_name, record_id, issue, created_at)
SELECT 'organizations', id, 'Failed to set billing_status', NOW()
FROM public.organizations
WHERE billing_status IS NULL AND retry_count >= 3;

Run repeatedly until `billing_status IS NULL` is 0. Track progress in logs.

### Phase 3 — Read Switch + Validate
**App change**: Read `billing_status` for all logic.

Validation queries:

```sql
SELECT COUNT(*) FROM public.organizations WHERE billing_status IS NULL;
SELECT billing_status, COUNT(*) FROM public.organizations GROUP BY billing_status;
```

### Phase 4 — Contract (Enforce + Cleanup)
**Migration 2**: Add NOT NULL constraint and remove old logic

```sql
ALTER TABLE public.organizations
  ALTER COLUMN billing_status SET NOT NULL;
```

**Optional**: Remove obsolete columns/flags once fully rolled out.

---

## Release Readiness Checklist

### ✅ Pre-Release
- [ ] Migration reviewed for expand/contract safety
- [ ] Backfill plan defined (batch size, runtime, monitoring)
- [ ] Index creation uses `CONCURRENTLY` where applicable
- [ ] Rollback plan documented (or forward-fix marked as required)
- [ ] Migration scripts validated: `pnpm run migration:validate`
- [ ] Migration safety checks pass: `pnpm run migration:safety`
- [ ] Staging run completed with verification queries

### ✅ Release
- [ ] Apply expand migration first
- [ ] Deploy app with dual-write support
- [ ] Run backfill job and monitor lag
- [ ] Switch reads to new column once data is complete

### ✅ Post-Release
- [ ] Apply contract migration (NOT NULL / drop old column)
- [ ] Confirm performance metrics (index usage, query latency)
- [ ] Remove legacy code paths
- [ ] Document change + update runbooks

---

## Notes

- Always prefer **small, composable migrations** over large, complex changes.
- Treat data migrations as production code: observable, retryable, and idempotent.
- When in doubt, release in **multiple deploys** with feature flags.
