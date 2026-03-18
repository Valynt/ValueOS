---
description: Diagnose and fix development environment issues
---

# Dev Environment Troubleshooting Workflow

## Quick Diagnostics

// turbo

1. Check overall dev environment health:

```bash
pnpm run dx:doctor
```

// turbo 2. Diagnose network issues:

```bash
# Check if services are running on expected ports
curl -s http://localhost:5173 || echo "Frontend not running"
curl -s http://localhost:3001/health || echo "Backend not running"
```

// turbo 3. Test ports are available:

```bash
netstat -tlnp | grep -E ':5173|:3001|:6379' || echo "Check ports"
```

## Common Fixes

4. Auto-fix common issues:

```bash
bash scripts/cleanup.sh
```

5. Fix port conflicts:

```bash
# Kill processes on dev ports
pkill -f "tsx src/server.ts" || true
pkill -f "vite" || true
```

## Redis Issues

6. Check Redis status:

```bash
redis-cli ping
```

7. Restart Redis (choose one):

**Native Redis:**

```bash
redis-server --daemonize yes --port 6379
```

**Docker Redis:**

```bash
docker compose -f ops/compose/compose.cloud-dev.yml restart
# Or to start fresh:
docker compose -f ops/compose/compose.cloud-dev.yml down
docker compose -f ops/compose/compose.cloud-dev.yml up -d
```

8. Check Docker Redis status:

```bash
docker compose -f ops/compose/compose.cloud-dev.yml ps
docker compose -f ops/compose/compose.cloud-dev.yml logs redis
```

## Supabase Connection Issues

8. Check Supabase connectivity:

```bash
curl -s "${SUPABASE_URL}/rest/v1/" | head -1
```

9. Verify credentials in environment files:

```bash
grep -E "SUPABASE_URL|SUPABASE_ANON_KEY" ops/env/.env.backend.cloud-dev
```

## Backend Issues

10. Check backend health:

```bash
curl -s http://localhost:3001/health | jq .
```

11. Restart backend:

```bash
pkill -f "tsx src/server.ts"
APP_ENV=cloud-dev pnpm run dev:backend
```

## Frontend Issues

12. Check frontend loads:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

13. Restart frontend:

```bash
pkill -f "vite"
APP_ENV=cloud-dev pnpm run dev:frontend
```

## Nuclear Option

14. Full cleanup and restart:

**Native Redis:**

```bash
bash scripts/cleanup.sh
pnpm install --no-frozen-lockfile
redis-server --daemonize yes --port 6379
APP_ENV=cloud-dev pnpm run dev:backend &
APP_ENV=cloud-dev pnpm run dev:frontend
```

**Docker Redis:**

```bash
bash scripts/cleanup.sh
pnpm install --no-frozen-lockfile
docker compose -f ops/compose/compose.cloud-dev.yml up -d
APP_ENV=cloud-dev pnpm run dev:backend &
APP_ENV=cloud-dev pnpm run dev:frontend
```

## Environment Variables

15. Verify env vars are set:

```bash
grep -E "^[A-Z]" ops/env/.env.backend.cloud-dev | head -20
```
