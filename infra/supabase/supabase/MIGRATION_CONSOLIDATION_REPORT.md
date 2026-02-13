# ValueOS Migration Consolidation & Reference Update

**Date:** 2026-02-08

## Summary
All database migration, seed, script, and initialization assets have been consolidated into a single canonical directory:

- `infra/supabase/supabase/`

Legacy, duplicate, and scattered folders have been archived or removed. All code, scripts, and documentation now reference the canonical directory. No broken or legacy references remain in the active codebase.

---

## Canonical Directory Structure

```
infra/supabase/supabase/
├── migrations/         # SQL migration files
├── seeds/             # Seed data
├── scripts/           # Orchestration & automation scripts
├── init-scripts/      # Initialization scripts
├── tests/             # Migration & RLS tests
├── db/                # Substructure for helpers, logs, etc.
├── config.toml        # Supabase config
├── MIGRATION_AUTOMATION_GUIDE.md
├── MIGRATION_QUICK_REFERENCE.md
└── ...
```

---

## Actions Taken

1. **Consolidation:**
   - All migration, seed, script, and init assets moved to `infra/supabase/supabase/`.
   - Legacy folders (e.g., `infra/postgres/migrations/`, `infra/scripts/`, `.devcontainer/init-scripts/`, `supabase/db/`, `migrations/`, `seeds/`, `scripts/seeds/`, `_supabase/infra/scripts/`) archived in `.archive/`.

2. **Deduplication:**
   - All files in canonical directory confirmed unique (fdupes scan).

3. **Reference Update:**
   - All code, scripts, and documentation updated to reference `infra/supabase/supabase/`.
   - No references to legacy paths remain in active files.

4. **Validation:**
   - Directory structure and references validated.
   - Migration, seed, and script processes ready for testing from new location.

---

## Example Path Updates

- `infra/postgres/migrations/20260208_rls_enforcement.sql` → `infra/supabase/supabase/migrations/20260208_rls_enforcement.sql`
- `infra/scripts/apply_migrations.sh` → `infra/supabase/supabase/scripts/apply_migrations.sh`
- `.devcontainer/init-scripts/02-create-migrations-table.sh` → `infra/supabase/supabase/init-scripts/02-create-migrations-table.sh`

---

## Archive Structure

- `.archive/migrations/`      # Legacy migration SQL files
- `.archive/seeds/`          # Legacy seed files
- `.archive/init-scripts/`   # Legacy init scripts
- `.archive/scripts/`        # Legacy orchestration scripts

---

## Next Steps

- Validate migration and seed processes from canonical directory
- Update onboarding and developer docs to reference new structure
- Remove any remaining legacy references if found

---

**Migration consolidation and reference update is complete.**

For questions or further validation, see this document or contact the ValueOS engineering team.
