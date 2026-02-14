# Deploy to Production

## Prerequisites

- Docker + Docker Compose v2
- A Supabase project (or self-hosted Supabase instance)
- A domain with DNS pointing to your server

## Required Environment Variables

Create a `.env.production` file (or set these in your hosting platform):

```bash
# Domain
APP_DOMAIN=app.yourdomain.com
ACME_EMAIL=ops@yourdomain.com

# Supabase (from your Supabase project dashboard → Settings → API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Backend
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require
REDIS_URL=rediss://redis.yourdomain.internal:6379
REDIS_TLS_REJECT_UNAUTHORIZED=true
REDIS_TLS_CA_CERT_PATH=/run/secrets/redis-ca.crt
REDIS_TLS_SERVERNAME=redis.yourdomain.internal

# Secrets (create files in infra/secrets/)
# infra/secrets/supabase_service_key.txt  — Supabase service_role key
# infra/secrets/openai_api_key.txt        — OpenAI API key
```


## Production Backend Runtime Policy

ValueOS production runtime is standardized on **`packages/backend`**.

- Canonical backend artifact: `infra/docker/Dockerfile.backend` (build arg `APP=@valueos/backend`)
- Frozen duplicate tree: `apps/ValyntApp/src/services/**` is not a deploy runtime source
- Any required migration sync touching both trees must use a dedicated commit tagged with `[migration-sync]`

## TLS Requirements (Staging/Production)

- **Postgres:** `DATABASE_URL` (and `DIRECT_DATABASE_URL` when used) must set `sslmode=require` or stricter (`verify-ca`/`verify-full`).
- **Redis:** `REDIS_URL` must use `rediss://` and certificate validation must remain enabled via `REDIS_TLS_REJECT_UNAUTHORIZED=true`.
- **Redis CA/hostname validation:** set `REDIS_TLS_CA_CERT_PATH` (or `REDIS_TLS_CA_CERT`) and `REDIS_TLS_SERVERNAME`.

## Deploy

```bash
# From the repo root:
cd infra/docker
docker compose -f docker-compose.prod.yml --env-file ../../.env.production up -d --build
```

This starts:
- **Caddy** — reverse proxy with automatic HTTPS (ports 80/443)
- **Frontend** — Vite-built SPA served by nginx (port 8080 internal)
- **Backend** — `@valueos/backend` from `packages/backend` via `infra/docker/Dockerfile.backend` (port 3001 internal)
- **Redis** — session cache and rate limiting
- **Kafka + Zookeeper** — event streaming (optional, can be removed if not using agent fabric)

## Verify

```bash
# Check all services are healthy
docker compose -f docker-compose.prod.yml ps

# Check frontend
curl -s https://app.yourdomain.com/health

# Check backend
curl -s https://app.yourdomain.com/api/health/ready
```

## Supabase Setup

1. Run migrations against your Supabase project:
   ```bash
   cd infra/supabase/supabase
   supabase db push --db-url "$DATABASE_URL"
   ```

2. Configure auth in Supabase Dashboard:
   - Enable Email auth provider
   - Set Site URL to `https://app.yourdomain.com`
   - Add `https://app.yourdomain.com/auth/callback` to Redirect URLs

## Minimal Deploy (Frontend Only)

> This path does **not** deploy backend runtime. Production API runtime remains `packages/backend`.


If you only need the frontend (e.g., deploying to Vercel/Netlify/Cloudflare Pages):

```bash
cd apps/ValyntApp
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
pnpm run build
# Output is in dist/ — deploy this as a static site with SPA fallback
```


## Migration Notes: Certificate Distribution in Containers

1. **Distribute internal CA certificates as secrets** (Docker Swarm/Kubernetes secret/CSI secret) and mount read-only into backend containers (for example: `/run/secrets/redis-ca.crt`).
2. **Set trust-chain env vars** in deploy manifests:
   - `REDIS_TLS_CA_CERT_PATH=/run/secrets/redis-ca.crt`
   - `REDIS_TLS_SERVERNAME=<redis certificate SAN/CN>`
   - `REDIS_TLS_REJECT_UNAUTHORIZED=true`
3. **Rotate certificates safely** by publishing new CA bundles before server cert rotation; keep overlap until all workloads restart with the updated trust bundle.
4. **Validate before cutover** using a one-off container check (e.g., `openssl s_client -connect redis-host:6379 -servername redis-host -CAfile /run/secrets/redis-ca.crt`).
5. **Postgres trust chain:** if provider requires custom CA, append `sslrootcert=<path>` to Postgres URL and mount that CA bundle similarly.

