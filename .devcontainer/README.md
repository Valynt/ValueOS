# Devcontainer Toolchain Pinning

Toolchain versions for the devcontainer are pinned in `.devcontainer/versions.json`.

Use this file as the single source of truth for updating pinned versions (for example: `node`, `pnpm`, `kubectl`, and `terraform`). Devcontainer scripts should read from this JSON file instead of hardcoded literals.

## Single bootstrap entrypoint

Devcontainer bring-up is intentionally routed through one script:

- `postCreateCommand` → `.devcontainer/scripts/post-create.sh`
- `post-create.sh` (thin wrapper) → `.devcontainer/scripts/bootstrap.sh`

`bootstrap.sh` performs deterministic setup in one path:

1. validates workspace and required environment
2. checks DNS/network basics
3. activates pinned pnpm via Corepack
4. installs dependencies
5. runs migrations in explicit mode (`DX_DB_MODE=local|cloud`)
6. runs `.devcontainer/scripts/doctor.sh`

## Environment files

- `.env.ports` is the canonical port mapping file for local/devcontainer compose flows.
- `.env.ports.example` contains default non-secret port values.
- `.env.local` is for secrets only (API keys, tokens, connection strings) and should not define port mappings.

> Troubleshooting: if DevContainer startup fails with an interpolation error such as
> `required variable SUPABASE_SERVICE_ROLE_KEY is missing a value`, Docker Compose
> could not find the value for interpolation. Compose reads variables from the
> shell or a `.env` file in the compose project directory — it does **not** read
> service `env_file` entries for interpolation.

- Quick fix: `cp ops/env/.env.local .env`
- Convenient helper: `bash .devcontainer/scripts/ensure-dotenv.sh` (creates `.env` from `ops/env/.env.local` if missing)

This ensures `docker compose -f .devcontainer/docker-compose.devcontainer.yml config` and
`Dev Containers: Reopen in Container` succeed without interpolation errors.
