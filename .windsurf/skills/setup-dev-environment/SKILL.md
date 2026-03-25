---
name: setup-dev-environment
description: >
  Set up the ValueOS development environment from scratch. Use when onboarding
  to the repo, after a devcontainer rebuild, or when the environment is broken.
  Triggers on: "set up dev environment", "onboard", "fresh environment",
  "devcontainer setup", "environment broken", "start from scratch".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Setup Dev Environment

ValueOS uses a devcontainer-first model. All setup is automated through Ona automations — no manual Docker orchestration or multi-terminal juggling required.

## Prerequisites

- Ona/Gitpod environment running (devcontainer phase: `running`)
- `.env` file present at repo root (created by `bootstrap.sh` from `.env.example` if missing)
- Supabase project credentials available

## Standard Setup (Ona automations)

The environment auto-configures on start via two triggers:

| Trigger | Automation | What it does |
|---|---|---|
| `postDevcontainerStart` | `installDeps` | Runs `bootstrap.sh`: validates toolchain, provisions `.env`, installs deps with `--frozen-lockfile` |
| `postEnvironmentStart` | `backend` service | Waits for `node_modules`, opens port 3001, starts Express |
| `postEnvironmentStart` | `frontend` service | Waits for `node_modules`, opens port 5173, starts Vite |

Check automation status:

```bash
gitpod automations task list
gitpod automations service list
```

## Manual Setup (if automations did not run)

```bash
# Step 1: Install dependencies (frozen lockfile — never use --no-frozen-lockfile)
bash .devcontainer/scripts/bootstrap.sh

# Step 2: Start services
gitpod automations service start backend
gitpod automations service start frontend
```

## Toolchain versions

Canonical versions are in `.devcontainer/versions.json`. Do not override them.

| Tool | Version source |
|---|---|
| Node.js | `.devcontainer/versions.json` → `.nvmrc` → `.tool-versions` |
| pnpm | `.devcontainer/versions.json` → `.tool-versions` |
| kubectl | `.devcontainer/versions.json` |
| terraform | `.devcontainer/versions.json` |

## Required environment variables

Set in `ops/env/.env.backend.local` (or `.env` at repo root for shared vars):

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_KEY          # same value as SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
TCT_SECRET
WEB_SCRAPER_ENCRYPTION_KEY   # 32-byte hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Backend startup fails fast if `TCT_SECRET` is missing.

## Health verification

```bash
# Backend
curl http://localhost:3001/health
# Expected: {"status":"healthy",...}

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200

# Service logs
gitpod automations service logs backend
gitpod automations service logs frontend
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `installDeps` failed | `gitpod automations task logs installDeps` — check for lockfile mismatch or missing `.env` |
| Backend crashes with `supabaseKey is required` | Set both `SUPABASE_ANON_KEY` and `SUPABASE_KEY` to the anon key value |
| Backend crashes with `TCT_SECRET` missing | Add `TCT_SECRET` to `ops/env/.env.backend.local` |
| `pnpm-lock.yaml` out of sync | Run `pnpm install` locally to regenerate, commit the updated lockfile |
| Port already in use | `gitpod environment port list` to inspect; services manage ports automatically |
| `turbo` or `tsx` not found | Run `pnpm install` — they are workspace devDependencies, not global installs |

## What NOT to do

- Do not run `pnpm install --no-frozen-lockfile` in automation — fix the lockfile instead
- Do not add `postCreateCommand` or `postStartCommand` to `devcontainer.json` — all setup runs through automations
- Do not install `turbo` or `tsx` globally in the Dockerfile — they resolve via `pnpm exec`
- Do not use `APP_ENV=cloud-dev` prefix — the automations handle environment loading
