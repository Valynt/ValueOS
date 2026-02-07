# ValueOS Engineering

> **"Stabilize the repo. Stop the world if necessary, but never ship broken windows."**

This repository operates under a **Strict Quality Governance** model. We prioritize runtime determinism and type-safety over feature velocity.

## 🚦 Quick Start (The Happy Path)

We do not guess if the app works. We verify it.

## 🤖 Agent Quick Start

```bash
# Open the devcontainer (VS Code)
# Command Palette -> "Dev Containers: Reopen in Container"

# Start the UI
pnpm dev
```

- UI location: `apps/ValyntApp`
- UI verification: `pnpm ui:smoke`, `pnpm ui:snap` (and any additional `pnpm ui:*` checks once added)

```bash
# 1. Install dependencies
pnpm install

# 2. Setup Environment
cp .env.example .env

# 3. Boot (Verifies Environment -> Syncs DB -> Starts App)
pnpm dev

```

If pnpm dev fails, do not bypass it. Fix your local environment.

🛡️ The Protocols

Protocol A: Environment Determinism

We run scripts/dev-verify.ts before every boot.

Node/PNPM Version: Enforced.

Docker Services: Must be reachable (Postgres: 5432, LocalStack: 4566).

Protocol B: The Green Islands

We use the Strangler Fig Pattern for type safety.

Legacy Code: Lives in the "Sea of Debt".

Strict Zones: Defined in `config/strict-zones.json` (canonical source).

Migration note: `packages/config-v2/strict-zones.config.js` is deprecated/removed. Do not re-introduce it.

These folders operate under tsconfig.strict.json.

Zero TypeScript errors allowed here.

If you touch a Green Island, you must keep it Green.

Enforcement command: `pnpm run typecheck:verify` (runs telemetry + strict-zone verification).

## 🔒 Dockerfile Policy

We enforce a small, focused policy to harden container images and keep runtime behavior consistent across environments.

Key rules:

- Runtime images MUST run as a **non-privileged user** (or use a nonroot base image).
- Copies of repository content into images (e.g. `COPY . .`, `package.json`, `pnpm-lock.yaml`) must use `--chown=valueos:valueos` to avoid permission/ownership drift.
- Dockerfiles must not install build toolchains (e.g. `build-essential`, `python3-dev`, `build-base`) in final runtime stages — keep toolchains in build stages only.
- `EXPOSE` ports and `ARG EXPOSE_PORT` defaults must match canonical ports defined in `config/ports.json`.

How to validate locally:

- Lint/validate Dockerfiles (strict mode):

```bash
DOCKERFILE_STRICT_CHOWN=1 pnpm run lint:dockerfiles
```

- Run the unit policy tests (fast local feedback):

```bash
pnpm exec vitest run test/dockerfile.spec.ts --config .config/configs/vitest.config.unit.ts
```

- Build representative images (mirrors CI):

```bash
BACKEND_PORT="$(node -e "console.log(require('./config/ports.json').backend.port)")"
docker build -f Dockerfile.optimized --build-arg EXPOSE_PORT="${BACKEND_PORT}" --build-arg APP=ValyntApp -t valynt-app:ci .
```

CI Integration:

- CI runs `pnpm exec vitest run test/dockerfile.spec.ts` (unit policy tests) and then runs the Dockerfile validator in **strict** mode (`DOCKERFILE_STRICT_CHOWN=1 pnpm run lint:dockerfiles`). Failures block subsequent image builds.

If a test or validator fails, the output will include file and line details so you can fix the Dockerfile and re-run the checks.

Protocol C: The Ratchet

We track the total number of TypeScript errors in the legacy codebase.

The Rule: You cannot merge a PR that increases the total error count.

The Process:

If you fix types, run pnpm ts:ratchet:update to lock in the lower baseline.

If you introduce new errors, CI will fail.

🛠️ Scripts & Commands

Command

Description

pnpm dev

The Standard. Verifies env, syncs DB, starts app.

pnpm dev:verify

Just checks if your machine is ready to run the app.

pnpm db:status

Checks if local DB matches migration files.

pnpm db:sync

Idempotently applies pending SQL migrations.

pnpm ts:ratchet:check

Checks if you exceeded the error budget.

pnpm ts:ratchet:update

LOCKS IN GAINS. Run this after fixing type errors.
```
