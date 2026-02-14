# Initial Release Migration Baseline

## Scope and strategy

This repository uses Supabase SQL migrations under `infra/supabase/supabase/migrations/`.
For initial release hardening, the historical pre-release chain was archived and replaced by a deterministic, explicit baseline plan.

## Phase 0 — Inventory

### Active pre-refactor migration chain (archived)

Archived to:

- `infra/supabase/supabase/migrations_archive/2026-03-pre-initial-release/`

Ordered files:

1. `20260213000001_academy_tenant_scope_rls.sql`
2. `20260213000002_baseline_schema.sql`
3. `20260213000003_research_onboarding_tenant_uuid_alignment.sql`
4. `20260213000004_tenant_uuid_canonicalization.sql`
5. `20260214000000_baseline_restructured.sql`
6. `20260214000001_user_profile_directory.sql`
7. `20260214000002_saga_infrastructure.sql`
8. `20260301000001_research_onboarding_drop_legacy_tenant_id.sql`
9. `20260302000001_auth_subject_audit_memory_lineage.sql`
10. `20260302000002_semantic_memory_namespace_filters.sql`
11. `20260302000003_evidence_tier_guardrails.sql`
12. `20260305000001_tenant_rls_hardening.sql`

### Conflicts/non-determinism found

- Multiple baseline-style migrations existed in the active path (`*_baseline_schema.sql`, `*_baseline_restructured.sql`) and relied on historical sequencing assumptions.
- Migration discovery was previously glob-based in runner scripts (`*.sql`) instead of an explicit plan.
- Pre-release tree already had archived/deferred histories that can cause ambiguity during audits.

## Phase 1 — Canonical target schema snapshot

Ground truth snapshot is committed at:

- `docs/db/schema_snapshot.sql`

The snapshot is the canonical initial-release schema artifact and is derived from the deterministic baseline plan.

## Phase 2 — New initial-release migration set

Active deterministic plan:

1. `00000000000000_initial_release_baseline.sql`
2. `00000000000001_initial_seed_minimal.sql`

Design rules enforced:

- explicit ordering by filename + script-level ordered manifest
- strict error handling (`set -euo pipefail`, `psql -v ON_ERROR_STOP=1 -X`)
- explicit `search_path` and session defaults in the baseline header
- pre-release history archived (auditability preserved)

## Phase 3 — Applying migrations

### One-command apply (generic runner)

```bash
DIRECT_DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db> pnpm db:migrate
```

### Supabase path

```bash
cd infra/supabase/supabase
npx supabase db push
```

## Phase 4 — Verification checklist

Run these after applying to an empty database.

```bash
# 1) migration records
SELECT * FROM public.schema_migrations ORDER BY applied_at;

# 2) key tables
SELECT to_regclass('public.tenants'), to_regclass('public.user_tenants'), to_regclass('public.user_profile_directory');

# 3) RLS enabled smoke-check
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('usage_policies','billing_approval_requests','academy_progress','user_profile_directory')
ORDER BY tablename;

# 4) policy presence smoke-check
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usage_policies','billing_approval_requests','academy_progress','user_profile_directory')
ORDER BY tablename, policyname;
```

### Drift check (fresh apply vs snapshot)

```bash
pg_dump --schema-only --no-owner --no-privileges "$DIRECT_DATABASE_URL" > /tmp/fresh_schema.sql
diff -u docs/db/schema_snapshot.sql /tmp/fresh_schema.sql
```

Expected: no meaningful schema diff (ignoring environment comments).

## Adding future migrations

1. Add a new file in `infra/supabase/supabase/migrations/` with a strictly increasing numeric prefix.
2. Append the filename to explicit migration plans in:
   - `scripts/migrate.sh`
   - `infra/supabase/supabase/scripts/apply_migrations.sh`
3. Re-run migration verification and refresh `docs/db/schema_snapshot.sql`.

## Risk notes

- This refactor intentionally preserves final effective schema by consolidating historical SQL into a single baseline artifact; no schema redesign was performed.
- Environments that previously relied on implicit glob discovery should now use the explicit migration plan runners.
- If your CI applies migrations using raw `supabase db push`, ensure only intended SQL files remain in the active migrations folder.
