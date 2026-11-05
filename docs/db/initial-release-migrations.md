# Initial Release Migration Baseline

## Scope and strategy

This repository uses Supabase SQL migrations under `infra/supabase/supabase/migrations/`.
For initial release hardening, the historical pre-release chain was archived and replaced by a deterministic, explicit baseline plan.

## Phase 0 — Inventory

### Active pre-refactor migration chain (archived)

Archived to:

- `infra/supabase/supabase/migrations/archive/pre-initial-release-2026-03/`

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

## Phase 2 — Active migration set and dependency ordering

The production schema path is every top-level `.sql` file in
`infra/supabase/supabase/migrations/`, **excluding** `*.rollback.sql`.
The fail-closed runner enumerates these files and applies them in lexical
filename order; there is no two-file allowlist or separate manifest.

The earliest migrations are:

1. `00000000000000_initial_release_baseline.sql`
2. `20260213000004_tenant_identity_prerequisites.sql` — creates
   `tenants` and `user_tenants` with RLS enabled before their first
   dependent migration
3. `20260213000005_organizations_table.sql`, followed by other
   `2026021300000*` prerequisites
4. `20260213000010_canonical_identity_baseline.sql` — installs the
   membership-aware tenant access helpers and canonical policies
5. All subsequent active timestamp-ordered migrations

**Security boundary:** Demo Auth accounts and passwords are not schema
migrations. The former `00000000000001_initial_seed_minimal.sql`
contained a fixed development login, ran before its required tables
existed, and is no longer in the active schema chain.

The migration gate executes `scripts/ci/check-active-migration-seeds.mjs`
before applying SQL and fails if a demo seed or static Auth-user
insertion is put back into the active migration directory.

## Phase 3 — Applying migrations and local development seeding

Apply the schema on a clean Supabase-equivalent PostgreSQL database with
the expected roles/extensions/Auth functions:

```bash
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<host>:<port>/<db> \
  pnpm db:migrate
```

Use `infra/supabase/supabase` with the Supabase CLI for hosted/local
Supabase-managed migration deployment; it provides the real Auth schema.

Local development demo data is **opt-in**, after a real local Supabase
Auth user has been created through the Auth API or dashboard. Do not
commit that user's password:

```bash
APP_ENV=local \
ALLOW_LOCAL_DEMO_SEED=true \
DEMO_AUTH_USER_ID=<local-auth-user-uuid> \
DATABASE_URL="$LOCAL_SUPABASE_DATABASE_URL" \
bash scripts/db/seed-local-demo.sh
```

The local-only script checks the hostname and requires an existing Auth
user, then seeds tenant/membership records without creating passwords.
Set `LOCAL_SUPABASE_DATABASE_URL` from a trusted local Supabase CLI status/configuration (never commit the URL). Production and remote database URLs are refused.

## Phase 4 — Verification checklist

Run these after applying to an empty database.

```bash
# 1) migration records
SELECT * FROM public.app_schema_migrations ORDER BY applied_at;

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

1. Add a new, uniquely named top-level `.sql` file in `infra/supabase/supabase/migrations/` with a strictly increasing numeric prefix, preserving already-applied filenames.
2. Include any required rollback and prove a clean apply plus rollback/reapply in a Supabase-equivalent environment. Never put demo user/password data in schema migrations.
3. Re-run migration integrity verification and refresh `docs/db/schema_snapshot.sql` using a verified schema dump.

## Risk notes

- This refactor intentionally preserves final effective schema by consolidating historical SQL into a single baseline artifact; no schema redesign was performed.
- Environments that previously relied on implicit glob discovery should now use the explicit migration plan runners.
- If your CI applies migrations using raw `supabase db push`, ensure only intended SQL files remain in the active migrations folder.
