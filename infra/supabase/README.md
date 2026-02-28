# infra/supabase

This directory contains Supabase deployment, migrations, and DB utility assets for infrastructure automation.

## Directory layout
## Policy: Cloud-only migration and deployment path

`infra/supabase` is **cloud-first** and our default CI/CD and deploy workflows target hosted Supabase projects (staging/production) only.

- Cloud deploy and migration paths **must not** depend on local Supabase CLI stack state.
- Local Supabase assets in this directory are optional developer tooling only and are not part of the supported production path unless explicitly requested.
- Any local-stack action must set `LOCAL_SUPABASE_ONLY=1` before execution.

### Unsupported/optional local-stack assets

The following files are retained for optional local experimentation and are outside of the default deploy contract:

- `infra/supabase/config.toml` (Supabase local CLI stack config)
- `infra/supabase/sql/ops/init-auth.sql` (local/bootstrap helper SQL)
- `infra/supabase/sql/ops/EXAMPLE_seed.sql` (example local seed)
- `infra/supabase/sql/ops/create_dummy_user.sql` (non-production sample data helper)

Use these only when `LOCAL_SUPABASE_ONLY=1` is intentionally set.

- Use for production and staging deployment scripts, migration management, and infrastructure-as-code.
- Not for local CLI development (see root-level supabase/ if present).

- `infra/supabase/supabase/migrations/` — **active migration directory**. Keep only timestamped migration files named like `YYYYMMDDHHMMSS_description.sql`.
- `infra/supabase/sql/auth/` — manual/auth utility SQL (for example `init-auth.sql`).
- `infra/supabase/sql/seeds/` — manual seed SQL (for example `create_dummy_user.sql`, `EXAMPLE_seed.sql`).
- `infra/supabase/sql/ops/` — manual operational SQL scripts.

## Manual utility script execution

Run these from repository root (`/workspace/ValueOS`).

### 1) Validate migration filenames (CI parity)

```bash
bash scripts/check-supabase-migration-filenames.sh
```

Fails if any non-timestamp `.sql` file exists directly in `infra/supabase/supabase/migrations/`.

### 2) Migration validation utility

```bash
bash infra/supabase/supabase/scripts/validate-migrations.sh
```

Optionally write report and enable fix mode:

```bash
bash infra/supabase/supabase/scripts/validate-migrations.sh /tmp/migration_validation_report.txt --fix
```

### 3) Migration status checker

```bash
bash infra/supabase/supabase/scripts/migration-status.sh
```

### 4) Rollback utility

```bash
bash infra/supabase/supabase/scripts/rollback-migration.sh --help
```

Use help output to choose explicit rollback/backup subcommands before running in shared environments.

### 5) Full migration runner

```bash
bash infra/supabase/supabase/scripts/supabase-migrate-all.sh --help
```

For manual runs, start with dry-run:

```bash
bash infra/supabase/supabase/scripts/supabase-migrate-all.sh --dry-run --verbose
```
For local CLI config, use the root-level `supabase/` directory (if present).

- Schema governance baseline: `SCHEMA_GOVERNANCE_CHECKLIST.md`
