---
name: ona-environment
description: >
  Canonical skill for the ValueOS Ona/Gitpod devcontainer environment.
  Covers setup, automation commands, port management, health checks, and
  troubleshooting. Use when setting up the environment, starting services,
  checking health, or debugging environment issues.
  Triggers on: "set up environment", "start services", "environment health",
  "devcontainer", "automations", "port management", "backend not running",
  "frontend not running", "install dependencies", "bootstrap".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Ona Environment

Canonical reference for the ValueOS Ona/Gitpod devcontainer environment. This is the authoritative skill — `.windsurf/skills/setup-dev-environment/` and `.windsurf/skills/dev-environment-health/` are thin adapters that reference this file.

## Environment model

ValueOS runs in an Ona devcontainer. All setup and service management is handled through automations defined in `.ona/automations.yaml`. There is no manual Docker orchestration, no `APP_ENV=cloud-dev` prefix, and no multi-terminal setup.

```
Devcontainer starts
  └─ postDevcontainerStart → installDeps task
       └─ bootstrap.sh: validate toolchain, provision .env, pnpm install --frozen-lockfile

Environment starts
  ├─ postEnvironmentStart → backend service (waits for node_modules, starts Express on 3001)
  └─ postEnvironmentStart → frontend service (waits for node_modules, starts Vite on 5173)
```

## Automation commands

### Service management

```bash
# List all services and their status
gitpod automations service list

# Start a service
gitpod automations service start backend
gitpod automations service start frontend

# Stop a service
gitpod automations service stop backend
gitpod automations service stop frontend

# View live logs
gitpod automations service logs backend
gitpod automations service logs frontend
```

### Task management

```bash
# List all tasks
gitpod automations task list

# Run a task manually
gitpod automations task start installDeps
gitpod automations task start test
gitpod automations task start testRls
gitpod automations task start lint
gitpod automations task start typecheck
gitpod automations task start build

# View task logs
gitpod automations task logs installDeps
```

### Port management

```bash
# List open ports
gitpod environment port list

# Open a port manually (services do this automatically)
gitpod environment port open 3001 --name "Backend API"
gitpod environment port open 5173 --name "ValyntApp"
```

## Health checks

```bash
# Backend (Express, port 3001)
curl http://localhost:3001/health
# Expected: {"status":"healthy",...}

# Frontend (Vite, port 5173)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200

# Dependencies sentinel
ls node_modules/.modules.yaml
# Expected: file exists

# Full environment diagnostics
node scripts/dx/doctor.js
```

## Toolchain versions

All versions are pinned in `.devcontainer/versions.json` — the single source of truth.

| Tool | Canonical source | Must match |
|---|---|---|
| Node.js | `versions.json` → `node` | `.nvmrc`, `.tool-versions` |
| pnpm | `versions.json` → `pnpm` | `.tool-versions` |
| kubectl | `versions.json` → `kubectl` | `devcontainer.json` build args |
| terraform | `versions.json` → `terraform` | `devcontainer.json` build args |

When bumping a version: update `versions.json` first, then propagate to `.nvmrc`, `.tool-versions`, and `devcontainer.json` build args. Recompute the SHA256 for downloaded binaries.

## Required environment variables

Set in `ops/env/.env.backend.local`:

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key from Supabase dashboard |
| `SUPABASE_KEY` | Same value as `SUPABASE_ANON_KEY` (three files read this name) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — never expose to frontend |
| `DATABASE_URL` | Postgres connection string |
| `TCT_SECRET` | Backend fails fast if missing — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `WEB_SCRAPER_ENCRYPTION_KEY` | 32-byte hex — generate with same command |

## Devcontainer rules

- **No lifecycle hooks** — `postCreateCommand`, `onCreateCommand`, `postStartCommand` are forbidden in `devcontainer.json`. All setup runs through automations.
- **`--frozen-lockfile` always** — `pnpm install` uses `--frozen-lockfile`. Never pass `--no-frozen-lockfile` in automation. Fix the lockfile instead.
- **`turbo` and `tsx` are workspace devDependencies** — not global installs. Available after `pnpm install` via `pnpm exec turbo` / `pnpm exec tsx`.
- **SHA256 verification** — every downloaded binary is verified against a pinned SHA256 in `devcontainer.json` build args. Update both version and hash when upgrading.

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---|---|---|
| Service shows `stopped` or `failed` | Service crashed or never started | `gitpod automations service start <id>` |
| Backend crashes: `supabaseKey is required` | `SUPABASE_KEY` env var missing | Set `SUPABASE_KEY` = `SUPABASE_ANON_KEY` value |
| Backend crashes: `TCT_SECRET` missing | Required secret not set | Add `TCT_SECRET` to `ops/env/.env.backend.local` |
| `node_modules/.modules.yaml` missing | `installDeps` did not complete | `gitpod automations task start installDeps` |
| `pnpm-lock.yaml` out of sync | Lockfile diverged from `package.json` | Run `pnpm install` locally, commit updated lockfile |
| `turbo` or `tsx` not found | `node_modules` not installed | Run `pnpm install` |
| Port not accessible | Service started but port not registered | `gitpod environment port list`; services open ports automatically on start |

## Do not proceed with feature work if

- `curl http://localhost:3001/health` does not return `{"status":"healthy",...}`
- `node_modules/.modules.yaml` does not exist
- Required env vars are missing (backend will fail fast with a clear error)
