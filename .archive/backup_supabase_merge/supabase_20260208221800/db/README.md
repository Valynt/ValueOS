# Supabase DB Migration Directory

This directory contains database-related files migrated from various parts of the ValueOS monorepo. All future database scripts, helpers, and seed/migration files should be placed here for consistency.

## Structure
- Place SQL migration scripts in `_supabase/migrations/` (canonical) or `supabase/db/migrations/` (legacy, to be removed)
- Place seed scripts in `_supabase/seeds/`
- Place init scripts in `_supabase/init-scripts/`
- Place migration automation scripts in `_supabase/scripts/`
- Place TypeScript/JS helpers in `supabase/db/helpers/`

## Migration Policy
- All DB logic must be compatible with Supabase/PostgreSQL
- All migration, seed, and init scripts must reside in `_supabase/` (single source of truth)
- Remove or update all references to `infra/scripts/`, `infra/postgres/migrations/`, `.devcontainer/init-scripts/`, and legacy migration doc paths
- Update documentation and onboarding to reference only `_supabase/` and `docs/operations/MIGRATION_AUTOMATION_GUIDE.md`
- Do not use `supabase/db/migrations/` for new migrations—migrate all content to `_supabase/`
