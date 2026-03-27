# Cloud-Dev Setup (Gitpod/Ona)

This document describes the cloud-based development setup using Gitpod or Ona with external Supabase. This is an **alternative** to the recommended [DevContainer](../.devcontainer/README.md) setup.

## When to Use This Setup

- You prefer using cloud Supabase instead of local containerized PostgreSQL
- Your team already has a shared Supabase project for development
- You need to collaborate on a shared database instance
- You have limited local resources (RAM < 8GB)

## Prerequisites

- Node.js >= 20.19.0 (installed via nvm or system package manager)
- pnpm >= 9.15.0 (`npm install -g pnpm`)
- A Gitpod/Ona cloud-dev environment OR local machine with above tools

## Quickstart

### One command (first time)

```bash
pnpm dev:bootstrap
```

This runs `dev:init` followed by `dev:up`. It copies env templates, generates
local secrets, installs dependencies, validates the environment, runs database
migrations, and starts both backend and frontend.

> **Before running**, you must fill in your Supabase credentials — see
> [Required Credentials](#required-credentials) below.

### Daily startup

```bash
pnpm dev:up
```

Validates the env, checks DB connectivity, and launches backend + frontend
together. If running in Gitpod/Ona, set `WORKSPACE_HOST` and the script
derives `FRONTEND_ORIGIN`, `BACKEND_ORIGIN`, `CORS_ALLOWED_ORIGINS`, and
`API_BASE_URL` automatically.

### Reset / reseed

```bash
pnpm dev:reset
```

Re-runs migrations, clears local caches (`.dx-lock`, Vite cache), and
restarts services.

### Command reference

| Command              | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm dev:init`      | One-time bootstrap (env copy, secret gen, deps, validate, migrate) |
| `pnpm dev:up`        | Daily startup (validate, connect check, launch services)           |
| `pnpm dev:reset`     | Re-migrate, clear caches, restart                                  |
| `pnpm dev:bootstrap` | `dev:init && dev:up` — full first-time flow                        |

### Required Credentials

Before running `dev:init` or `dev:bootstrap`, fill in your Supabase project
values. The init script copies template files automatically, but you still
need to provide the real credentials:

1. Open your **Supabase Dashboard → Project Settings → API**
2. Edit the env files created by `dev:init`:

| File                              | Variables to fill                                           |
| --------------------------------- | ----------------------------------------------------------- |
| `ops/env/.env.cloud-dev`          | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF` |
| `ops/env/.env.backend.cloud-dev`  | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL` |
| `ops/env/.env.frontend.cloud-dev` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`                         |

`TCT_SECRET` and `WEB_SCRAPER_ENCRYPTION_KEY` are generated automatically if
missing.

### Manual step-by-step (alternative)

<details>
<summary>Expand if you prefer to run each step individually</summary>

#### 1. Copy env templates

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

#### 2. Fill in Supabase credentials (see table above)

#### 3. Validate environment

```bash
bash scripts/validate-cloud-dev-env.sh
```

#### 4. Install dependencies

```bash
pnpm install
```

#### 5. Apply database migrations

```bash
pnpm run db:migrate
```

#### 6. Start services

```bash
pnpm run dev:frontend   # Terminal 1 — React + Vite on port 5173
pnpm run dev:backend    # Terminal 2 — Express API on port 3001
```

</details>

## Environment Variable Reference

See [ops/env/README.md](../../ops/env/README.md) for the full variable reference and load order.

### Required Variables

| Variable                    | Source                                         | Purpose                     |
| --------------------------- | ---------------------------------------------- | --------------------------- |
| `SUPABASE_URL`              | Supabase Dashboard → API → Project URL         | Database and auth endpoint  |
| `SUPABASE_ANON_KEY`         | Supabase Dashboard → API → anon public         | Frontend authentication     |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role secret | Backend admin access        |
| `SUPABASE_KEY`              | Same as `SUPABASE_SERVICE_ROLE_KEY`            | Backend compatibility alias |

### Optional Variables

| Variable    | Default | Purpose                                              |
| ----------- | ------- | ---------------------------------------------------- |
| `REDIS_URL` | (none)  | Caching and queues (app degrades gracefully without) |
| `NATS_URL`  | (none)  | Messaging (app degrades gracefully without)          |

## Troubleshooting

### "Required variable X is missing"

Run the validation script to check which variables are missing:

```bash
bash scripts/validate-cloud-dev-env.sh
```

### Database connection errors

Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct and the Supabase project is active.

### Port conflicts

Edit `ops/env/.env.frontend.cloud-dev` to change ports:

```bash
FRONTEND_PORT=5174
BACKEND_PORT=3002
```

## Migration from Cloud-Dev to DevContainer

If you want to switch to the fully containerized setup:

1. Back up your cloud-dev env files:

   ```bash
   mv ops/env/.env.cloud-dev ops/env/.env.cloud-dev.backup
   ```

2. Follow the [DevContainer quickstart](../.devcontainer/README.md)

3. The DevContainer uses local PostgreSQL/Redis instead of cloud Supabase

## Comparison: Cloud-Dev vs DevContainer

| Aspect            | Cloud-Dev             | DevContainer            |
| ----------------- | --------------------- | ----------------------- |
| Database          | Cloud Supabase        | Local PostgreSQL        |
| Redis             | Optional cloud        | Local container         |
| Setup time        | ~5 min (env setup)    | ~10 min (first build)   |
| Offline work      | No                    | Yes                     |
| Team sharing      | Shared DB per project | Isolated per developer  |
| Resource usage    | Lower local RAM       | 8GB+ RAM recommended    |
| Production parity | Close                 | Exact (same containers) |

## Support

For issues with the DevContainer setup, see [.devcontainer/DEVCONTAINER-TROUBLESHOOTING.md](../.devcontainer/DEVCONTAINER-TROUBLESHOOTING.md).

For cloud-dev specific issues, check [ops/env/README.md](../../ops/env/README.md).
