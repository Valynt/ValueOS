# ValueOS Environment Files

All env files live in `ops/env/`. Files without `.example` in the name are gitignored and contain real secrets. Never commit them.

## Gitignored (contain secrets)

```
ops/env/.env.cloud-dev
ops/env/.env.frontend.cloud-dev
ops/env/.env.backend.cloud-dev
ops/env/.env.local
ops/env/.env.frontend.local
ops/env/.env.backend.local
ops/env/.env.test
ops/env/.env.prod
```

## Safe to commit (placeholders only)

```
ops/env/.env.base                        # Variable reference (every var the app reads)
ops/env/.env.local.example               # Local dev template
ops/env/.env.staging.template            # Staging template (production-parity)
ops/env/.env.production.template         # Production template
ops/env/.env.test.template               # CI / test template
ops/env/.env.cloud-dev.example
ops/env/.env.frontend.cloud-dev.example
ops/env/.env.backend.cloud-dev.example
ops/env/.env.frontend.local.example
ops/env/.env.backend.local.example
```

## Quick setup

```bash
# Interactive -- prompts for environment
bash scripts/setup-env.sh

# Non-interactive
bash scripts/setup-env.sh dev      # -> ops/env/.env.local
bash scripts/setup-env.sh staging  # -> ops/env/.env.staging
bash scripts/setup-env.sh prod     # -> ops/env/.env.production
bash scripts/setup-env.sh test     # -> ops/env/.env.test
```

## Bootstrapping cloud-dev

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
# Fill in real values from Supabase dashboard → Project Settings → API
```

Validate after filling:

```bash
bash scripts/validate-cloud-dev-env.sh
```

## Variable ownership

Each mode uses three files with distinct ownership:

| File                   | Who reads it                               | What goes in it                                                                                                     |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `.env.<mode>`          | Both frontend and backend prep scripts     | `APP_ENV`, `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`                                  |
| `.env.frontend.<mode>` | `scripts/env/prepare-frontend-env.sh` only | Port/origin values for Vite mapping. No secrets.                                                                    |
| `.env.backend.<mode>`  | `scripts/env/prepare-backend-env.sh` only  | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`, `API_PORT`, backend pool sizing inputs |

`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` must never appear in the shared or frontend files.

## Backend database pool sizing

The backend now derives `DATABASE_POOL_MAX` from two operator inputs when an explicit max is not set:

- `DATABASE_POOL_ROLE` — one of `api`, `worker`, `migration`, or `maintenance`.
- `DATABASE_EXPECTED_CONCURRENCY` — expected in-flight units of work per pod that can touch Postgres.

For the API role used by the main backend deployments, `settings.ts` targets roughly half of the expected concurrency and then caps the result per environment. That keeps local development reasonably roomy while intentionally shrinking per-pod pools in autoscaled environments.

### Default API sizing by environment

| Environment | Role | Expected concurrency per pod | Derived per-pod pool max | Replica assumption | Connection budget |
| --- | --- | ---: | ---: | ---: | ---: |
| `local` | `api` | 12 | 6 | n/a | n/a |
| `cloud-dev` | `api` | 10 | 5 | n/a | n/a |
| `test` | `api` | 4 | 2 | n/a | n/a |
| `staging` | `api` | 8 | 4 | 2 backend replicas | 8 |
| `prod` | `api` | 8 | 4 | 18 backend replicas (HPA max) | 72 |

`DATABASE_POOL_MAX` remains available as an escape hatch, but the preferred steady-state configuration is to set role + expected concurrency and let the app derive the cap.

### Supabase / pgBouncer assumption

The committed cloud-dev, staging, and production templates point application traffic at the Supabase transaction pooler (`*.pooler.supabase.com:6543`). Treat that as the default pgBouncer assumption for request traffic. Use the direct Postgres host/port (`:5432`) only for migrations or other work that requires session affinity.

## Load order

### Backend (`scripts/env/prepare-backend-env.sh`)

1. `ops/env/.env.<mode>` (shared)
2. `ops/env/.env.backend.<mode>` (overlay — backend secrets win)
3. `validate_mode_env` fails fast on missing required vars

### Frontend (`scripts/env/prepare-frontend-env.sh`)

1. `ops/env/.env.frontend.<mode>`
2. Falls back to `ops/env/.env.<mode>` if frontend file is missing
3. Strips `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and all `PG*` vars before Vite starts
4. Maps canonical names to `VITE_*` prefixed names

Shell environment variables always override file values.

> **Warning:** If `ops/env/.env.local` exists on disk, `load_mode_env` sources it _after_ `ops/env/.env.cloud-dev`, so `.env.local` values silently override cloud-dev values. Remove or rename `.env.local` when switching to cloud-dev mode to avoid unexpected configuration bleed.

## Staging ingress note

For the staging compose stack, browser and external API traffic must enter through Caddy and the `/api` path prefix. `ops/compose/compose.staging.yml` keeps the backend port private to the compose network. When an operator needs temporary direct backend access for debugging, use `ops/compose/profiles/staging-admin-debug.yml`, which binds a forwarding port to `127.0.0.1` only and must stay disabled in shared staging environments.

## Port note

The Express backend binds to `API_PORT` (default `3001`), read by `packages/backend/src/config/settings.ts`. `BACKEND_PORT` in env files is used only to construct `BACKEND_ORIGIN` and `CORS_ALLOWED_ORIGINS` in the prep scripts — it does not change what port the server listens on. Set both to `3001` to keep them consistent.

## Required variables by mode

### `cloud-dev`

Shared: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`
Backend: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`, `DATABASE_POOL_ROLE`, `DATABASE_EXPECTED_CONCURRENCY`

No local Postgres, Redis, or NATS required. These services are either hosted (Supabase) or optional (Redis/NATS — app degrades gracefully when absent).

### `local`

Shared: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Backend: `DATABASE_URL`, `DATABASE_POOL_ROLE`, `DATABASE_EXPECTED_CONCURRENCY`
Optional: `REDIS_URL`, `NATS_URL`, `BLS_API_KEY`, `CENSUS_API_KEY`

### `test`

Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_POOL_ROLE`, `DATABASE_EXPECTED_CONCURRENCY`

### `prod`

All vars injected by the deployment platform. Include `APP_ENV`, `DATABASE_POOL_ROLE`, and `DATABASE_EXPECTED_CONCURRENCY` for the backend deployments. Never committed.

## MCP Ground Truth benchmark behavior

`IndustryBenchmarkModule` (ValyntApp MCP ground truth) reads:

- `BLS_API_KEY` for BLS wage benchmarks
- `CENSUS_API_KEY` for Census industry benchmarks

When API keys are unset, benchmark requests can still resolve via static embedded data **only if** request policy allows fallback. Requests that set `require_authoritative_external_benchmark=true` are blocked with `EVIDENCE_REQUIRED` instead of silently returning fallback data.
