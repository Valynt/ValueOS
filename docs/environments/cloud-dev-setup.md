# Cloud-Dev Setup (Gitpod/Ona)

This document describes the cloud-based development setup using Gitpod or Ona with external Supabase. This is an **alternative** to the recommended [DevContainer](../.devcontainer/README.md) setup.

## When to Use This Setup

- You prefer using cloud Supabase instead of local containerized PostgreSQL
- Your team already has a shared Supabase project for development
- You need to collaborate on a shared database instance
- You have limited local resources (RAM < 8GB)

## Prerequisites

- Node.js >= 20.19.0 (installed via nvm or system package manager)
- pnpm >= 9.15.0 (`npm install -g pnpm`)
- A Gitpod/Ona cloud-dev environment OR local machine with above tools

## Quickstart

### 1. Set Up Environment Variables

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

Fill in credentials from your Supabase dashboard:
- Go to Project Settings → API
- Copy `Project URL` to `SUPABASE_URL`
- Copy `anon public` to `SUPABASE_ANON_KEY`
- Copy `service_role secret` to `SUPABASE_SERVICE_ROLE_KEY`

### 2. Validate Environment

```bash
bash scripts/validate-cloud-dev-env.sh
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Apply Database Migrations

```bash
pnpm run db:migrate
```

### 5. Start Services

If using Gitpod with automations:
```bash
gitpod automations service start backend frontend
```

Or manually:
```bash
# Terminal 1
pnpm run dev:frontend   # apps/ValyntApp — React + Vite on port 5173

# Terminal 2
pnpm run dev:backend    # packages/backend — Express API on port 3001
```

## Environment Variable Reference

See [ops/env/README.md](../../ops/env/README.md) for the full variable reference and load order.

### Required Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | Supabase Dashboard → API → Project URL | Database and auth endpoint |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → API → anon public | Frontend authentication |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role secret | Backend admin access |
| `SUPABASE_KEY` | Same as `SUPABASE_SERVICE_ROLE_KEY` | Backend compatibility alias |

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | (none) | Caching and queues (app degrades gracefully without) |
| `NATS_URL` | (none) | Messaging (app degrades gracefully without) |

## Troubleshooting

### "Required variable X is missing"

Run the validation script to check which variables are missing:
```bash
bash scripts/validate-cloud-dev-env.sh
```

### Database connection errors

Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct and the Supabase project is active.

### Port conflicts

Edit `ops/env/.env.frontend.cloud-dev` to change ports:
```bash
FRONTEND_PORT=5174
BACKEND_PORT=3002
```

## Migration from Cloud-Dev to DevContainer

If you want to switch to the fully containerized setup:

1. Back up your cloud-dev env files:
   ```bash
   mv ops/env/.env.cloud-dev ops/env/.env.cloud-dev.backup
   ```

2. Follow the [DevContainer quickstart](../.devcontainer/README.md)

3. The DevContainer uses local PostgreSQL/Redis instead of cloud Supabase

## Comparison: Cloud-Dev vs DevContainer

| Aspect | Cloud-Dev | DevContainer |
|--------|-----------|--------------|
| Database | Cloud Supabase | Local PostgreSQL |
| Redis | Optional cloud | Local container |
| Setup time | ~5 min (env setup) | ~10 min (first build) |
| Offline work | No | Yes |
| Team sharing | Shared DB per project | Isolated per developer |
| Resource usage | Lower local RAM | 8GB+ RAM recommended |
| Production parity | Close | Exact (same containers) |

## Support

For issues with the DevContainer setup, see [.devcontainer/DEVCONTAINER-TROUBLESHOOTING.md](../.devcontainer/DEVCONTAINER-TROUBLESHOOTING.md).

For cloud-dev specific issues, check [ops/env/README.md](../../ops/env/README.md).
