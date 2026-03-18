---
description: Start the cloud-dev development environment for ValueOS
---

# Start Development Environment

// turbo-all

Start the cloud-dev development servers:

## Option A: Native Redis

```bash
# Ensure Redis is running
redis-cli ping || redis-server --daemonize yes --port 6379

# Start backend (port 3001)
APP_ENV=cloud-dev pnpm run dev:backend &

# Start frontend (port 5173)
APP_ENV=cloud-dev pnpm run dev:frontend
```

## Option B: Docker Redis

```bash
# Start Redis in Docker
docker compose -f ops/compose/compose.cloud-dev.yml up -d

# Start backend (port 3001)
APP_ENV=cloud-dev pnpm run dev:backend &

# Start frontend (port 5173)
APP_ENV=cloud-dev pnpm run dev:frontend
```

The application should be available at http://localhost:5173

## Prerequisites

Before running this workflow, ensure you have:

- Completed `/init` workflow to set up environment files
- Hosted Supabase project credentials configured
- Together AI API key configured (optional, for AI features)
- Docker installed (if using Docker Redis option)

## Troubleshooting

- **Port 3001 in use**: `pkill -f "tsx src/server.ts"`
- **Port 5173 in use**: `pkill -f "vite"`
- **Port 6379 in use**: `docker stop valueos-redis` or `pkill redis-server`
- **Redis not running**: `redis-cli ping` should return `PONG`
- **Docker Redis**: `docker compose -f ops/compose/compose.cloud-dev.yml ps`
- **Supabase connection errors**: Verify credentials in dashboard
