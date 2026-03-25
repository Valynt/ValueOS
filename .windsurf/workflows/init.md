---
description: Initialize the ValueOS development environment
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Initialize ValueOS

ValueOS uses a devcontainer-first model. The environment is initialized automatically via Ona automations — no manual multi-terminal setup required.

## Standard path (Ona automations)

On environment start, automations run in this order:

1. **`installDeps`** (`postDevcontainerStart`) — runs `bootstrap.sh`:
   - Validates toolchain versions against `.devcontainer/versions.json`
   - Provisions `.env` from `.env.example` if missing
   - Runs `pnpm install --frozen-lockfile`
   - Smoke-tests that `turbo` and `tsx` resolve

2. **`backend`** service (`postEnvironmentStart`) — waits for `node_modules/.modules.yaml`, opens port 3001, starts Express

3. **`frontend`** service (`postEnvironmentStart`) — waits for `node_modules/.modules.yaml`, opens port 5173, starts Vite

Check status:

```bash
gitpod automations task list
gitpod automations service list
```

## Manual initialization (if automations did not run)

```bash
# Install dependencies — always use --frozen-lockfile
bash .devcontainer/scripts/bootstrap.sh

# Start services
gitpod automations service start backend
gitpod automations service start frontend
```

## Required credentials

Before services will start successfully, set in `ops/env/.env.backend.local`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_KEY=your-anon-key          # same value as SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
TCT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
WEB_SCRAPER_ENCRYPTION_KEY=<generate: same command>
```

## Verify

```bash
curl http://localhost:3001/health
# Expected: {"status":"healthy",...}
```

## Rules

- **Never** use `--no-frozen-lockfile` — if the lockfile is out of sync, fix it and commit
- **Never** add `postCreateCommand` or `postStartCommand` to `devcontainer.json` — all setup runs through automations
- **Never** install `turbo` or `tsx` globally — they are workspace devDependencies
