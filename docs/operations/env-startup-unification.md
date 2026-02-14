---
title: Environment and Startup Unification
owner: team-operations
status: active
review_date: 2026-05-31
---

# Environment and Startup Unification

## Motivation

Provide a single deterministic, repo-native environment and startup workflow that works across local, cloud-dev, test, and prod modes and fails fast with actionable guidance.

Eliminate duplicated or ambiguous environment variable names and scattered migration entrypoints so scripts, Compose, and applications use the same canonical variables and safety gates.

## Description

### Canonical environment and mode docs

- Added canonical template: `ops/env/.env.local.example`.
- Added mode reference and precedence docs: `ops/env/README.md`.
- Mode-to-file mapping is explicitly documented for `local`, `cloud-dev`, `test`, and `prod`.

### Shared env loading and validation

- Implemented shared loader/validator: `scripts/lib/require-env.sh`.
- Loader behavior:
  - constructs `DATABASE_URL` from `PG*` atomics when needed,
  - emits actionable missing-variable messages,
  - enforces per-mode requirements.

### Frontend/backend env bridge + startup entrypoints

- Added frontend env bridge: `scripts/env/prepare-frontend-env.sh`.
- Added backend env bridge: `scripts/env/prepare-backend-env.sh`.
- Added startup scripts:
  - `scripts/dev/start-frontend.sh`
  - `scripts/dev/start-backend.sh`
- Uses a single mapping layer to derive framework-prefixed variables (for example `API_BASE_URL -> VITE_API_BASE_URL`).

### Compose variable unification

Canonicalized Compose variable usage in:

- `ops/compose/compose.yml`
- `ops/compose/profiles/runtime-docker.yml`

Canonical names include:

- `FRONTEND_PORT`
- `BACKEND_PORT`
- `API_BASE_URL`
- `DATABASE_URL`
- `SUPABASE_*`
- `REDIS_URL`
- `NATS_URL`
- `APP_ENV`

### Canonical migration runner + shims

- Implemented deterministic migration runner: `scripts/db/apply-migrations.sh`.
- Migration safety gate:
  - refuses remote DB migrations unless `ALLOW_REMOTE_DB_MIGRATIONS=true` is set.
- Updated thin delegation shims to call the canonical runner with a deprecation warning:
  - `scripts/migrate.sh`
  - `scripts/run-migrations.sh`
  - `scripts/apply-migrations.sh`
  - `infra/supabase/supabase/scripts/apply_migrations.sh`

### Package scripts and bootstrap updates

- Updated package entrypoints to use canonical scripts (for example `dev:frontend`, `dev:backend`, `db:apply-migrations`, `dx:cloud-dev`).
- Updated bootstrap behavior to create/use `ops/env/.env.local` from the canonical template.

## Validation Performed

- Ran shell syntax checks (`bash -n`) for all new or modified shell scripts; no syntax errors.
- Ran `node --check scripts/dx/mode-entrypoint.js`; passed.
- Verified JSON manifest parsing with Node for:
  - `package.json`
  - `apps/ValyntApp/package.json`
  - `packages/backend/package.json`
- Re-ran static checks (`bash -n`, `node --check`) across the modified set; no failures.

