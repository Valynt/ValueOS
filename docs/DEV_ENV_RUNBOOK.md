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

## Migration + seed commands

```bash
pnpm run db:reset
pnpm run seed:demo
```

## Common failures + fixes

See the single source of truth:
- [`docs/getting-started/troubleshooting.md`](getting-started/troubleshooting.md)
