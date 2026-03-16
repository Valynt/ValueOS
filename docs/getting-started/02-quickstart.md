# 02 Quickstart

> **Note:** References to `pnpm run dx` and `pnpm run dx:*` in this document are design specifications, not implemented package.json scripts. Use `gitpod automations service start <id>` to start services. See `.ona/automations.yaml` for the canonical service list.

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## How to Run ValueOS - Quick Start Guide

*Source: `HOW_TO_RUN.md`*

## Prerequisites

- Docker and Docker Compose
- Node.js 20.19.0+
- pnpm 9.15.0+

## One-Command Boot (in devcontainer)

If you're inside the VS Code devcontainer, the environment should already be running:

```bash
# Verify everything is working
pnpm run dev:verify

# Start the development server
pnpm dev
```

## Local Development (outside devcontainer)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Supabase/Kong/Postgres)
pnpm run dx:up

# 3. Verify infrastructure is ready
pnpm run dev:verify

# 4. Start frontend
pnpm dev
```

## Verification Commands

| Command                      | Purpose                | Pass Criteria             |
| ---------------------------- | ---------------------- | ------------------------- |
| `pnpm run dev:verify`        | Full environment check | All Tier 0/1 checks pass  |
| `pnpm run dev:verify:quick`  | Fast infra check only  | Skips TypeScript signal   |
| `pnpm run dev:verify:infra`  | Infrastructure only    | Containers + DB + Kong    |
| `pnpm run typecheck:islands` | Type-safe packages     | 0 errors in green islands |
| `pnpm run typecheck:signal`  | Full TS debt report    | Informational             |

## What Gets Checked

### Tier 0: Infrastructure (Must Pass)

- ✓ Docker containers running (db, kong, auth, rest, storage, meta)
- ✓ Database connectivity (SELECT 1 works)
- ✓ Kong API Gateway responding on port 8000

### Tier 1: Application (Must Pass)

- ✓ Migrations applied
- ✓ Dev server can start (Vite config + dependencies present)

### Tier 2: Quality (Signals Only)

- 📊 TypeScript error count tracked
- 📊 Error trend over time

## Troubleshooting

### "Docker containers not running"

```bash
# Check container status
docker ps

# If not running, start them
pnpm run dx:up

# Or with full reset
pnpm run dx:reset
```

### "Database connection failed"

```bash
# Check if DB container is healthy
docker inspect valueos-db --format '{{.State.Health.Status}}'

# Try direct connection
psql "postgresql://postgres:postgres@localhost:54322/postgres?sslmode=disable" -c "SELECT 1;"
```

### "Kong API Gateway not responding"

```bash
# Check Kong logs
docker logs valueos-kong

# Verify port
curl http://localhost:54321/rest/v1/
```

### "pnpm dev doesn't start"

```bash
# Ensure dependencies are installed
pnpm install

# Check for port conflicts
lsof -i :5173
```

## TypeScript Status

The repository has ~5,300 TypeScript errors across the codebase. This is tracked but doesn't block development.

**Current Green Islands (0 errors, enforced):**

- `packages/infra`

**Run these to check TypeScript status:**

```bash
# Full telemetry report
pnpm run typecheck:signal

# Check only green islands (must pass for PRs)
pnpm run typecheck:islands
```

## Environment Variables

Key environment variables are set in `.env.local`:

| Variable            | Purpose               | Default                                           |
| ------------------- | --------------------- | ------------------------------------------------- |
| `SUPABASE_URL`      | Supabase API URL      | `http://kong:8000`                                |
| `DATABASE_URL`      | Postgres connection   | `postgresql://postgres:postgres@db:5432/postgres?sslmode=disable` |
| `VITE_SUPABASE_URL` | Frontend Supabase URL | `http://localhost:54321`                          |

## Network Topology (Devcontainer)

When running inside the devcontainer, services are accessed by container name:

```
┌─────────────────────────────────────────────────────────────┐
│ Docker Network: valueos-network                             │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  valueos-db  │    │ valueos-kong │    │ valueos-auth │  │
│  │   :5432      │    │    :8000     │    │    :9999     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                              │
│         └───────────────────┴──────────────────────────────│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           devcontainer (app)                          │ │
│  │  • pnpm dev serves on :5173                           │ │
│  │  • Connects to services by container name             │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Related Documentation

- [Green Islands Strategy](./engineering/GREEN_ISLANDS_STRATEGY.md) - TypeScript debt reduction
- [DX Architecture](./dx-architecture.md) - Development environment internals
- [Environment Variables](./ENVIRONMENT.md) - Full env var reference

---