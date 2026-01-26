# ValueOS Developer Experience (DX) Orchestration

> ⚠️ **DRAFT - PENDING VALIDATION**
> This document describes implementation that has not yet passed runtime proof.
> Status will be updated after `./dev up` successfully shows "All Services Ready".

This document describes the complete development environment orchestration flow for ValueOS.

## Quick Start

```bash
# One-time setup (bootstrap)
pnpm run setup

# Start development environment
pnpm run dx

# Or use the dev CLI directly
./dev up
```

## Orchestration Flow

```mermaid
flowchart TD
  A[Developer] --> B[pnpm run setup<br/>One-time bootstrap]
  B --> C[pnpm run dx<br/>Orchestrate dev stack]
  C --> C1[Step 1: dx:env<br/>Generate .env.local + .env.ports from config/ports.json]
  C1 --> C2[Step 2: Preflight checks<br/>Docker, Node/pnpm, DATABASE_URL, ports]
  C2 --> C3[Step 3: Start Docker deps<br/>postgres + redis docker compose]
  C3 --> C4[Step 4: Start Supabase optional<br/>supabase start --workdir infra/supabase]
  C4 -->|Supabase OK| C5[Step 5a: Migrations against Supabase DB<br/>supabase db push --workdir infra/supabase]
  C4 -->|Supabase fails / not available| C6[Step 5b: Migrations against dx postgres<br/>supabase db push --db-url postgresql://...:5432]
  C5 --> C7[Step 6: Schema verify + types regen non-critical<br/>supabase gen types if configured]
  C6 --> C7
  C7 --> C8[Step 7: Seed optional<br/>dx --seed or pnpm run db:seed]
  C8 --> D[Start app services]
  D --> D1[Backend dev<br/>tsx watch packages/backend/src/server.ts<br/>Health: GET /health]
  D --> D2[Frontend dev<br/>pnpm --filter valynt-app dev vite<br/>http://localhost:5173]
  D --> D3[Caddy if enabled<br/>HTTPS reverse proxy + local domains]
  D1 --> E[All Services Ready]
  D2 --> E
  D3 --> E

  E --> F1[Tail logs<br/>./dev logs service]
  E --> F2[Stop stack<br/>Ctrl+C or ./dev down]
  E --> F3[Reset stack<br/>./dev reset]
  E --> F4[DX Doctor<br/>pnpm run dx:doctor]
  E --> F5[Validate env<br/>pnpm run dx:env:validate]
  E --> F6[Validate imports<br/>pnpm run dx:validate-imports]
```

## Step-by-Step Breakdown

### Step 1: Environment Generation (`dx:env`)

Generates `.env.local` and `.env.ports` from `config/ports.json`.

```bash
pnpm run dx:env
```

**Files generated:**
- `.env.local` - Application environment variables (mode-specific)
- `.env.ports` - Port mappings for Docker Compose

**Source of truth:** `config/ports.json`

### Step 2: Preflight Checks

Validates the development environment:

| Check | Description | Fix |
|-------|-------------|-----|
| Docker | Docker daemon is running | Start Docker Desktop |
| Node | Node version matches `.nvmrc` | `nvm install && nvm use` |
| pnpm | Correct pnpm version | `corepack prepare pnpm@9.15.0 --activate` |
| DATABASE_URL | Environment variable set | Run `pnpm run dx:env` |
| Ports | No conflicts on required ports | Stop conflicting services |

Run manually:
```bash
pnpm run dx:doctor
```

### Step 3: Start Docker Dependencies

Starts PostgreSQL and Redis via Docker Compose.

**Compose file:** `docker-compose.deps.yml`

**Services:**
- `valueos-postgres` - PostgreSQL 15 on port 5432
- `valueos-redis` - Redis 7 on port 6379

Both services have health checks configured.

### Step 4: Start Supabase (Optional)

Attempts to start local Supabase instance:

```bash
supabase start --workdir infra/supabase
```

**Decision logic:**
1. If `DX_FORCE_SUPABASE=1`: Force Supabase startup
2. If `DX_SKIP_SUPABASE=1`: Skip Supabase, use dx postgres
3. If Supabase fails: Fallback to dx postgres container

**Supabase services when running:**
- API: `http://localhost:54321`
- Studio: `http://localhost:54323`
- DB: `postgresql://...:54322`

### Step 5: Run Migrations

#### Step 5a: Supabase DB Available
```bash
supabase db push --workdir infra/supabase
```

