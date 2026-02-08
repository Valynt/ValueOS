# Dev Environment Runbook

This runbook is for validating and recovering the local development environment.

## Canonical setup

Follow the canonical Local Dev Quickstart:
- [`docs/getting-started/quickstart.md`](getting-started/quickstart.md)

## Exact commands to boot the stack

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm run dx:env -- --mode local --force
pnpm run dx
```

## Health check steps

```bash
pnpm run dx:check
curl http://localhost:3001/health
curl http://localhost:54321
```


## Migration & RLS Policy Enforcement

### Migration commands
```bash
pnpm run db:sync           # Applies all canonical migrations (infra/postgres/migrations)
pnpm run db:types          # Regenerate TypeScript types from DB schema
```

### RLS Policy Tests (CI Gate)
RLS (Row Level Security) policies are enforced in CI. All database queries must include `organization_id` or `tenant_id` for multi-tenancy. CI will fail if any RLS test fails:
```bash
pnpm run test:rls          # Runs supabase/tests/database/rls_policies.test.sql and multi_tenant_rls.test.sql
```
See also: QUALITY_CONTRACT.md for required CI gates.

## Docker & DevContainer Notes

- node_modules is mounted as a named volume in devcontainer: persists across rebuilds, avoids host masking issues.
- All service URLs in devcontainer must use Docker DNS names (db, redis, kong, etc.), not localhost.
- If you see missing dependencies, rebuild the container and check volume mounts.

## Troubleshooting

- **Migration failures:**
	- Check DATABASE_URL and Docker service health
	- Ensure all migration files are in infra/postgres/migrations
	- Use `pnpm run db:sync -- --dry-run` to preview
- **node_modules not persisting:**
	- Confirm devcontainer.json mounts node_modules as a named volume
	- Rebuild the container if issues persist
- **RLS test failures:**
	- Ensure all queries include tenant/organization filters
	- Review supabase/tests/database/rls_policies.test.sql for coverage

See also:
- [`docs/getting-started/troubleshooting.md`](getting-started/troubleshooting.md)
- [`docs/dx-architecture.md`](dx-architecture.md)
- [`QUALITY_CONTRACT.md`](../QUALITY_CONTRACT.md)
