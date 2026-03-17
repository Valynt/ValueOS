## Why

A new engineer cloning ValueOS today faces three conflicting setup paths: the root README (references `cp .env.example .env.local` and `pnpm run db:push`), `docs/environments/local-development.md` (describes a Docker Compose multi-container stack), and the Gitpod/Ona automation path (devcontainer + `ops/env/` three-file env system). None of these is wrong, but none is complete on its own. The result is guesswork at every step — wrong env file location, wrong migration command, wrong startup command — and a repo that feels unstable before a single line of code runs.

This change establishes one documented, tested boot path for the cloud-dev runtime (the intended development target for this repo) and removes or clearly subordinates the conflicting paths.

## What Changes

- **README quickstart rewritten** to reflect the actual cloud-dev path: `ops/env/` file setup → `pnpm install` → `pnpm run db:migrate` → `gitpod automations service start backend frontend`
- **Root `.env.example` and `.env.local.example` demoted** — these files describe a local Docker Compose path that is not the primary dev target; a header comment is added to each pointing to `ops/env/README.md` for the primary cloud-dev setup and to `docs/environments/local-development.md` for the full local Docker path
- **`pnpm run db:push` removed from README** — this command does not exist in `package.json`; the correct command is `pnpm run db:migrate`
- **`ops/env/README.md` linked from root README** as the single source of truth for env var setup
- **`scripts/dx/doctor.js` wired into the setup flow** — referenced explicitly as the preflight check step
- **`docs/launch-readiness.md` created** — captures blockers, launch-safe issues, canonical commands, required env vars, and smoke test checklist

## Capabilities

### New Capabilities

- `canonical-boot-path`: The single documented sequence a new engineer follows from clone to running app in cloud-dev mode
- `launch-readiness`: Structured triage of what must be fixed before launch vs. what can follow

### Modified Capabilities

- `env-contract`: The three-file env system (`ops/env/.env.<mode>`, `.env.frontend.<mode>`, `.env.backend.<mode>`) is already implemented; this change makes it the only documented path and removes references to the root `.env.example` as a setup target

## Impact

- `README.md` — quickstart section rewritten
- `docs/launch-readiness.md` — new file
- `docs/environments/local-development.md` — add note that cloud-dev is the primary path; Docker Compose local is an alternative
- No code changes — this is documentation and env file organisation only
