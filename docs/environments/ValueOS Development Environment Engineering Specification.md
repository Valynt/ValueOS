# ValueOS Development Environment Engineering Specification (Current Guidance)

> **Status:** This specification referenced Taskfile and Nix tooling that are not present in the current repository. The canonical, runnable workflow is defined in the Local Dev Quickstart and Local Setup docs.

## Canonical Development Workflow

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)

## Required Commands (Single Source of Truth)

```bash
# Generate environment files
pnpm run dx:env -- --mode local --force

# Start the full local stack
pnpm run dx

# Stop the stack
pnpm run dx:down

# Validate environment + health
pnpm run dx:env:validate
pnpm run dx:check
```

## Common Issues

See [Common Issues + Fixes](../getting-started/troubleshooting.md).
