# DX Troubleshooting Guide

## Error Codes Reference

### DX_ERR_001: Missing Observability Module

<<<<<<< Updated upstream
**Symptoms:**

- Backend crashes with `ERR_MODULE_NOT_FOUND` for `../lib/observability`

**Root Cause:**

Code imports from `../lib/observability` but the directory or `index.ts` file doesn't exist.

**Fix:**
=======
Symptoms:

- Backend crashes with `ERR_MODULE_NOT_FOUND` for `../lib/observability`

Root Cause:

Code imports from `../lib/observability` but the directory or `index.ts` file doesn't exist.

Fix:
>>>>>>> Stashed changes

```bash
# Validate all imports
pnpm run dx:validate-imports

# Create missing module (if needed)
mkdir -p packages/backend/src/lib/observability
# Add observability/index.ts with required exports
```

<<<<<<< Updated upstream
**Prevention:** Import validation runs in CI via `.github/workflows/dx-e2e.yml`.

### DX_ERR_002: Port Conflict Detected

**Symptoms:**
=======
Prevention: Import validation runs in CI via `.github/workflows/dx-e2e.yml`.

---

### DX_ERR_002: Port Conflict Detected

Symptoms:
>>>>>>> Stashed changes

- DX startup fails with "address already in use"
- Services can't bind to required ports (3001, 5173, 5432, 6379, 54321-54323)

<<<<<<< Updated upstream
**Root Cause:**

Another process is using a required port.

**Fix:**
=======
Root Cause:

Another process is using a required port.

Fix:
>>>>>>> Stashed changes

```bash
# Find process using port (replace PORT with actual number)
lsof -ti:PORT

# Kill the process
lsof -ti:PORT | xargs kill -9

# Or use the sanitize script
pnpm run dx:sanitize
```

<<<<<<< Updated upstream
**Prevention:** Run `pnpm run dx:sanitize` before starting DX.

### DX_ERR_003: Backend Health Check Failed

**Symptoms:**
=======
Prevention: Run `pnpm run dx:sanitize` before starting DX.

---

### DX_ERR_003: Backend Health Check Failed

Symptoms:
>>>>>>> Stashed changes

- Backend starts but health endpoint returns 500 or doesn't respond
- Frontend can't connect to backend API

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- Database connection failed
- Missing environment variables
- Module import errors
- Unhandled exceptions in startup code

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Check backend logs
tail -f /tmp/dx-backend.log

# Check trace log
cat .dx-trace.log | grep ERROR

# Verify environment
cat .env.local | grep DATABASE_URL

# Test backend directly
curl -v http://localhost:3001/health
```

<<<<<<< Updated upstream
**Prevention:** Module contract tests in `packages/backend/src/__tests__/module-contracts.test.ts`.

### DX_ERR_004: Database Connection Refused

**Symptoms:**
=======
Prevention: Module contract tests in `packages/backend/src/__tests__/module-contracts.test.ts`.

---

### DX_ERR_004: Database Connection Refused

Symptoms:
>>>>>>> Stashed changes

- Migrations fail with "connection refused"
- Backend can't connect to Postgres

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- Postgres container not running
- Wrong host/port in DATABASE_URL
- Container network issue in DevContainer

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Check if postgres is running
docker ps | grep postgres

# Check postgres logs
docker logs valueos-postgres

# Restart postgres
docker compose -f ops/compose/core.yml up -d postgres

# Test connection
PGPASSWORD=dev_password psql -h localhost -p 5432 -U postgres -d valuecanvas_dev -c 'SELECT 1'
```
<<<<<<< Updated upstream
=======

Prevention: Orchestrator checks Docker availability in preflight.
>>>>>>> Stashed changes

**Prevention:** Orchestrator checks Docker availability in preflight.

### DX_ERR_005: Supabase DB Port Binding Failed

<<<<<<< Updated upstream
**Symptoms:**
=======
Symptoms:
>>>>>>> Stashed changes

- `supabase start` fails with "dial tcp 127.0.0.1:54322: connect: connection refused"
- Supabase Kong container is not running

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- Port 54322 already in use
- Supabase DB container failed to start
- Race condition in healthcheck

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Kill process on 54322
lsof -ti:54322 | xargs kill -9

# Hard reset Supabase
cd infra/supabase
supabase stop --workdir . || true
docker compose -f docker-compose.yml down -v --remove-orphans
supabase start --workdir . --debug

# Check Supabase status
supabase status --workdir infra/supabase
```

<<<<<<< Updated upstream
**Prevention:** DX falls back to `valueos-postgres` if Supabase fails.

### DX_ERR_006: Migration TLS Error

**Symptoms:**
=======
Prevention: DX falls back to `valueos-postgres` if Supabase fails.

---

### DX_ERR_006: Migration TLS Error

Symptoms:
>>>>>>> Stashed changes

- `supabase db push` fails with "tls error (server refused TLS connection)"
- Migrations work on one environment but not another

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- Postgres container doesn't support TLS
- Connection string has conflicting SSL parameters
- Client is attempting TLS despite `sslmode=disable`

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Force disable TLS
export PGSSLMODE=disable

# Run migrations with explicit sslmode
supabase db push \
  --workdir infra/supabase \
  --db-url "postgresql://postgres:dev_password@localhost:5432/valuecanvas_dev?sslmode=disable" \
  --debug
```

<<<<<<< Updated upstream
**Prevention:** Orchestrator removes invalid SSL params from connection strings.

