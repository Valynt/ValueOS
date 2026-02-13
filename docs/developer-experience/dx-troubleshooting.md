# Dx Troubleshooting

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## DX Troubleshooting Guide

*Source: `DX_TROUBLESHOOTING.md`*

## Error Codes Reference

### DX_ERR_001: Missing Observability Module


Symptoms:

- Backend crashes with `ERR_MODULE_NOT_FOUND` for `../lib/observability`

Root Cause:

Code imports from `../lib/observability` but the directory or `index.ts` file doesn't exist.

Fix:

```bash
# Validate all imports
pnpm run dx:validate-imports

# Create missing module (if needed)
mkdir -p packages/backend/src/lib/observability
# Add observability/index.ts with required exports
```


Prevention: Import validation runs in CI via `.github/workflows/dx-e2e.yml`.

---

### DX_ERR_002: Port Conflict Detected

Symptoms:

- DX startup fails with "address already in use"
- Services can't bind to required ports (8000, 5173, 5432, 6379, 54321-54323)


Root Cause:

Another process is using a required port.

Fix:

```bash
# Find process using port (replace PORT with actual number)
lsof -ti:PORT

# Kill the process
lsof -ti:PORT | xargs kill -9

# Or use the sanitize script
pnpm run dx:sanitize
```


Prevention: Run `pnpm run dx:sanitize` before starting DX.

---

### DX_ERR_003: Backend Health Check Failed

Symptoms:

- Backend starts but health endpoint returns 500 or doesn't respond
- Frontend can't connect to backend API


Root Cause:

- Database connection failed
- Missing environment variables
- Module import errors
- Unhandled exceptions in startup code


Fix:

```bash
# Check backend logs
tail -f /tmp/dx-backend.log

# Check trace log
cat .dx-trace.log | grep ERROR

# Verify environment
cat .env.local | grep DATABASE_URL

# Test backend directly
curl -v http://localhost:8000/health
```


Prevention: Module contract tests in `packages/backend/src/__tests__/module-contracts.test.ts`.

---

### DX_ERR_004: Database Connection Refused

Symptoms:

- Migrations fail with "connection refused"
- Backend can't connect to Postgres


Root Cause:

- Postgres container not running
- Wrong host/port in DATABASE_URL
- Container network issue in DevContainer


Fix:

```bash
# Check if postgres is running
docker ps | grep postgres

# Check postgres logs
docker logs valueos-postgres

# Restart postgres
docker compose -f docker-compose.deps.yml up -d postgres

# Test connection
PGPASSWORD=dev_password psql -h localhost -p 5432 -U postgres -d valuecanvas_dev -c 'SELECT 1'
```


Prevention: Orchestrator checks Docker availability in preflight.

**Prevention:** Orchestrator checks Docker availability in preflight.

### DX_ERR_005: Supabase DB Port Binding Failed


Symptoms:

- `supabase start` fails with "dial tcp 127.0.0.1:54322: connect: connection refused"
- Supabase Kong container is not running


Root Cause:

- Port 54322 already in use
- Supabase DB container failed to start
- Race condition in healthcheck


Fix:

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


Prevention: DX falls back to `valueos-postgres` if Supabase fails.

---

### DX_ERR_006: Migration TLS Error

Symptoms:

- `supabase db push` fails with "tls error (server refused TLS connection)"
- Migrations work on one environment but not another


Root Cause:

- Postgres container doesn't support TLS
- Connection string has conflicting SSL parameters
- Client is attempting TLS despite `sslmode=disable`


Fix:

```bash
# Force disable TLS
export PGSSLMODE=disable

# Run migrations with explicit sslmode
supabase db push \
  --workdir infra/supabase \
  --db-url "postgresql://postgres:dev_password@localhost:5432/valuecanvas_dev?sslmode=disable" \
  --debug
```


Prevention: Orchestrator removes invalid SSL params from connection strings.

---

### DX_ERR_007: Module Not Found at Runtime

Symptoms:

- `ERR_MODULE_NOT_FOUND` at runtime
- Import path looks correct but Node can't resolve it


Root Cause:

- File doesn't exist at import path
- Casing mismatch (Linux is case-sensitive)
- Missing `.js` extension in ESM import
- Directory import without `index.ts`


Fix:

```bash
# Validate all imports
pnpm run dx:validate-imports

# Check file exists (note: case-sensitive)
ls -la packages/backend/src/lib/observability

# For ESM, add .js extension to imports
# ✅ import { foo } from './lib/bar.js'
```


Prevention: Import resolution tests run in CI.

---

### DX_ERR_008: Docker Not Available

Symptoms:

- "Cannot connect to Docker daemon"
- "docker: command not found"

Root Cause:

- Docker Desktop not running
- Docker socket not accessible
- User not in `docker` group (Linux)


Fix:

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


Prevention: Orchestrator checks Docker availability in preflight.

---

### DX_ERR_009: Environment Variable Not Set

Symptoms:

- Services fail with "env var not set" errors
- Database URL is undefined


Root Cause:

- `.env.local` file missing or incomplete
- Environment not regenerated after changes


Fix:

```bash
# Regenerate environment
pnpm run dx:env

# Validate environment
pnpm run dx:env:validate

# Check generated file
cat .env.local
```


Prevention: Setup script generates `.env.local` automatically.

---

### DX_ERR_010: Supabase Containers Not Running

Symptoms:

- Supabase API unreachable
- Kong container status shows "Exited"


Root Cause:

- Container startup failure
- Healthcheck timeout
- Volume corruption


Fix:

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


Prevention: Orchestrator provides structured error output with context.

---

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

---