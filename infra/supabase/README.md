# infra/supabase

This directory contains Supabase deployment and migration configuration for infrastructure automation.

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

## Contents
- Migration scripts and rollbacks
- Infrastructure config (config.toml, .gitignore, etc)
- Documentation of migration and security improvements

For local CLI config, use the root-level `supabase/` directory (if present).

- Schema governance baseline: `SCHEMA_GOVERNANCE_CHECKLIST.md`
