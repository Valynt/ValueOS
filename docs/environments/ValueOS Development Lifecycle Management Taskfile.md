# ValueOS Development Lifecycle Commands (Current)

> **Status:** The repository does not include a `Taskfile.yml`. The canonical lifecycle commands are the `pnpm run dx*` scripts documented below.

## Canonical Commands

```bash
# Generate environment files
pnpm run dx:env -- --mode local --force

# Start the full local stack
pnpm run dx

# Stop the stack
pnpm run dx:down

# Reset containers + volumes
pnpm run dx:reset

# Health checks
pnpm run dx:check

# Preflight checks
pnpm run dx:doctor
```

## Related Documentation

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)
