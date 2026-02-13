# Supabase DB Migration Directory

This directory contains database-related files migrated from various parts of the ValueOS monorepo. All future database scripts, helpers, and seed/migration files should be placed here for consistency.

## Structure
- Place SQL migration scripts in `supabase/migrations/` (canonical)
- Place seed scripts in `supabase/seeds/`
- Place init scripts in `supabase/init-scripts/`
- Place migration automation scripts in `supabase/scripts/`
- Place TypeScript/JS helpers in `supabase/helpers/`

## Migration Policy
- All DB logic must be compatible with Supabase/PostgreSQL
- All migration, seed, and init scripts must reside in `supabase/` (single source of truth)
- Remove or update all references to `infra/scripts/`, `infra/postgres/migrations/`, `.devcontainer/init-scripts/`, and legacy migration doc paths
- Update documentation and onboarding to reference only `supabase/` and `docs/operations/MIGRATION_AUTOMATION_GUIDE.md`
- Do not use any legacy subfolders (like `supabase/db/migrations/`) for new migrations—migrate all content to `supabase/`
