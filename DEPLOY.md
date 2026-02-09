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
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
REDIS_PASSWORD=<generate-a-strong-password>

# Secrets (create files in infra/secrets/)
# infra/secrets/supabase_service_key.txt  — Supabase service_role key
# infra/secrets/openai_api_key.txt        — OpenAI API key
```

## Deploy

```bash
# From the repo root:
cd infra/docker
docker compose -f docker-compose.prod.yml --env-file ../../.env.production up -d --build
```

This starts:
- **Caddy** — reverse proxy with automatic HTTPS (ports 80/443)
- **Frontend** — Vite-built SPA served by nginx (port 8080 internal)
- **Backend** — Express API via tsx (port 3001 internal)
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

If you only need the frontend (e.g., deploying to Vercel/Netlify/Cloudflare Pages):

```bash
cd apps/ValyntApp
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
pnpm run build
# Output is in dist/ — deploy this as a static site with SPA fallback
```
