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
| `.env.backend.<mode>`  | `scripts/env/prepare-backend-env.sh` only  | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`, `API_PORT` |

`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` must never appear in the shared or frontend files.

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

## Port note

The Express backend binds to `API_PORT` (default `3001`), read by `packages/backend/src/config/settings.ts`. `BACKEND_PORT` in env files is used only to construct `BACKEND_ORIGIN` and `CORS_ALLOWED_ORIGINS` in the prep scripts — it does not change what port the server listens on. Set both to `3001` to keep them consistent.

## Required variables by mode

### `cloud-dev`

Shared: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`
Backend: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`

No local Postgres, Redis, or NATS required. These services are either hosted (Supabase) or optional (Redis/NATS — app degrades gracefully when absent).

### `local`

Shared: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Backend: `DATABASE_URL`
Optional: `REDIS_URL`, `NATS_URL`

### `test`

Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### `prod`

All vars injected by the deployment platform. Never committed.
