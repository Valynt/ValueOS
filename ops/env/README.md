# ValueOS Environment Files

`ops/env/` is now a **bootstrap and local-development helper only**.

## Policy

- **Production-class secrets must not be stored in flat env files on disk.** This includes staging and production copies of `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, LLM provider keys, Stripe secrets, and approval webhook secrets.
- For **staging** and **production**, the canonical source of truth is the managed-secret flow used by `packages/backend/src/server.ts` via `initSecrets()` and validated by `packages/backend/src/config/secrets/SecretValidator.ts` and related files under `packages/backend/src/config/secrets/`.
- `ops/env/*.template` values are for **bootstrap metadata, local development, and non-sensitive placeholders only**.
- If a deploy step needs a secret, hydrate it from the managed-secret backend into CI/runtime memory or a platform secret object; do **not** write it back to `ops/env/*.staging*`, `ops/env/*.prod*`, or host-side `.env` files.

## Allowed uses for env files in `ops/env/`

### Local development and test

Use `ops/env/` files normally for:

- `local`
- `cloud-dev`
- `test`

These modes may still use gitignored host-side env files because they are workstation/bootstrap flows rather than production-class deployments.

### Staging and production

Only store **non-sensitive bootstrap/configuration values** in env files, for example:

- `APP_DOMAIN`
- `ACME_EMAIL`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `CORS_ALLOWED_ORIGINS`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SECRETS_PROVIDER`
- `SECRETS_TENANT_ID`
- `DATABASE_URL_SECRET_NAME`
- `SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME`
- `REDIS_URL_SECRET_NAME`

If a value would grant access to customer data, infrastructure, external APIs, or signing operations, it does **not** belong in a flat env file.

## Managed-secret naming convention

The backend secret providers already resolve secrets from tenant-scoped managed paths:

- **AWS Secrets Manager path:** `valuecanvas/<environment>/tenants/<tenantId>/<secretName>`.
- **Vault KV v2 path:** `secret/data/<environment>/tenants/<tenantId>/<secretName>`.

For staging and production, use `tenantId=platform` unless a deployment explicitly documents a different tenant scope.

### Canonical staging secret names

| Runtime env var | Managed secret name | AWS path (`staging`, `platform`) | Vault path (`staging`, `platform`) | Rotation owner |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | `database-url` | `valuecanvas/staging/tenants/platform/database-url` | `secret/data/staging/tenants/platform/database-url` | Platform Engineering |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-service-key` | `valuecanvas/staging/tenants/platform/supabase-service-key` | `secret/data/staging/tenants/platform/supabase-service-key` | Platform Engineering |
| `REDIS_URL` | `redis-url` | `valuecanvas/staging/tenants/platform/redis-url` | `secret/data/staging/tenants/platform/redis-url` | Platform Engineering |
| `JWT_SECRET` | `jwt-secret` | `valuecanvas/staging/tenants/platform/jwt-secret` | `secret/data/staging/tenants/platform/jwt-secret` | Application Security |
| `ENCRYPTION_KEY` | `encryption-key` | `valuecanvas/staging/tenants/platform/encryption-key` | `secret/data/staging/tenants/platform/encryption-key` | Application Security |
| `TOGETHER_API_KEY` | `together-api-key` | `valuecanvas/staging/tenants/platform/together-api-key` | `secret/data/staging/tenants/platform/together-api-key` | AI Platform |
| `OPENAI_API_KEY` | `openai-api-key` | `valuecanvas/staging/tenants/platform/openai-api-key` | `secret/data/staging/tenants/platform/openai-api-key` | AI Platform |
| `APPROVAL_ACTION_SECRET` | `approval-action-secret` | `valuecanvas/staging/tenants/platform/approval-action-secret` | `secret/data/staging/tenants/platform/approval-action-secret` | Application Security |
| `APPROVAL_WEBHOOK_SECRET` | `approval-webhook-secret` | `valuecanvas/staging/tenants/platform/approval-webhook-secret` | `secret/data/staging/tenants/platform/approval-webhook-secret` | Application Security |
| `STRIPE_SECRET_KEY` | `stripe-secret-key` | `valuecanvas/staging/tenants/platform/stripe-secret-key` | `secret/data/staging/tenants/platform/stripe-secret-key` | Finance Platform |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook-secret` | `valuecanvas/staging/tenants/platform/stripe-webhook-secret` | `secret/data/staging/tenants/platform/stripe-webhook-secret` | Finance Platform |
| `SENTRY_DSN` | `sentry-dsn` | `valuecanvas/staging/tenants/platform/sentry-dsn` | `secret/data/staging/tenants/platform/sentry-dsn` | Platform Engineering |

## Bootstrap file conventions

Treat staging/production env files as bootstrap manifests, for example:

- `ops/env/.env.staging.bootstrap`
- `ops/env/.env.production.bootstrap`

Those bootstrap files should contain:

- deployment topology and domain values
- frontend public build-time values
- managed-secret provider selection (`SECRETS_PROVIDER`, `AWS_REGION`, `VAULT_ADDR`, etc.)
- secret **names/paths metadata**, not the secret values themselves

## Existing local/dev guidance

All env files live in `ops/env/`. Files without `.example` in the name are gitignored.

### Gitignored files

```text
ops/env/.env.cloud-dev
ops/env/.env.frontend.cloud-dev
ops/env/.env.backend.cloud-dev
ops/env/.env.local
ops/env/.env.frontend.local
ops/env/.env.backend.local
ops/env/.env.test
ops/env/.env.staging.bootstrap
ops/env/.env.production.bootstrap
ops/env/.env.prod
```

### Safe to commit

Only placeholder/reference files should be committed.

## Quick setup

```bash
# Interactive -- prompts for environment
bash scripts/setup-env.sh

# Non-interactive
bash scripts/setup-env.sh dev      # -> ops/env/.env.local
bash scripts/setup-env.sh staging  # bootstrap metadata only; do not store secrets on disk
bash scripts/setup-env.sh prod     # bootstrap metadata only; do not store secrets on disk
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

## Variable ownership for local/cloud-dev

Each local-ish mode uses three files with distinct ownership:

| File | Who reads it | What goes in it |
| --- | --- | --- |
| `.env.<mode>` | Both frontend and backend prep scripts | `APP_ENV`, `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF` |
| `.env.frontend.<mode>` | `scripts/env/prepare-frontend-env.sh` only | Port/origin values for Vite mapping. No secrets. |
| `.env.backend.<mode>` | `scripts/env/prepare-backend-env.sh` only | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`, `API_PORT` |

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

### `staging` / `prod`

Required in flat env files: non-secret bootstrap/config only.

Required in managed secret store: production-class secrets listed in the canonical staging secret table above, with production using the same secret names under the `production` environment path.
