---
description: Bootstrap the cloud-dev environment for ValueOS
---

# Bootstrap cloud-dev Environment

The canonical development mode is `cloud-dev`. It uses hosted Supabase — no local Postgres, Redis, or NATS containers required.

## Prerequisites

- Access to the Supabase project dashboard
- Node.js 20.19.5 and pnpm 10.4.1 (installed by devcontainer)

## Setup

### 1. Create env files from templates

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

### 2. Fill in secrets

Open each file and replace placeholder values with real ones from the Supabase dashboard (Project Settings → API):

- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon/public key (safe for frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (backend only, never expose to frontend)
- `SUPABASE_PROJECT_REF` — project reference ID
- `DATABASE_URL` — connection string (Project Settings → Database → Connection string → URI)
- `TCT_SECRET` — any random string for local dev
- `WEB_SCRAPER_ENCRYPTION_KEY` — 32-byte hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Validate

```bash
bash scripts/validate-cloud-dev-env.sh
```

### 4. Install dependencies and start

```bash
pnpm install
pnpm run dev:backend   # port 3001
pnpm run dev:frontend  # port 5173
```

Or let the automations handle it — `installDeps` and `setupTools` run automatically on devcontainer start; `backend` and `frontend` services start on environment start.

## Verify

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"healthy",...}`

## Variable ownership

See `ops/env/README.md` for the full load order and which variables belong in which file.
