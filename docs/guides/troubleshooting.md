# Troubleshooting Guide

This guide provides advanced diagnostics for ValueOS development. The single source of truth for common symptoms → causes → fixes is the [Common Issues + Fixes](../getting-started/troubleshooting.md) guide.

## Advanced diagnostics

```bash
# Full environment health check
pnpm run dx:check

# Preflight checks (versions, ports, Docker)
pnpm run dx:doctor

# Environment validation
pnpm run dx:env:validate

# Tail all service logs
pnpm run dx:logs

# Inspect running containers
pnpm run dx:ps
```

## Targeted checks

```bash
# Backend health endpoint
curl http://localhost:3001/health

# Supabase REST endpoint (responds with 401/403 when unauthenticated)
curl http://localhost:54321/rest/v1/
```

## Clean reset

```bash
# Stop containers and clear local state
pnpm run dx:down
pnpm run dx:clean

# Re-generate env files and restart
pnpm run dx:env -- --mode local --force
pnpm run dx
```

## Getting help

- [Setup Guide](setup.md)
- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Environment Configuration](../ENVIRONMENT.md)
