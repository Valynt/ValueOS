# ValueOS Environment Modes and Precedence

## Canonical precedence (highest -> lowest)

1. Shell environment (exported variables in your terminal / CI runner)
2. Mode env file (`ops/env/.env.<mode>`)
3. Secure defaults from committed templates (for example `ops/env/.env.local.example`) copied into your local mode env file

## Canonical mode files

- `local` -> `ops/env/.env.local`
- `cloud-dev` -> `ops/env/.env.cloud-dev`
- `test` -> `ops/env/.env.test`
- `prod` -> `ops/env/.env.prod`

Start from `ops/env/.env.local.example` and copy to the mode file you run.

## Frontend and backend split files

To keep backend secrets out of frontend startup environments, use split files:

- Frontend-safe values by mode:
  - `ops/env/.env.frontend.local`
  - `ops/env/.env.frontend.cloud-dev`
  - `ops/env/.env.frontend.test`
  - `ops/env/.env.frontend.prod`
- Backend-only overlays by mode:
  - `ops/env/.env.backend.local`
  - `ops/env/.env.backend.cloud-dev`
  - `ops/env/.env.backend.test`
  - `ops/env/.env.backend.prod`

Starter templates:

- `ops/env/.env.frontend.local.example`
- `ops/env/.env.frontend.cloud-dev.example`
- `ops/env/.env.backend.local.example`
- `ops/env/.env.backend.cloud-dev.example`

Current behavior:

- Frontend prep script reads only `ops/env/.env.frontend.<mode>` and refuses `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- Backend prep script reads canonical mode env and then overlays `ops/env/.env.backend.<mode>` when present.

## Loader behavior by subsystem

### Docker Compose

- `docker-compose.yml` wraps `ops/compose/compose.yml`.
- Canonical invocation uses:
  - `--env-file ops/env/.env.local` (or other mode file)
  - `--env-file ops/env/.env.ports` (generated ports)
- Compose services fail fast for required secrets (for example `DATABASE_URL`) using `${VAR:?...}` syntax; do not rely on inline fallback credentials in compose files.

### Frontend (Vite)

- Humans set canonical names only (for example `API_BASE_URL`).
- `scripts/env/prepare-frontend-env.sh` reads `ops/env/.env.frontend.<mode>` and maps canonical names to Vite-required names:
  - `API_BASE_URL -> VITE_API_BASE_URL`
  - `SUPABASE_URL -> VITE_SUPABASE_URL`
  - `SUPABASE_ANON_KEY -> VITE_SUPABASE_ANON_KEY`
- Start frontend via `scripts/dev/start-frontend.sh` (or package script alias).

Do not place `SUPABASE_SERVICE_ROLE_KEY` in frontend env files.

### Backend runtime

- `scripts/env/prepare-backend-env.sh` validates mode requirements and exports:
  - `PORT <- BACKEND_PORT`
  - `CORS_ALLOWED_ORIGINS`
  - `DATABASE_URL` (or constructs from `PG*` atomics)
- Backend prep also reads optional secret overlays from `ops/env/.env.backend.<mode>`.
- Start backend via `scripts/dev/start-backend.sh` (or package script alias).

### Bash/Node scripts

- Bash scripts should source `scripts/lib/require-env.sh`, call `load_mode_env`, then `validate_mode_env`.
- Migration scripts must use `DATABASE_URL` as canonical DB target.
- Migration note: `DB_URL` and `DB_*` atomics are deprecated. Keep `DATABASE_URL` as source of truth; if a legacy consumer still reads `DB_URL`, derive it directly from `DATABASE_URL` and avoid separate host/user/password envs.

## Mode requirements

### `local`

- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Required DB target: `DATABASE_URL` (set in your mode env file).
- `REDIS_URL` / `NATS_URL` optional.

### `cloud-dev`

- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`
- Required DB target: `DATABASE_URL` (set in your mode env file).

### `test`

- Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### `prod`

- Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Typically injected by your deployment platform (not committed to git).
