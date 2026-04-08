# ValueOS Development Environment - Quick Start

**Last Updated**: 2026-04-08

This guide is aligned with currently supported root scripts in `package.json` and `.ona/automations.yaml` automations.

## Fast start

```bash
# Install dependencies
pnpm install

# Start backend + frontend
pnpm run dev
```

## Devcontainer/automation start

```bash
# Ensure dependencies are installed by automation
ona task run installDeps

# Start services defined in .ona/automations.yaml
gitpod automations service start backend
gitpod automations service start frontend
```

## Supported commands

```bash
pnpm run dev:frontend
pnpm run dev:backend
pnpm run dev
pnpm run build
pnpm run lint
pnpm run check
pnpm run test
pnpm run db:migrate
pnpm run test:rls
pnpm run dx:check
```

## Legacy command compatibility (temporary)

To avoid breaking older docs/scripts, root `package.json` currently provides compatibility aliases:

- `dx:up` → `dev:up`
- `dx:reset` → `dev:reset`
- `dev:verify` → `dx:check`
- `dev:verify:quick` → `dx:check`
- `dev:verify:infra` → `dx:check`
- `typecheck:islands` → `check`

### Deprecation timeline

- **2026-04-08**: Compatibility aliases added.
- **2026-06-30**: Aliases marked deprecated in docs + CI messaging.
- **2026-09-30**: Planned removal after migration to canonical commands.

## CI docs guardrail

Use the docs script-reference check to validate every `pnpm run <script>` mention in quickstart docs resolves to a script in root `package.json`:

```bash
pnpm run check:docs:script-references
```
