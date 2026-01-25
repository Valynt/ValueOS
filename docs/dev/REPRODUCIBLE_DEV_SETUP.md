# ValueOS Reproducible Development Environment Setup

**Last Updated**: 2026-01-15
**Environment**: GitHub Codespaces / VS Code DevContainer
**Target OS**: Linux (Debian-based container)

---

## Prerequisites

### Required Software

- **Docker Desktop**: v24.0+ (for local) or GitHub Codespaces
- **Node.js**: v20.x (specified in `.nvmrc`)
- **Git**: v2.40+

### Environment Assumptions

- Clean checkout of `main` branch
- No existing containers or volumes
- Ports 3001, 5173, 6379, 54321-54329 available

---

## Step 1: Clone and Install Dependencies

### 1.1 Clone Repository

```bash
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS
git checkout main
```

**Expected Output**:

```
Already on 'main'
Your branch is up to date with 'origin/main'.
```

### 1.2 Install Node Dependencies

```bash
npm install
```

**Expected Output**:

```
added X packages in Ys
```

**Determinism**: `pnpm-lock.yaml` ensures exact versions.

---

## Step 2: Environment Configuration

### 2.1 Generate Development Environment Files

```bash
pnpm run env:dev
```

**Expected Output**:

```
🔧 Setting up development environment...
✓ Wrote /workspaces/ValueOS/.env.local for mode: local
✓ Wrote /workspaces/ValueOS/.env.ports
✓ Wrote /workspaces/ValueOS/deploy/envs/.env.ports

Environment configured for mode: local

URLs configured:
  Frontend: http://localhost:5173
  Backend:  http://localhost:3001
  Supabase: http://localhost:54321
```

**Generated Files**:

- `.env.local` - Application runtime configuration
- `.env.ports` - Port mappings
- `deploy/envs/.env.ports` - Container environment (includes Supabase keys)

**Key Environment Variables** (in `.env.local`):

```bash
DX_MODE=local
NODE_ENV=development
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres
REDIS_URL=redis://localhost:6379
```

**Determinism**:

- No timestamps in generated files
- Fixed Supabase demo keys (safe for local dev)
- Ports from `config/ports.json`

---

## Step 3: Start Infrastructure Services

### 3.1 Start Docker Dependencies

```bash
docker compose --env-file .env.ports -f docker-compose.deps.yml up -d
```

**Expected Output**:

```
[+] Running 2/2
 ✔ Container valueos-postgres  Started
 ✔ Container valueos-redis     Started
```

**Verify**:

```bash
docker ps --filter name=valueos --format "table {{.Names}}\t{{.Status}}"
```

**Expected**:

```
NAMES              STATUS
valueos-postgres   Up X seconds (healthy)
valueos-redis      Up X seconds (healthy)
```

### 3.2 Start Supabase Local Stack

```bash
npx supabase stop --no-backup  # Clean any previous state
npx supabase start
```

**Expected Output**:

```
Starting database...
Starting containers...
Waiting for health checks...

╭──────────────────────────────────────╮
│ 🔧 Development Tools                 │
├─────────┬────────────────────────────┤
│ Studio  │ http://127.0.0.1:54323     │
│ Mailpit │ http://127.0.0.1:54324     │
╰─────────┴────────────────────────────╯

╭─────────────────────────────────────────────────╮
│ 🌐 APIs                                         │
├─────────────┬───────────────────────────────────┤
│ Project URL │ http://127.0.0.1:54321            │
│ REST        │ http://127.0.0.1:54321/rest/v1    │
╰─────────────┴───────────────────────────────────╯

╭───────────────────────────────────────────────────────────────╮
│ ⛁ Database                                                    │
├─────┬─────────────────────────────────────────────────────────┤
│ URL │ postgresql://postgres:postgres@127.0.0.1:54329/postgres │
╰─────┴─────────────────────────────────────────────────────────╯
```

**Verify**:

```bash
docker ps --filter name=supabase --format "table {{.Names}}\t{{.Status}}"
```

**Expected**: 12 containers running (db, kong, auth, rest, realtime, storage, etc.)

**Note**: Database port is `54329` (not default `54322`) to avoid conflicts.

---

## Step 4: Database Migrations

### 4.1 Apply Migrations

```bash
npx supabase db push
```

**Expected Output**:

```
Applying migration X...
Applying migration Y...
Finished supabase db push.
```

### 4.2 Verify Schema

```bash
npx supabase migration list
```

**Expected**: All migrations show as "applied"

### 4.3 Generate TypeScript Types

```bash
pnpm run db:types
```

**Expected Output**:

```
Generating types...
supabase gen types typescript --local > src/types/supabase.ts
```

**Determinism**: Types generated from current schema state.

---

## Step 5: Seed Database with Demo User

### 5.1 Create Demo User

