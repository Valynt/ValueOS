# Database Migrations and Schema Snapshot

This document defines the deterministic workflow for schema snapshots and release-time drift checks.

See also: `docs/db/schema-governance-plan.md` for migration governance, hardening gates, and operational controls.

## Source of truth

All schema changes must originate from the same migration source directory:

- `infra/supabase/supabase/migrations`

Only the canonical top-level migration files in that directory are used for the baseline release plan:

1. `00000000000000_initial_release_baseline.sql`
2. `00000000000001_initial_seed_minimal.sql`

## 1) Generate `docs/db/schema_snapshot.sql` from staging/canonical DB

Use a clean database, apply migrations in deterministic order, and then dump schema-only output.

```bash
# From repo root
export MIGRATIONS_DIR="infra/supabase/supabase/migrations"
export DIRECT_DATABASE_URL="postgresql://<user>:<pass>@<host>:<port>/<db>"

# Apply deterministic migration plan (same order every run)
pnpm db:migrate

# Export canonical schema snapshot (deterministic pg_dump flags)
pg_dump "$DIRECT_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  --file docs/db/schema_snapshot.sql
```

Determinism requirements:

- Always apply migrations using the explicit plan in `scripts/migrate.sh` (no globbing).
- Always use the same migration source directory: `infra/supabase/supabase/migrations`.
- Keep snapshot generation flags consistent (`--schema-only --no-owner --no-privileges --quote-all-identifiers`).

## 2) Compare migration output to snapshot during release checks

During release validation, create a fresh database, apply the same deterministic migration plan, and compare the resulting schema dump to the committed snapshot.

```bash
# Apply migrations to a fresh release-check DB
export DIRECT_DATABASE_URL="postgresql://<user>:<pass>@<host>:<port>/<release_check_db>"
pnpm db:migrate

# Dump post-migration schema for comparison
pg_dump "$DIRECT_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  --file /tmp/release_schema.sql

# Diff against committed snapshot
diff -u docs/db/schema_snapshot.sql /tmp/release_schema.sql
```

Expected result: no schema drift (or only intentionally approved, reviewed differences).

## 3) Snapshot ownership and update timing

- **Owner:** Database maintainers / platform engineering team responsible for migration approvals.
- **When to update:** Immediately after approved schema changes are merged into `infra/supabase/supabase/migrations`.
- **Required in the same PR as schema change:**
  1. Migration SQL change(s).
  2. Regenerated `docs/db/schema_snapshot.sql`.
  3. Any relevant migration doc updates (this file).

Do not update the snapshot for unapproved or experimental SQL in deferred/archive subdirectories.
