# ValueOS Environment Maintenance Suite (Current Guidance)

> **Status:** This document previously described standalone scripts (`setup.sh`, `healthcheck.sh`, `fix-ports.sh`) that are not part of the current repository. Use the DX scripts instead.

## Canonical Commands

```bash
# Preflight checks
pnpm run dx:doctor

# Full health check
pnpm run dx:check

# Start/stop the local stack
pnpm run dx
pnpm run dx:down
```

## Related Documentation

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)
