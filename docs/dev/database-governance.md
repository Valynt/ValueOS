# Dev: Database Governance

## 1. Migration Inventory
ValueOS maintains a strict 14-digit timestamp naming convention for migrations in `supabase/migrations/`.

### Key Migrations
- `20240101000000_release_v1.sql`: Baseline schema.
- `20260115000000_tenant_foundations.sql`: Multi-tenancy core.
- `20260115000001_memory_first_architecture.sql`: Memory-centric OS schema.
- `20260116000000_tenant_rls_context.sql`: RLS policy enforcement.

## 2. Governance Rules
- **Naming:** `YYYYMMDDHHMMSS_description.sql`.
- **Dependency Annotations:** Use `-- DEPENDENCIES:` headers when a migration references tables from a prior file.
- **Immutability:** Once a migration is pushed to the remote or shared, it must never be edited. Use a new migration for fixes.
- **Validation:** Run `supabase db diff` to verify changes before committing.

## 3. Alignment & Backlog
- **Port Parity:** Ensure `config/ports.json` and `infra/supabase/config.toml` remain aligned (Supabase DB: 54322).
- **Repair Workflow:** Use `supabase migration repair` if local and remote histories drift.
- **Audit Cadence:** Weekly review of new migrations for naming and dependency compliance.

## 4. Change Execution Workflow
1. Create migration with correct naming.
2. Add dependency headers if applicable.
3. Run `supabase db reset` locally to validate ordering.
4. Push to remote via `supabase db push`.

---
**Last Updated:** 2026-01-28
**Related:** `docs/dev/DEV_MASTER.md`, `infra/supabase/MIGRATION_FIX.md`
