# ValueOS Environment Modes and Precedence

## Canonical precedence (highest -> lowest)
1. Shell environment (exported variables in your terminal / CI runner)
2. Mode env file (`ops/env/.env.<mode>`)
3. Repo defaults embedded in scripts/compose

## Canonical mode files
- `local` -> `ops/env/.env.local`
- `cloud-dev` -> `ops/env/.env.cloud-dev`
- `test` -> `ops/env/.env.test`
- `prod` -> `ops/env/.env.prod`

Start from `ops/env/.env.local.example` and copy to the mode file you run.

## Loader behavior by subsystem

### Docker Compose
- `docker-compose.yml` wraps `ops/compose/compose.yml`.
- Canonical invocation uses:
  - `--env-file ops/env/.env.local` (or other mode file)
  - `--env-file ops/env/.env.ports` (generated ports)
- `ops/compose/compose.yml` services also include `env_file: ../../ops/env/.env.local` for deterministic local defaults.

### Frontend (Vite)
- Humans set canonical names only (for example `API_BASE_URL`).
- `scripts/env/prepare-frontend-env.sh` maps canonical names to Vite-required names:
  - `API_BASE_URL -> VITE_API_BASE_URL`
  - `SUPABASE_URL -> VITE_SUPABASE_URL`
  - `SUPABASE_ANON_KEY -> VITE_SUPABASE_ANON_KEY`
- Start frontend via `scripts/dev/start-frontend.sh` (or package script alias).

### Backend runtime
- `scripts/env/prepare-backend-env.sh` validates mode requirements and exports:
  - `PORT <- BACKEND_PORT`
  - `CORS_ALLOWED_ORIGINS`
  - `DATABASE_URL` (or constructs from `PG*` atomics)
- Start backend via `scripts/dev/start-backend.sh` (or package script alias).

### Bash/Node scripts
- Bash scripts should source `scripts/lib/require-env.sh`, call `load_mode_env`, then `validate_mode_env`.
- Migration scripts must use `DATABASE_URL` as canonical DB target.

## Mode requirements

### `local`
- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Required DB target: `DATABASE_URL` OR all `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`
- `REDIS_URL` / `NATS_URL` optional.

### `cloud-dev`
- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`
- Required DB target: `DATABASE_URL` OR all PG atomics.

### `test`
- Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### `prod`
- Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Typically injected by your deployment platform (not committed to git).
