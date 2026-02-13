# infra/supabase

This directory contains Supabase deployment, migrations, and DB utility assets for infrastructure automation.

## Directory layout

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
