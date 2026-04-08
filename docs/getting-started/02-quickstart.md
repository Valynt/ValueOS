# 02 Quickstart

**Last Updated**: 2026-04-08

This quickstart references only currently supported root scripts from `package.json` and automation tasks/services from `.ona/automations.yaml`.

---

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local infra workflows)

## Start ValueOS in the devcontainer (recommended)

```bash
# Install/validate toolchain and dependencies
ona task run installDeps

# Start backend and frontend services from .ona/automations.yaml
gitpod automations service start backend
gitpod automations service start frontend
```

Equivalent root scripts:

```bash
pnpm run dev:backend
pnpm run dev:frontend
```

## Local development outside devcontainer

```bash
# 1) Install dependencies
pnpm install

# 2) Initialize cloud/local dev wiring
pnpm run dev:init

# 3) Bring up local dev dependencies and services
pnpm run dev:up

# 4) Run a health/tooling check
pnpm run dx:check
```

## Common commands (supported)

| Command | Purpose |
| --- | --- |
| `pnpm run dev:frontend` | Start Vite frontend |
| `pnpm run dev:backend` | Start backend API |
| `pnpm run dev` | Start frontend + backend together |
| `pnpm run build` | Build frontend + backend |
| `pnpm run test` | Run workspace Vitest suite |
| `pnpm run lint` | Run lint checks via Turbo |
| `pnpm run check` | Run TypeScript checks via Turbo |
| `pnpm run db:migrate` | Apply DB migrations |
| `pnpm run test:rls` | Run RLS/security test suite |
| `pnpm run dx:check` | Developer environment diagnostics |

## Compatibility scripts for legacy quickstart commands

Legacy command names are currently retained as compatibility aliases in root `package.json`:

- `pnpm run dx:up` → delegates to `pnpm run dev:up`
- `pnpm run dx:reset` → delegates to `pnpm run dev:reset`
- `pnpm run dev:verify` → delegates to `pnpm run dx:check`
- `pnpm run dev:verify:quick` → delegates to `pnpm run dx:check`
- `pnpm run dev:verify:infra` → delegates to `pnpm run dx:check`
- `pnpm run typecheck:islands` → delegates to `pnpm run check`

### Deprecation timeline

- **2026-04-08**: Compatibility aliases added and documented.
- **2026-06-30**: Deprecation warnings begin in release notes/CI messaging.
- **2026-09-30**: Planned removal window for compatibility aliases (major-version change or coordinated developer tooling update).

## Notes

- Canonical automation task/service definitions: `.ona/automations.yaml`.
- Canonical runnable scripts: root `package.json` `scripts` block.
