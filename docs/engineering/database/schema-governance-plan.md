# Schema, Migration, and Database Governance Plan

## Inventory & baseline
- **Enumerate migration sources:** Inventory and track all schema/migration SQL under `supabase/migrations/` with naming aligned to the 14-digit `YYYYMMDDHHMMSS_description.sql` convention and dependency annotations as documented in the Supabase migration fix notes.【F:infra/supabase/MIGRATION_FIX.md†L58-L90】
- **Review prior fixes:** Use the Supabase migration fix and resolution notes as baseline context for dependency order, rollback guidance, and lint expectations before planning new schema changes.【F:infra/supabase/MIGRATION_FIX.md†L1-L119】【F:infra/supabase/ISSUE_RESOLVED.md†L1-L91】
- **Config alignment check:** Validate `infra/supabase/config.toml` against expected environment parity (ports, schema exposure, and database major version), and record any gaps as work items in the migration backlog.【F:infra/supabase/config.toml†L1-L81】【F:docs/dev/SYSTEM_INVARIANTS.md†L46-L146】

## Schema governance
- **Migrations as source of truth:** Treat migration files as canonical schema. All schema changes must land as new migrations, reviewed and approved before deployment.【F:docs/dev/SYSTEM_INVARIANTS.md†L129-L146】
- **Documentation co-location:** Maintain schema documentation alongside migrations in `docs/engineering/database/` and cross-link key schema references in `docs/context/database.md` so the system of record stays aligned with migration history.【F:docs/context/database.md†L20-L520】【F:docs/engineering/database/zero-downtime-migrations.md†L1-L80】

## Migration workflow & safety
- **Standard developer flow:** Use Taskfile automation for `task db:diff -- <name>` to generate migrations, `task db:migrate` to apply, and `task db:reset` for clean local state. Documented in the development lifecycle Taskfile guide.【F:docs/environments/ValueOS Development Lifecycle Management Taskfile.md†L67-L90】【F:docs/environments/ValueOS Development Lifecycle Management Taskfile.md†L135-L146】
- **Backward-compatible strategy:** Follow expand/contract (additive-first, destructive-later) with explicit rollout/rollback sequencing to avoid downtime.【F:docs/engineering/database/zero-downtime-migrations.md†L1-L160】
- **Rollback/forward-fix planning:** Require rollback or forward-fix steps for each migration, and verify rollback files in `supabase/migrations/rollback/` when used, per migration safety runbooks.【F:docs/operations/deployment.md†L213-L340】【F:docs/operations/SECURITY_REMEDIATION.md†L204-L219】

## Automated validation & linting
- **CI validation gates:** Add Supabase `db lint` and schema drift checks into CI and pre-deploy gates to ensure migrations match expected state and RLS coverage.【F:infra/supabase/SECURITY_HARDENING.md†L161-L171】【F:docs/operations/deployment.md†L86-L465】
- **Scripted security checks:** Run SQL checks listed in `infra/supabase/SECURITY_HARDENING.md`, including RLS enabled for public tables, no PUBLIC grants, and explicit security posture for views/functions.【F:infra/supabase/SECURITY_HARDENING.md†L161-L189】

## Hardening standards
- **RLS-first architecture:** Enforce tenant isolation policies on multi-tenant tables and user-specific policies on user-owned data, aligned to existing RLS remediation practices and migration guidance.【F:docs/context/database.md†L447-L520】【F:docs/operations/SECURITY_REMEDIATION.md†L41-L90】
- **Least-privilege roles:** Revoke PUBLIC privileges on schemas/tables/sequences, and grant only required roles (authenticated, view_reader) per the hardening checklist.【F:infra/supabase/SECURITY_HARDENING.md†L59-L189】
- **SECURITY DEFINER review:** Require explicit tenant checks and minimal ownership in SECURITY DEFINER functions following the security hardening templates and lint guidance.【F:infra/supabase/SECURITY_HARDENING.md†L239-L245】

## Operational controls
- **Runbook-driven deploys:** Use deployment and rollback runbooks to apply and verify migrations, with pre-deploy backups and post-deploy validation queries (lint, RLS checks, migration list).【F:docs/operations/deployment.md†L58-L340】【F:docs/operations/launch-readiness/migration-rollout-plan.md†L8-L56】
- **Environment parity:** Enforce consistent DB versions across dev/staging/prod using config parity checks and documented system invariants.【F:docs/dev/SYSTEM_INVARIANTS.md†L46-L146】【F:infra/supabase/config.toml†L1-L81】

## Observability & audit
- **Trace correlation:** Require trace IDs on DB write paths and link Supabase audit logs to request/trace IDs for investigation and audits.【F:docs/environments/ValueOS Multi-Agent Fabric Observability and Debugging Guide.md†L121-L122】

## Testing strategy
- **Migration test coverage:** Validate migrations end-to-end on a clean DB, verify RLS policy behavior across tenant boundaries, and check performance-critical indexes where policies rely on them.【F:docs/dev/SYSTEM_INVARIANTS.md†L111-L146】【F:docs/operations/ci/ci-runbook.md†L24-L31】
- **Schema-aware service tests:** For services with DB helpers, ensure tests run against migrated schema before execution (e.g., `supabase test db` in CI).【F:docs/operations/ci/ci-runbook.md†L24-L31】

## Data lifecycle
- **Seed alignment:** Keep seed data idempotent and aligned to migration versions; ensure `db reset` reliably recreates schema and seed state for deterministic testing.【F:infra/supabase/config.toml†L55-L70】【F:docs/dev/SYSTEM_INVARIANTS.md†L111-L146】
- **Destructive procedures:** Document any destructive data maintenance tasks in runbooks and require explicit approval gates before production execution.【F:docs/operations/deployment.md†L281-L336】

## Governance checklist
- **Migration review checklist:** Verify compatibility, data backfills, RLS/privileges, rollback/forward-fix plan, and lint status before approval.【F:infra/supabase/SECURITY_HARDENING.md†L161-L189】【F:docs/operations/deployment.md†L336-L465】
- **High-risk change sign-off:** Require explicit sign-off for destructive or cross-tenant schema changes, and record the decision in the migration PR or runbook log.【F:docs/operations/launch-readiness/migration-rollout-plan.md†L8-L56】
