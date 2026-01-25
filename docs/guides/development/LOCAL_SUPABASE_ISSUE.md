# Local Supabase Notes (Current Guidance)

> **Status:** This document previously captured historical troubleshooting. The current local workflow uses `pnpm run dx` to start Supabase automatically in local mode, and skips Supabase inside DevContainers when Docker-in-Docker port forwarding is unreliable.

## Canonical Workflow

```bash
pnpm run dx:env -- --mode local --force
pnpm run dx
```

## If Supabase Fails to Start

```bash
# Restart the local stack
pnpm run dx:down
pnpm run dx
```

## Related Docs

- [Local Dev Quickstart](../../getting-started/quickstart.md)
- [Common Issues + Fixes](../../getting-started/troubleshooting.md)
