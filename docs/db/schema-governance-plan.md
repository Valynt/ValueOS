# Schema, Migrations, DB Ops, and Hardening Plan

## 1) Inventory and baseline

### Canonical migration sources

- Canonical local migration directory: `infra/supabase/supabase/migrations/`.
- Historical-only directories (not release canonical):
  - `infra/supabase/supabase/migrations/archive/`
  - `infra/supabase/supabase/migrations/_deferred/`
  - `infra/supabase/supabase/migrations/archive/deferred-superseded/`
  - `infra/supabase/supabase/migrations/archive/monolith-20260213/`

### Naming/versioning baseline

The operational baseline is **14-digit migration timestamps** in the format `YYYYMMDDHHMMSS_description.sql`.

- `infra/supabase/ISSUE_RESOLVED.md` captures the ghost-migration incident caused by an 8-digit version and documents the expected 14-digit format.
- `infra/supabase/MIGRATION_FIX.md` also codifies the 14-digit naming expectation for all migrations.

### Supabase environment config baseline

`infra/supabase/config.toml` is the local Supabase stack configuration source and should remain environment-neutral for local development. Deploy-time production/staging controls should continue to come from linked hosted Supabase projects and CI/CD environment variables.

---

## 2) Schema governance policy

1. **Migrations are the schema source of truth.**
   - All schema changes must be delivered via migration files in `infra/supabase/supabase/migrations/`.
   - No ad-hoc production DDL outside reviewed migration PRs.

2. **Schema docs move with migrations.**
   - Update `docs/db/migrations.md` and `docs/db/schema_snapshot.sql` in the same PR as schema changes.
   - Any material policy/security change should update `infra/supabase/SECURITY_HARDENING.md`.

3. **Review gate for every migration PR.**
   - Use the checklist in Section 10.

---

## 3) Standard migration workflow and safety

### Developer workflow

1. Generate migration diff:

   ```bash
   task db:diff -- <name>
   ```

2. Apply migrations:

   ```bash
   task db:migrate
   ```

3. Validate from clean local state:

   ```bash
   task db:reset
   ```

If `task` aliases are unavailable in a given environment, use the equivalent Supabase CLI commands documented in project scripts/runbooks.

### Compatibility strategy

- Prefer **expand-and-contract**:
  - Additive changes first (new columns, nullable defaults, new tables/views/functions).
  - Application rollout that reads/writes both old and new schema where needed.
  - Destructive cleanup only after rollout confirmation.
- Any destructive migration requires explicit release sequencing and rollback/forward-fix plan.

### Rollback / forward-fix requirement

Each migration PR must include one of:

- A tested rollback script (for reversible operations), or
- A forward-fix playbook (for irreversible operations), including operator steps and blast-radius notes.

When rollback SQL is used, place it in `infra/supabase/rollbacks/` and reference it from the PR.

---

## 4) Automated validation and linting

### Required gates

- `supabase db lint`
- Migration filename validation (`scripts/check-supabase-migration-filenames.sh`)
- Schema drift check (fresh DB migration apply + snapshot comparison)
- Security/RLS checks from `infra/supabase/sql/ops/security-governance-checks.sql`

### Suggested CI ordering

1. Migration filename + static migration lint
2. Apply migrations in clean DB
3. `supabase db lint`
4. RLS/privilege/view checks SQL
5. Drift check against `docs/db/schema_snapshot.sql`

---

## 5) Hardening standards (RLS-first)

### Tenant isolation

- Every tenant-owned table must enforce tenant scoping via `tenant_id` or approved `organization_id` model.
- RLS policies must be present and tested for cross-tenant denial.

### Least privilege

- Revoke PUBLIC privileges on schema/tables/sequences.
- Grant only required roles (for example, `authenticated`, and narrowly scoped internal roles such as `view_reader`).

### SECURITY DEFINER controls

For any `SECURITY DEFINER` function:

- Require explicit tenant checks in function body.
- Use minimal ownership role.
- Revoke default PUBLIC execute and grant only required roles.

---

## 6) Operational controls

Use operational runbooks for release and recovery:

- `docs/runbooks/deployment.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/STAGING_DEPLOYMENT_RUNBOOK.md`

Minimum required controls:

- Pre-deploy backup confirmation
- Migration list and lint pass confirmation
- Post-deploy validation of RLS/policies and critical-path queries
- DB engine/version consistency across dev, staging, and prod

---

## 7) Observability and audit

- Require trace/request IDs on DB write paths.
- Ensure audit trails for create/update/delete/export/approve/reject/grant/revoke actions.
- Correlate Supabase audit logs with request IDs for incident analysis.

---

## 8) Testing strategy

Migration validation must cover:

1. End-to-end migration apply in a clean database
2. Tenant boundary RLS tests
3. Policy performance checks (indexes used by RLS predicates)
4. Service-level DB helper tests running against migrated schema

---

## 9) Data lifecycle controls

- Keep seed data idempotent and version-aligned with active migrations.
- Document destructive maintenance and archival procedures in runbooks before execution.

---

## 10) Migration review checklist (required in PR)

- [ ] Migration file name is 14-digit timestamp format.
- [ ] Backward compatibility strategy documented (expand/contract if needed).
- [ ] Data backfill impact analyzed and tested.
- [ ] RLS enabled on all tenant tables touched.
- [ ] Tenant isolation policies validated (cross-tenant deny).
- [ ] PUBLIC grants reviewed and minimized.
- [ ] View/function security mode reviewed (`SECURITY INVOKER` preferred).
- [ ] Rollback or forward-fix plan included.
- [ ] `supabase db lint` passes.
- [ ] Security governance SQL checks pass.
- [ ] High-risk schema changes include explicit sign-off from platform + security owners.
