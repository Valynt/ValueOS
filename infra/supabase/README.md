# infra/supabase

Supabase deployment, migration, and DB utility assets for ValueOS infrastructure automation.

## Active vs archived boundary

- **Active migration chain:** top-level timestamped files in `infra/supabase/supabase/migrations/`
- **Archived-reference migration history:** `infra/supabase/supabase/migrations/archive/`
- **Manual utility SQL:** `infra/supabase/sql/auth/`, `infra/supabase/sql/seeds/`, `infra/supabase/sql/ops/`
- **Rollback SQL:** `infra/supabase/rollbacks/`

## Policy: cloud-first migration and deployment path

`infra/supabase` is **cloud-first** and the default CI/CD + release workflows target hosted Supabase projects for staging and production.

- Cloud deploy and migration paths must not depend on a local Supabase CLI stack.
- Local Supabase assets in this directory are optional developer tooling only.
- Any local-stack action must set `LOCAL_SUPABASE_ONLY=1` before execution.

### Optional local-stack assets

The following files are outside the default shared-environment deploy contract:

- `infra/supabase/config.toml`
- `infra/supabase/sql/ops/init-auth.sql`
- `infra/supabase/sql/ops/EXAMPLE_seed.sql`
- `infra/supabase/sql/ops/create_dummy_user.sql`

## Manual utility script execution

Run these from repository root (`/workspace/ValueOS`).

### Validate migration filenames

```bash
bash scripts/check-supabase-migration-filenames.sh
```

### Validate migration health

```bash
bash infra/supabase/supabase/scripts/validate-migrations.sh
```

### Check migration status

```bash
bash infra/supabase/supabase/scripts/migration-status.sh
```

### Rollback utility help

```bash
bash infra/supabase/supabase/scripts/rollback-migration.sh --help
```

### Full migration runner help

```bash
bash infra/supabase/supabase/scripts/supabase-migrate-all.sh --help
```

For schema governance context, see `SCHEMA_GOVERNANCE_CHECKLIST.md` and `infra/supabase/supabase/migrations/MIGRATION_MANIFEST.md`.
