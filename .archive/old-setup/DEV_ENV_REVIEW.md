# Development Environment Code Review

## Executive Summary
A review of the `.devcontainer`, Docker configuration, and development scripts revealed a functional but inconsistent setup. The primary issues involve version drift between Docker and Node configuration, redundant orchestration logic, and a "split-brain" approach to database migrations.

## Findings

### 1. Version Mismatches
- **Supabase CLI**:
  - `package.json` specifies `^2.72.8`.
  - `.devcontainer/Dockerfile.optimized` pins a much older version `2.43.0`.
  - **Risk**: CI/CD and local developers using `pnpm` will use a different CLI version than those in the dev container, potentially leading to schema drift or command incompatibility.
- **Prisma**:
  - Installed in `.devcontainer/Dockerfile.optimized` (`v5.25.0`) but not found in `package.json` dependencies or workspaces.
  - **Recommendation**: Remove from Dockerfile to reduce image size and build time.

### 2. Migration Split-Brain
- **Orchestration (`scripts/dx/orchestrator.js`)**: Uses `supabase db push`, which tracks migrations in `supabase_migrations.schema_migrations`.
- **Dev Container (`scripts/dev/setup.sh`)**: Calls `scripts/dev/migrate.sh` -> `infra/scripts/apply_migrations.sh`, which uses `psql` and tracks migrations in `public.schema_migrations`.
- **Impact**: Migrations applied in one environment may not be recognized in the other, leading to re-application errors or inconsistent schema states.

### 3. Missing References
- `.devcontainer/Dockerfile.optimized` refers to `.devcontainer/scripts/install-optional-tools.sh` in a comment for "Stage 5: Security tools", but this file does not exist in the repository.

### 4. Redundant Logic
- `scripts/dev/setup.sh` partially duplicates logic found in `scripts/dx/orchestrator.js` (database health checks, environment loading).
- **Recommendation**: In the long term, `setup.sh` should leverage `orchestrator.js` directly to ensure a single source of truth for environment startup.

## Remediation Plan
1. Update `Dockerfile.optimized` to use Supabase CLI v2.72.8 and remove unused Prisma/security references.
2. Update `scripts/dev/setup.sh` to use `supabase db push`, aligning the Dev Container with the standard DX workflow.
