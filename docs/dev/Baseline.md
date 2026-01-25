# Development Environment Baseline Snapshot

This snapshot documents the current, canonical development commands and ports. For the full quickstart, see [docs/getting-started/quickstart.md](../getting-started/quickstart.md).

## Canonical Dev Commands (from package.json)

### Environment Setup

- `pnpm run dx:env` - Generate `.env.local`, `.env.ports`, and `deploy/envs/.env.ports`
- `pnpm run dx:env:validate` - Validate env files

### Development Stack Commands

- `pnpm run dx` - Full local stack (deps + Supabase + backend + frontend)
- `pnpm run dx:doctor` - Preflight checks
- `pnpm run dx:docker` - Full Docker mode (uses `infra/docker/docker-compose.dev.yml`)
- `pnpm run dx:down` - Stop all containers + clear DX state
- `pnpm run dx:reset` - Reset containers and volumes
- `pnpm run dx:clean` - Full cleanup (containers + env files)
- `pnpm run dx:check` - Comprehensive environment validation
- `pnpm run dx:ps` - Docker ps for services
- `pnpm run dx:logs` - Docker logs for services

### Application Services

- `pnpm run dev` - Vite dev server (frontend)
- `pnpm run backend:dev` - Backend dev server with tsx watch
- `pnpm run health` - Health check script

### Database Commands

- `pnpm run db:setup` - Supabase setup script
- `pnpm run db:push` - Supabase db push
- `pnpm run db:pull` - Supabase db pull
- `pnpm run db:reset` - Supabase db reset
- `pnpm run seed:demo` - Create demo user
- `pnpm run db:types` - Generate TypeScript types from Supabase
- `pnpm run db:test` - Run Supabase tests

## Services and Ports (from config/ports.json)

### Core Services

- Frontend: 5173 (Vite dev server)
- Backend: 3001 (API server)
- Postgres: 5432 (deps container)
- Redis: 6379 (deps container)

### Supabase Services

- Supabase API: 54321
- Supabase Studio: 54323
- Supabase DB: 54322

### Observability (profiles: observability)

- Prometheus: 9090
- Grafana: 3000
- Jaeger: 16686
- Loki: 3100
- Tempo: 3200

### Edge/Proxy

- Caddy HTTP: 8080
- Caddy HTTPS: 8443
- Caddy Admin: 2019

## Environment Variable Sources

### Primary Environment Files

- `.env.local` - Main local environment file (generated)
- `.env.ports` - Generated ports file
- `deploy/envs/.env.ports` - Docker Compose env file

### Scripts That Write Environment Files

- `scripts/dx/env-compiler.js` - Generates `.env.local` + `.env.ports`
- `scripts/dx/ports.js` - Loads ports from `config/ports.json`
- `scripts/dx/orchestrator.js` - Orchestrates env generation + services

## Supabase Runtime Configuration

- **Local mode (`pnpm run dx`)**: DX orchestrator starts Supabase via the CLI and waits for the API to become reachable.
- **Docker mode (`pnpm run dx:docker`)**: Supabase runs as part of `infra/docker/docker-compose.dev.yml`.
- **DevContainers/Codespaces**: Supabase startup is skipped by DX if Docker-in-Docker port forwarding is unreliable; the stack uses the `valueos-postgres` container on port 5432 instead.

## Migration/Seed Flow

1. `pnpm run dx` - Starts the stack and applies migrations automatically.
2. `pnpm run db:reset` - Reset database if needed.
3. `pnpm run seed:demo` - Create demo user data.
4. `pnpm run db:types` - Generate TypeScript types.