#### Step 5b: Fallback to dx postgres
```bash
supabase db push --workdir infra/supabase --db-url "postgresql://postgres:dev_password@localhost:5432/valuecanvas_dev"
```

### Step 6: Schema Verify + Types Regeneration

Regenerates TypeScript types from database schema:

```bash
pnpm run db:types
```

This is non-critical - the stack will continue even if this fails.

### Step 7: Seed Database (Optional)

Seed demo data if `--seed` flag is provided:

```bash
./dev up --seed
# or
pnpm run db:seed
```

### Step 8: Start Backend

```bash
tsx watch packages/backend/src/server.ts
```

**Health endpoint:** `GET /health`
**Default port:** 3001

### Step 9: Start Frontend

```bash
pnpm --filter valynt-app dev
```

**Default port:** 5173 (Vite)
**HMR port:** 24678

### Step 10: Caddy (Optional)

Enable with `--caddy` flag or `DX_ENABLE_CADDY=1`:

```bash
./dev up --caddy
```

Provides:
- HTTPS reverse proxy
- Local domain support
- TLS termination

## Recovery & Maintenance Commands

| Command | Description |
|---------|-------------|
| `./dev logs <service>` | Tail logs for a specific service |
| `./dev down` | Stop all services |
| `./dev reset` | Soft reset (remove containers + volumes) |
| `./dev reset --hard` | Hard reset (+ prune Docker build cache) |
| `pnpm run dx:doctor` | Run diagnostic checks |
| `pnpm run dx:env:validate` | Validate environment files |
| `pnpm run dx:validate-imports` | Validate import statements |
| `pnpm run dx:clean` | Full cleanup (containers + env files) |

## What "Getting Dev Up" Really Means

A successful dev environment has:

1. ✅ **Environment generated** (`dx:env`) → consistent ports + URLs
2. ✅ **Dependencies up** (postgres/redis) → Docker compose healthy
3. ✅ **Supabase decision:**
   - If Supabase starts: use Supabase DB + API/Studio
   - If Supabase fails: fall back to dx postgres (DB only)
4. ✅ **Migrations applied** (`supabase db push`) → schema matches repo
5. ✅ **Backend boots** + `/health` passes
6. ✅ **Frontend boots** (Vite 5173) and can reach backend + Supabase endpoints

## Port Configuration

All ports are defined in `config/ports.json`:

| Service | Port | Environment Variable |
|---------|------|---------------------|
| Frontend | 5173 | `VITE_PORT` |
| Frontend HMR | 24678 | `VITE_HMR_PORT` |
| Backend | 3001 | `API_PORT` |
| PostgreSQL | 5432 | `POSTGRES_PORT` |
| Redis | 6379 | `REDIS_PORT` |
| Supabase API | 54321 | `SUPABASE_API_PORT` |
| Supabase Studio | 54323 | `SUPABASE_STUDIO_PORT` |
| Supabase DB | 54322 | `SUPABASE_DB_PORT` |
| Caddy HTTP | 8080 | `CADDY_HTTP_PORT` |
| Caddy HTTPS | 8443 | `CADDY_HTTPS_PORT` |

## Environment Variables

Key environment flags:

| Variable | Description |
|----------|-------------|
| `DX_MODE` | `local` or `docker` |
| `DX_SKIP_SUPABASE` | Skip Supabase, use dx postgres |
| `DX_FORCE_SUPABASE` | Force Supabase startup |
| `DX_ENABLE_CADDY` | Enable Caddy reverse proxy |
| `DX_AUTO_SHIFT_PORTS` | Auto-shift ports on conflict |
| `DX_SOFT_DOCTOR` | Soft mode for doctor checks |

## Troubleshooting

### Port Conflicts

```bash
# Check what's using a port
lsof -i :5173

# Auto-shift ports
./dev up --auto-shift-ports
```

### Supabase Won't Start

```bash
# Force skip Supabase
DX_SKIP_SUPABASE=1 ./dev up

# Check Supabase status
supabase status --workdir infra/supabase
```

### Database Connection Issues

```bash
# Verify database
pnpm run db:verify

# Reset database
pnpm run db:reset
```

### Full Reset

```bash
# Nuclear option - reset everything
./dev reset --hard
pnpm run dx:clean
pnpm run setup
./dev up
```

## Related Documentation

- [DX Troubleshooting](../DX_TROUBLESHOOTING.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [System Invariants](../SYSTEM_INVARIANTS.md)
