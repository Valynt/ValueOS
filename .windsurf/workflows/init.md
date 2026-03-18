---
description: Initialize Cascade for ValueOS cloud-dev development
---

# Initialize ValueOS (Cloud-Dev Mode)

This workflow sets up the canonical cloud-dev development environment using hosted Supabase. No local Docker containers required.

## Prerequisites

- Hosted Supabase project (get credentials from dashboard)
- Node.js 20.19.5 and pnpm 10.4.1 (pre-installed in devcontainer)
- Together AI API key (for AI features)

## Setup Steps

### 1. Install Dependencies

// turbo

```bash
pnpm install --no-frozen-lockfile
```

### 2. Create Environment Files

```bash
# Create cloud-dev environment files from templates
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

### 3. Fill in Supabase Credentials

Get values from Supabase dashboard → Project Settings → API:

**ops/env/.env.cloud-dev:**

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=your-project-ref
```

**ops/env/.env.backend.cloud-dev:**

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_KEY=your-anon-key
DATABASE_URL=postgresql://postgres.your-project-ref:your-db-password@aws-0-your-region.pooler.supabase.com:6543/postgres
TCT_SECRET=your-generated-secret
WEB_SCRAPER_ENCRYPTION_KEY=your-generated-32-byte-hex-key
REDIS_URL=redis://localhost:6379
TOGETHER_API_KEY=your-together-api-key
```

**ops/env/.env.frontend.cloud-dev:**

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=your-project-ref
```

### 4. Generate Required Secrets

```bash
# Generate TCT_SECRET and WEB_SCRAPER_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Start Redis (Local Cache)

Choose one option:

**Option A: Native Redis (Recommended)**

```bash
# Install and start Redis
sudo apt-get update && sudo apt-get install -y redis-server
redis-server --daemonize yes --port 6379
```

**Option B: Docker Redis**

```bash
# Start Redis in Docker (Supabase stays cloud-hosted)
docker compose -f ops/compose/compose.cloud-dev.yml up -d
```

### 6. Validate Environment

// turbo

```bash
bash scripts/validate-cloud-dev-env.sh
```

Expected output: `[validate] cloud-dev environment OK`

### 7. Start Development Servers

Terminal 1 - Backend:

```bash
APP_ENV=cloud-dev pnpm run dev:backend
```

Terminal 2 - Frontend:

```bash
APP_ENV=cloud-dev pnpm run dev:frontend
```

### 8. Verify Setup

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"healthy",...}`

## Quick Start (One Command)

After initial setup, restart everything:

**Native Redis:**

```bash
redis-server --daemonize yes --port 6379 && \
APP_ENV=cloud-dev pnpm run dev:backend & \
APP_ENV=cloud-dev pnpm run dev:frontend
```

**Docker Redis:**

```bash
docker compose -f ops/compose/compose.cloud-dev.yml up -d && \
APP_ENV=cloud-dev pnpm run dev:backend & \
APP_ENV=cloud-dev pnpm run dev:frontend
```

## Troubleshooting

- **Port 3001 in use**: `pkill -f "tsx src/server.ts"`
- **Port 5173 in use**: `pkill -f "vite"`
- **Port 6379 in use**: `docker stop valueos-redis` or `pkill redis-server`
- **Redis not running**: `redis-cli ping` should return `PONG`
- **Docker Redis**: `docker-compose -f ops/compose/compose.cloud-dev.yml ps`
- **Supabase connection errors**: Verify credentials in dashboard
- **Together AI 401**: Verify API key at https://api.together.xyz/settings/api-keys

## Environment Files Reference

| File                              | Purpose       | Secrets                        |
| --------------------------------- | ------------- | ------------------------------ |
| `ops/env/.env.cloud-dev`          | Shared config | Anon key, project ref          |
| `ops/env/.env.backend.cloud-dev`  | Backend only  | Service role, DB URL, API keys |
| `ops/env/.env.frontend.cloud-dev` | Frontend only | Anon key only                  |

## What We Set Up

- ✅ **Backend**: Express API on port 3001
- ✅ **Frontend**: Vite React on port 5173
- ✅ **Database**: Hosted Supabase Postgres
- ✅ **Auth**: Supabase Auth with JWT
- ✅ **Cache**: Local Redis (port 6379)
- ✅ **AI**: Together AI integration
- ✅ **Feature Flags**: Using safe defaults for dev