```bash
npm run seed:demo
```

**Expected Output**:

```
Demo data seeded successfully!

Login credentials:
  Email: demouser@valynt.com
  Password: passord
  Role: admin
```

**Determinism**:

- Fixed email/password
- Idempotent (can run multiple times)

---

## Step 6: Start Application Services

### 6.1 Start Backend

```bash
npm run backend:dev &
```

**Expected Output**:

```
[Environment] Configuration loaded for development (redacted)
[INFO] Rate limit store using Redis
[INFO] Backend server listening on port 3001
```

**Verify**:

```bash
curl http://127.0.0.1:3001/health
```

**Expected**:

```json
{ "status": "ok" }
```

### 6.2 Start Frontend

```bash
npm run dev
```

**Expected Output**:

```
VITE v6.4.1  ready in XXX ms

➜  Local:   http://127.0.0.1:5173/
```

---

## Step 7: Verify Services

### 7.1 Check All Services

```bash
# Postgres
docker exec valueos-postgres pg_isready -U postgres
# Expected: "accepting connections"

# Redis
docker exec valueos-redis redis-cli ping
# Expected: "PONG"

# Supabase API
curl -s http://127.0.0.1:54321/rest/v1/ | head -1
# Expected: JSON response (may be 401 without apikey - that's OK)

# Backend
curl http://127.0.0.1:3001/health
# Expected: {"status":"ok"}

# Frontend
curl -I http://127.0.0.1:5173/
# Expected: HTTP/1.1 200 OK
```

---

## Step 8: Authentication Flow

### 8.1 Access Application

Open browser to: `http://localhost:5173`

**Expected**: Login page displays

### 8.2 Login with Demo User

```
Email: demouser@valynt.com
Password: passord
```

**Expected**:

- Successful authentication
- Redirect to dashboard
- Session cookie set
- JWT token stored

### 8.3 Verify Session

Check browser DevTools > Application > Cookies:

```
supabase-auth-token: <JWT>
```

Check browser DevTools > Console:

```
[StartupStatus] Development mode - skipping dependency checks
```

---

## Step 9: Application Navigation

### 9.1 Dashboard

**URL**: `http://localhost:5173/`
**Expected**: Dashboard with navigation, user profile

### 9.2 Projects/Value Cases

**URL**: `http://localhost:5173/projects`
**Expected**: List of value cases (may be empty initially)

### 9.3 Settings

**URL**: `http://localhost:5173/settings`
**Expected**: User settings page

---

## Known DevContainer-Specific Issues

### Issue 1: Port Forwarding Delays

**Symptom**: `Connection refused` errors despite containers running
**Cause**: VS Code port forwarding takes time to activate
**Solution**: Wait 5-10 seconds after starting services

### Issue 2: IPv6 vs IPv4 Binding

**Symptom**: Services bind to `:::PORT` but `localhost` resolves to `127.0.0.1`
**Solution**: All configs now use `127.0.0.1` explicitly

### Issue 3: WebSocket HMR

**Symptom**: `WebSocket closed without opened` errors
**Solution**: HMR disabled in DevContainer (set `hmr: false` in vite.config.ts)

### Issue 4: Dependency Health Checks

**Symptom**: App hangs on loading screen
**Solution**: Startup dependency checks skip in development mode

---

## Deterministic Guarantees

### Fixed Inputs

- **Node version**: Locked via `.nvmrc` (v20.x)
- **Dependencies**: Locked via `pnpm-lock.yaml`
- **Supabase keys**: Fixed demo keys in `env-compiler.js`
- **Database schema**: Versioned migrations in `supabase/migrations/`
- **Ports**: Centralized in `config/ports.json`

### No Timestamps

- `.env.local` generation: Timestamp removed
- `.dx-lock` files: Timestamps present but not used for logic
- Build artifacts: Not committed

### Idempotent Operations

- `pnpm run env:dev`: Overwrites existing files
- `npm run seed:demo`: Uses `ON CONFLICT` to avoid duplicates
- `npx supabase db push`: Skips already-applied migrations

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker logs valueos-postgres
docker logs valueos-redis

# Verify env file
grep SUPABASE_SERVICE_ROLE_KEY .env.local
# Should show: SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Restart
pkill -9 -f "tsx watch"
npm run backend:dev
```

### Frontend Hangs

```bash
# Check if dependency checks are skipped
# Browser console should show:
# [StartupStatus] Development mode - skipping dependency checks

# If not, verify vite.config.ts has:
# server: { host: "127.0.0.1" }
```

### Supabase Connection Issues

```bash
# Verify containers
docker ps --filter name=supabase

# Check port binding
docker port supabase_kong_ValueOS
# Expected: 8000/tcp -> 0.0.0.0:54321

