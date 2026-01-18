# Schema, Migration, and Database Governance Plan

## Inventory & baseline

### Migration inventory (infra/supabase/migrations)

| Migration file | Naming check (14-digit) | Dependency annotations | Notes |
| --- | --- | --- | --- |
| `20240101000000_release_v1.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20250115000000_referral_program.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20260114000001_fix_schema_alignment.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20260114000002_standardize_tenant_id_types.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20260115000000_tenant_foundations.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20260115_memory_first_architecture.sql` | ❌ | TODO | Rename to 14-digit timestamp and run migration repair if needed. |
| `20260116000000_tenant_rls_context.sql` | ✅ | TODO | Validate dependencies and annotate. |
| `20260201000000_harden_invoice_concurrency.sql` | ✅ | TODO | Validate dependencies and annotate. |

**Dependency annotation policy:** add `-- DEPENDENCIES:` blocks to any migration that references tables created in earlier migrations, per Supabase migration fix guidance.【F:infra/supabase/MIGRATION_FIX.md†L58-L90】

### Prior fixes & baseline expectations

* The migration repair notes confirm the 14-digit naming requirement and highlight ghost migration cleanup steps; use these notes as the standard for renames and repair sequences before any new schema work.【F:infra/supabase/ISSUE_RESOLVED.md†L1-L91】
* The Supabase migration fix documentation outlines dependency annotations, pre-migration validation, and lint expectations that should be applied to every new migration in this repo.【F:infra/supabase/MIGRATION_FIX.md†L1-L119】

## Config alignment check (Supabase + system invariants)

### Current Supabase config (infra/supabase/config.toml)

* API port: 54321
* Studio port: 54323
* DB port: 54329
* DB major version: 17
* Exposed schemas: `public`, `graphql_public`

These settings align with Supabase defaults and local dev expectations for API/Studio ports and the non-default DB port in the Supabase config.【F:infra/supabase/config.toml†L1-L81】

### Expected environment parity from system invariants

The system invariants document establishes port assignments and notes that Supabase DB should run on 54329 to avoid conflicts, while `config/ports.json` is the source of truth for overall port config.【F:docs/dev/SYSTEM_INVARIANTS.md†L24-L74】

### Gaps to track in the migration backlog

1. **Ports configuration mismatch:** `config/ports.json` lists `supabase.dbPort` as `54322`, which conflicts with the invariant requiring `54329` and the actual Supabase config value. Create a backlog task to align `config/ports.json` and any generated `.env.ports` outputs with the invariant and `infra/supabase/config.toml`.【F:docs/dev/SYSTEM_INVARIANTS.md†L24-L74】【F:infra/supabase/config.toml†L1-L81】
2. **Migration filename non-compliance:** rename `20260115_memory_first_architecture.sql` to a valid 14-digit timestamp and perform any required migration repair to keep local/remote history aligned, per the migration fix notes.【F:infra/supabase/ISSUE_RESOLVED.md†L1-L91】
3. **Dependency annotations backlog:** add dependency comments to all migrations that reference prior tables to avoid future ordering issues and improve auditability.【F:infra/supabase/MIGRATION_FIX.md†L58-L90】

## Governance plan (ongoing)

### 1. Pre-change checklist

* Confirm migration filename adheres to the `YYYYMMDDHHMMSS_description.sql` format.
* Add dependency annotations in the migration header when referencing prior tables.
* Run `supabase db diff --schema public` to validate expected changes before pushing.
* Verify `config/ports.json` and `infra/supabase/config.toml` remain aligned with system invariants.

### 2. Change execution workflow

1. Create migration with correct naming + dependency header.
2. Run local reset and push (`supabase db reset`, `supabase db push`) to validate ordering and lint.
3. Update migration inventory and backlog notes in this plan document.
4. Apply to remote using `supabase db push --include-all` and record outcomes in migration logs.

### 3. Audit cadence

* **Weekly:** review new migrations for naming compliance and dependency headers.
* **Monthly:** verify local config parity with system invariants (ports, DB major version).
* **Per release:** ensure migration inventory list is updated and unresolved backlog items are tracked.
