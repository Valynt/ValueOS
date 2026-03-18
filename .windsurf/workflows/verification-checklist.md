---
description: Verify cloud-dev development environment setup in ValueOS
---

# ValueOS Cloud-Dev Verification Checklist

## Prerequisites

- Hosted Supabase project (credentials from dashboard)
- Node.js version matching `.nvmrc`
- Clean git checkout
- Redis installed locally

## ✅ Setup Verification

### 1. Installation

```bash
pnpm install --no-frozen-lockfile
# Expected: packages installed successfully
```

### 2. Environment Setup

```bash
# Create environment files from templates
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev

# Expected: Files created with placeholder values
```

### 3. Redis Ready

Choose one option:

**Option A: Native Redis**

```bash
redis-server --daemonize yes --port 6379
redis-cli ping
# Expected: "PONG"
```

**Option B: Docker Redis**

```bash
docker compose -f ops/compose/compose.cloud-dev.yml up -d
redis-cli ping
# Expected: "PONG"
```

### 4. Start Development Servers

```bash
# Terminal 1 - Backend
APP_ENV=cloud-dev pnpm run dev:backend
# Expected: Server starts on port 3001

# Terminal 2 - Frontend
APP_ENV=cloud-dev pnpm run dev:frontend
# Expected: Vite dev server on port 5173
```

### 5. Supabase Connectivity

```bash
curl -s "${SUPABASE_URL}/rest/v1/" | head -1
# Expected: JSON response (not connection refused)
```

### 6. Environment Loading

```bash
grep -E "SUPABASE_URL|SUPABASE_ANON_KEY" ops/env/.env.backend.cloud-dev | head -5
# Expected: Variables set with real values
```

### 7. Service Health Checks

```bash
# Backend health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
# Expected: "200"

# Frontend accessibility
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: "200"

# Redis ready
redis-cli ping
# Expected: "PONG"
```

### 8. Validate Environment

```bash
bash scripts/validate-cloud-dev-env.sh
# Expected: "[validate] cloud-dev environment OK"
```

## Authentication Verification

### 9. Login Flow

1. Open `http://localhost:5173`
2. Sign up or sign in with Supabase Auth
3. Expected: Successful login, redirect to dashboard

### 10. Session Persistence

```bash
# After login, check API with session
curl -s -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3001/api/user/profile
# Expected: User profile data (200 response)
```

### 11. Tenant Data Access

```bash
# Access tenant-scoped endpoint
curl -s -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3001/api/tenant/projects
# Expected: Projects data (200 response, not 401/403)
```

## 🔄 Repeatable Workflow Verification

### 12. Clean Restart

**Native Redis:**

```bash
# Stop all processes
pkill -f "tsx src/server.ts" || true
pkill -f "vite" || true

# Restart
redis-server --daemonize yes --port 6379
APP_ENV=cloud-dev pnpm run dev:backend &
APP_ENV=cloud-dev pnpm run dev:frontend
# Expected: Same results as initial setup
```

**Docker Redis:**

```bash
# Stop all processes
pkill -f "tsx src/server.ts" || true
pkill -f "vite" || true

# Restart
docker compose -f ops/compose/compose.cloud-dev.yml up -d
APP_ENV=cloud-dev pnpm run dev:backend &
APP_ENV=cloud-dev pnpm run dev:frontend
# Expected: Same results as initial setup
```

### 13. Comprehensive Health Check

```bash
curl -s http://localhost:3001/health | jq .
# Expected: {"status":"healthy",...}
```

## 📋 Troubleshooting Commands

### Port Conflicts

```bash
# Check port usage
lsof -i :5173 -i :3001 -i :6379
# Force kill
pkill -f "tsx src/server.ts"
pkill -f "vite"
```

### Environment Issues

```bash
# Validate environment
bash scripts/validate-cloud-dev-env.sh

# Check current environment variables
grep -E "^[A-Z]" ops/env/.env.backend.cloud-dev | head -20
```

### Redis Issues

```bash
# Check Redis
redis-cli ping

# Restart Redis (Native)
redis-server --daemonize yes --port 6379

# Or restart Redis (Docker)
docker compose -f ops/compose/compose.cloud-dev.yml restart
```

### Supabase Issues

```bash
# Test Supabase connection
curl -s "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_ANON_KEY}" | head -1

# Verify credentials in dashboard
# Project Settings → API in Supabase dashboard
```

## ✅ Success Criteria

All of the following must pass:

1. ✅ `pnpm install --no-frozen-lockfile` succeeds without errors
2. ✅ `redis-cli ping` returns "PONG"
3. ✅ Backend starts successfully on port 3001
4. ✅ Frontend starts successfully on port 5173
5. ✅ `curl http://localhost:3001/health` returns `{"status":"healthy",...}`
6. ✅ Supabase connection responds (not connection refused)
7. ✅ Login succeeds and session persists across page refreshes
8. ✅ API calls succeed using the session JWT
9. ✅ App loads tenant-scoped data without 401/403 errors
10. ✅ `bash scripts/validate-cloud-dev-env.sh` passes

## 🚨 Failure Remediation

If any check fails:

1. **Environment Issues**: Re-run `/init` workflow to reset environment files
2. **Redis Issues (Native)**: `redis-server --daemonize yes --port 6379`
3. **Redis Issues (Docker)**: `docker compose -f ops/compose/compose.cloud-dev.yml restart`
4. **Supabase Issues**: Verify credentials in Supabase dashboard
5. **Port Conflicts**: Check for other services using ports 3001, 5173, 6379
6. **Permission Issues**: Ensure Redis/Docker and Node have proper permissions

## 📝 Notes

- Backend runs on port 3001
- Frontend on port 5173
- Redis on port 6379 (local cache only)
- Supabase is cloud-hosted (no local containers)
- All environment variables are validated by `scripts/validate-cloud-dev-env.sh`
- Uses `APP_ENV=cloud-dev` for all dev commands
