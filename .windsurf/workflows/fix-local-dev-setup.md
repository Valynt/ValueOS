---
description: Bootstrap the cloud-dev environment for ValueOS
---

# Bootstrap cloud-dev Environment

The canonical development mode is `cloud-dev`. It uses hosted Supabase — no local Postgres or NATS containers required.

## Prerequisites

- Access to the Supabase project dashboard
- Node.js 20.19.5 and pnpm 10.4.1 (installed by devcontainer)
- Together AI API key (optional, for AI features)

## Setup

### 1. Install dependencies

```bash
pnpm install --no-frozen-lockfile
```

### 2. Create env files from templates

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

### 3. Fill in secrets

Open each file and replace placeholder values with real ones from the Supabase dashboard (Project Settings → API):

- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon/public key (safe for frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (backend only, never expose to frontend)
- `SUPABASE_PROJECT_REF` — project reference ID
- `DATABASE_URL` — connection string (Project Settings → Database → Connection string → URI)
- `TCT_SECRET` — any random string for local dev
- `WEB_SCRAPER_ENCRYPTION_KEY` — 32-byte hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `TOGETHER_API_KEY` — Together AI API key (optional)
- `REDIS_URL=redis://localhost:6379` — local Redis cache

### 4. Start Redis (Local Cache)

Choose one option:

**Option A: Native Redis**

```bash
sudo apt-get update && sudo apt-get install -y redis-server
redis-server --daemonize yes --port 6379
```

**Option B: Docker Redis**

```bash
docker compose -f ops/compose/compose.cloud-dev.yml up -d
```

### 5. Validate

```bash
bash scripts/validate-cloud-dev-env.sh
```

Expected output: `[validate] cloud-dev environment OK`

### 6. Start development servers

Terminal 1 - Backend:

```bash
APP_ENV=cloud-dev pnpm run dev:backend
```

Terminal 2 - Frontend:

```bash
APP_ENV=cloud-dev pnpm run dev:frontend
```

## Verify

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"healthy",...}`

## Troubleshooting

- **Port 3001 in use**: `pkill -f "tsx src/server.ts"`
- **Port 5173 in use**: `pkill -f "vite"`
- **Port 6379 in use**: `docker stop valueos-redis` or `pkill redis-server`
- **Redis not running**: `redis-cli ping` should return `PONG`
- **Docker Redis**: `docker compose -f ops/compose/compose.cloud-dev.yml ps`
- **Supabase connection errors**: Verify credentials in dashboard

## Variable ownership

See `ops/env/README.md` for the full load order and which variables belong in which file.
