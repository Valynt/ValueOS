# Supabase CLI Update Guide

## Current Version

The project is currently using **Supabase CLI v2.70.5** (as of 2025-12-29).

## Updating Supabase CLI

### Option 1: Update via npm (Recommended for active development)

```bash
npm install -D supabase@latest --legacy-peer-deps
```

This updates the npm package in `package.json` and is immediately available via `npx supabase`.

### Option 2: Rebuild the dev container (For fresh installs)

When you rebuild the dev container, the Dockerfile will automatically install the latest version of Supabase CLI at build time using the official install script.

The installation happens in `.devcontainer/Dockerfile.optimized` at line 113:

```dockerfile
RUN curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

## Verification

After updating, verify the version:

```bash
npx supabase --version
```

The version is also displayed during dev container creation in the post-create script output.

## Why Two Installation Methods?

1. **Dockerfile installation**: Provides the CLI globally in the container (via PATH)
2. **npm package**: Ensures the CLI is locked to a specific version for reproducible builds and is available via `npx`

Both should be kept in sync for consistency.

## Automatic Version Checks

The dev container's post-create script (`.devcontainer/scripts/post-create.sh`) automatically verifies and displays the Supabase CLI version on container startup.

## Migration Sync Issues

If you encounter migration sync issues after updating (like "Remote migration versions not found"), refer to the troubleshooting steps:

1. Check migration status: `npx supabase migration list`
2. Repair migration history if needed: `npx supabase migration repair --status reverted <migration_id>`
3. Mark migrations as applied: `npx supabase migration repair --status applied <migration_id>`
4. Push changes: `npx supabase db push`

See the main project documentation for more details on database migrations.
