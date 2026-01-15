# Development Environment Baseline Snapshot

## Canonical Dev Commands (from package.json)

### Environment Setup

- `npm run env:dev` - Node script that sets up .env.local with Supabase keys and URLs
- `npm run env:validate` - TypeScript script that validates environment configuration

### Development Stack Commands

- `npm run dx` - Runs doctor.js check then dev.js (starts deps + backend + frontend)
- `npm run dx:doctor` - Doctor check script
- `npm run dx:docker` - Full Docker mode (uses docker-compose.dev.yml)
- `npm run dx:down` - Stops Docker services, removes lock/state files
- `npm run dx:reset` - Stops Docker services with volume removal
- `npm run dx:clean` - Full cleanup (stops services, removes env files)
- `npm run dx:check` - Comprehensive environment validation
- `npm run dx:ps` - Docker ps for services
- `npm run dx:logs` - Docker logs for services

### Application Services

- `npm run dev` - Vite dev server (frontend)
- `npm run backend:dev` - Backend dev server with tsx watch
- `npm run health` - Health check script

### Database Commands

- `npm run db:setup` - Supabase setup script
- `npm run db:push` - Supabase db push
- `npm run db:pull` - Supabase db pull
- `npm run db:reset` - Supabase db reset
- `npm run seed:demo` - Create demo user
- `npm run db:types` - Generate TypeScript types from Supabase
- `npm run db:test` - Run Supabase tests

## Services and Ports (from config/ports.json)

### Core Services

- Frontend: 5173 (Vite dev server)
- Backend: 3001 (API server)
- Postgres: 5432 (Database)
- Redis: 6379 (Cache)

### Supabase Services

- Supabase API: 54321
- Supabase Studio: 54323

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

- `.env.local` - Main local environment file (created/copied from deploy/envs/.env.local template)
- `deploy/envs/.env.ports` - Ports and container-specific env vars
- `.env.ports` - Generated ports file (created by dx scripts)

### Frontend Environment Variables (VITE\_\*)

- `VITE_SUPABASE_URL` - Supabase API URL (http://localhost:54321)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (JWT token)
- `VITE_API_BASE_URL` - Backend API URL (http://backend:3001 in containers)
- `VITE_PORT` - Frontend port (5173)

### Backend Environment Variables

- `SUPABASE_URL` - Supabase API URL (http://localhost:54321)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server operations
- `API_PORT` - Backend port (3001)
- `DATABASE_URL` - Postgres connection string
- `DB_URL` - Alternative database URL
- `REDIS_URL` - Redis connection string
- `KAFKA_BROKERS` - Kafka broker URLs
- `SCHEMA_REGISTRY_URL` - Schema registry URL

### Scripts That Write Environment Files

- `scripts/setup-dev-env.js` - Writes .env.local and deploy/envs/.env.ports
- `scripts/dx/ports.js` - Generates .env.ports from config/ports.json
- `scripts/dx/dev.js` - Calls writePortsEnvFile to create .env.ports

## Supabase Runtime Configuration

### CLI-Based Approach

Supabase is **not** managed as a Docker service in the compose files. Instead:

- Expected to run via `npx supabase start` (separate from dx)
- Ports 54321 (API) and 54323 (Studio) are referenced but not started by dx
- `npm run db:reset` assumes Supabase is already running
- `seed:demo` will fail with ECONNREFUSED if Supabase not started

### Docker Compose Services

- `docker-compose.dev.yml` - Full stack including backend/frontend containers
- `docker-compose.deps.yml` - Only postgres/redis for local development
- Both use `deploy/envs/.env.ports` for environment variables

## Migration/Seed Flow

### Database Initialization

1. `npm run db:setup` - Initial Supabase project setup
2. `npm run db:push` - Push schema migrations to local Supabase
3. `npm run db:reset` - Reset database (requires running Supabase)
4. `npm run seed:demo` - Create demo user data
5. `npm run db:types` - Generate TypeScript types

### Current Issues Identified

- Supabase startup is manual (`npx supabase start` not integrated into dx)
- dx:check validates containers but not Supabase status
- Environment variable naming inconsistent (SUPABASE_SERVICE_KEY vs SUPABASE_SERVICE_ROLE_KEY)
- Multiple .env files with potential drift (.env.local vs deploy/envs/.env.ports vs .env.ports)