# Restart Supabase
npx supabase stop --no-backup
npx supabase start
```

---

## Complete Automated Setup Script

```bash
#!/bin/bash
set -e

echo "=== ValueOS Reproducible Dev Setup ==="

# 1. Install dependencies
npm install

# 2. Generate environment
pnpm run env:dev

# 3. Start Docker deps
docker compose --env-file .env.ports -f docker-compose.deps.yml up -d

# 4. Start Supabase
npx supabase stop --no-backup || true
npx supabase start

# 5. Apply migrations
npx supabase db push

# 6. Generate types
pnpm run db:types

# 7. Seed demo user
npm run seed:demo

# 8. Start backend (background)
npm run backend:dev &
BACKEND_PID=$!

# Wait for backend
sleep 5
curl --retry 5 --retry-delay 2 http://127.0.0.1:3001/health

# 9. Start frontend (foreground)
echo "=== All services ready ==="
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:3001"
echo "Supabase Studio: http://localhost:54323"
echo ""
echo "Demo credentials:"
echo "  Email: demouser@valynt.com"
echo "  Password: passord"
echo ""
npm run dev
```

**Save as**: `scripts/setup-dev-clean.sh`

**Run**:

```bash
bash scripts/setup-dev-clean.sh
```

---

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `.env.local` exists and contains `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Docker containers running: `valueos-postgres`, `valueos-redis`
- [ ] Supabase containers: 12 total, all healthy
- [ ] `curl http://127.0.0.1:3001/health` returns `{"status":"ok"}`
- [ ] `curl http://127.0.0.1:5173/` returns HTML
- [ ] Browser loads `http://localhost:5173` without hanging
- [ ] Login with `demouser@valynt.com` / `passord` succeeds
- [ ] Dashboard displays after login

---

## Current Known Limitations in DevContainer

1. **Redis/Postgres connectivity from backend**: Connection warnings appear but services work via port forwarding
2. **HMR disabled**: Manual browser refresh required after code changes
3. **Health checks skipped**: Startup dependency checks bypass in dev mode
4. **Port forwarding delays**: Initial connections may take 5-10 seconds

These are DevContainer networking constraints, not application bugs.

---

## Production Differences

In production environments (non-DevContainer):

- HMR enabled with WebSocket on port 24678
- Dependency health checks run on startup
- Direct localhost connectivity (no port forwarding)
- All services use `0.0.0.0` binding

---

## Configuration Files Reference

### `config/ports.json`

Single source of truth for all port assignments.

### `scripts/dx/env-compiler.js`

Generates `.env.local` with mode-specific URLs.

### `supabase/config.toml`

Supabase local dev configuration:

- API port: `54321`
- DB port: `54329` (changed from default `54322` to avoid conflicts)
- Studio port: `54323`

### `.config/configs/vite.config.ts`

Frontend dev server configuration:

- Host: `127.0.0.1` (IPv4 only in DevContainer)
- Port: `5173`
- HMR: Disabled in DevContainer
- Proxy: `/api` → `http://127.0.0.1:3001`

---

## Demo User Details

**Created by**: `npm run seed:demo`
**Script**: `scripts/seed-demo-user.ts`

**Credentials**:

```
Email: demouser@valynt.com
Password: passord
Role: admin
Tenant: Default Organization
```

**Permissions**: Full access to all features

**Idempotency**: Script uses `ON CONFLICT DO NOTHING` to prevent duplicates.

---

## End-to-End Verification

After completing all steps, verify the complete flow:

1. **Open**: `http://localhost:5173`
2. **Login**: Use demo credentials
3. **Navigate**: Dashboard → Projects → Settings
4. **API Test**: Browser DevTools Network tab should show successful `/api/*` requests
5. **Database**: Supabase Studio at `http://localhost:54323` should show tables

**Success Criteria**: No 500 errors, no connection refused, session persists across page refreshes.

---

## Cleanup / Reset

To start fresh:

```bash
# Stop all services
pnpm run dx:down
npx supabase stop --no-backup

# Remove containers and volumes
docker compose -f docker-compose.deps.yml down -v
docker rm -f $(docker ps -a --filter name=supabase --format "{{.Names}}")

# Clean generated files
rm -f .env.local .env.ports deploy/envs/.env.ports
rm -rf supabase/.temp

# Re-run setup
bash scripts/setup-dev-clean.sh
```

---

## Summary

This setup is **reproducible** because:

- All dependencies locked (npm, Docker images)
- No manual configuration required
- Fixed demo credentials
- Deterministic port assignments
- No timestamps in generated configs
- Idempotent operations (can re-run safely)

The only **nondeterministic** elements:

- Container startup order (handled by health checks)
- DevContainer port forwarding timing (handled by retries/delays)
- Redis connection timing (handled by reconnection logic)

All nondeterminism is **handled** by the application layer and doesn't affect reproducibility.