### DX_ERR_007: Module Not Found at Runtime

**Symptoms:**
=======
Prevention: Orchestrator removes invalid SSL params from connection strings.

---

### DX_ERR_007: Module Not Found at Runtime

Symptoms:
>>>>>>> Stashed changes

- `ERR_MODULE_NOT_FOUND` at runtime
- Import path looks correct but Node can't resolve it

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- File doesn't exist at import path
- Casing mismatch (Linux is case-sensitive)
- Missing `.js` extension in ESM import
- Directory import without `index.ts`

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Validate all imports
pnpm run dx:validate-imports

# Check file exists (note: case-sensitive)
ls -la packages/backend/src/lib/observability

# For ESM, add .js extension to imports
# ✅ import { foo } from './lib/bar.js'
```

<<<<<<< Updated upstream
**Prevention:** Import resolution tests run in CI.

### DX_ERR_008: Docker Not Available

**Symptoms:**

- "Cannot connect to Docker daemon"
- "docker: command not found"

**Root Cause:**
=======
Prevention: Import resolution tests run in CI.

---

### DX_ERR_008: Docker Not Available

Symptoms:

- "Cannot connect to Docker daemon"
- "docker: command not found"

Root Cause:
>>>>>>> Stashed changes

- Docker Desktop not running
- Docker socket not accessible
- User not in `docker` group (Linux)

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Start Docker Desktop (macOS/Windows)
open -a Docker

# Check Docker status (Linux)
sudo systemctl status docker

# Add user to docker group (Linux, requires logout)
sudo usermod -aG docker $USER

# Test Docker
docker ps
```

<<<<<<< Updated upstream
**Prevention:** Orchestrator checks Docker availability in preflight.

### DX_ERR_009: Environment Variable Not Set

**Symptoms:**
=======
Prevention: Orchestrator checks Docker availability in preflight.

---

### DX_ERR_009: Environment Variable Not Set

Symptoms:
>>>>>>> Stashed changes

- Services fail with "env var not set" errors
- Database URL is undefined

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- `.env.local` file missing or incomplete
- Environment not regenerated after changes

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Regenerate environment
pnpm run dx:env

# Validate environment
pnpm run dx:env:validate

# Check generated file
cat .env.local
```

<<<<<<< Updated upstream
**Prevention:** Setup script generates `.env.local` automatically.

### DX_ERR_010: Supabase Containers Not Running

**Symptoms:**
=======
Prevention: Setup script generates `.env.local` automatically.

---

### DX_ERR_010: Supabase Containers Not Running

Symptoms:
>>>>>>> Stashed changes

- Supabase API unreachable
- Kong container status shows "Exited"

<<<<<<< Updated upstream
**Root Cause:**
=======
Root Cause:
>>>>>>> Stashed changes

- Container startup failure
- Healthcheck timeout
- Volume corruption

<<<<<<< Updated upstream
**Fix:**
=======
Fix:
>>>>>>> Stashed changes

```bash
# Check container status
docker ps -a | grep supabase

# View logs
docker compose -f infra/supabase/docker-compose.yml logs --tail=100

# Hard reset (WARNING: deletes local data)
cd infra/supabase
supabase stop --workdir . || true
docker compose -f docker-compose.yml down -v --remove-orphans
docker volume prune -f
supabase start --workdir . --debug
```

<<<<<<< Updated upstream
**Prevention:** Orchestrator provides structured error output with context.
=======
Prevention: Orchestrator provides structured error output with context.

---
>>>>>>> Stashed changes

## General Debugging Steps

1. Check Trace Log

```bash
# View execution trace
cat .dx-trace.log | jq '.'

# Filter errors only
cat .dx-trace.log | jq 'select(.level == "ERROR")'
```

2. Sanitize Environment

```bash
# Clean state and check ports
pnpm run dx:sanitize

# Force clean (stops containers)
pnpm run dx:sanitize:force
```

3. Validate Imports

```bash
# Check all backend imports resolve
pnpm run dx:validate-imports
```

4. Run Tests

```bash
# Module contract tests
pnpm test packages/backend/src/__tests__/module-contracts.test.ts

# Import resolution tests
pnpm test packages/backend/src/__tests__/import-resolution.test.ts
```

5. Check Checkpoints

```bash
# View last checkpoint (shows where failure occurred)
cat .dx-checkpoints.json | jq '.[-1]'
```

## Getting Help

<<<<<<< Updated upstream
If these steps don't resolve your issue:

1. Collect diagnostics:

```bash
# Capture full state
cat .dx-trace.log > /tmp/dx-debug.log
docker ps -a >> /tmp/dx-debug.log
cat .env.local >> /tmp/dx-debug.log
```

2. Share context:

- Error code (e.g., DX_ERR_003)
- Trace log excerpt
- Output of `docker ps`
- Output of `pnpm run dx:doctor`

3. Open issue: Include diagnostic output and steps to reproduce.
=======
Collect diagnostics:

```bash
# Capture full state
cat .dx-trace.log > /tmp/dx-debug.log
docker ps -a >> /tmp/dx-debug.log
cat .env.local >> /tmp/dx-debug.log
```

Share context:

- Error code (e.g., DX_ERR_003)
- Trace log excerpt
- Output of `docker ps`
- Output of `pnpm run dx:doctor`

Open issue: Include diagnostic output and steps to reproduce.
>>>>>>> Stashed changes
