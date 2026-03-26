# Dev Environment

> **Note:** References to `pnpm run dx` and `pnpm run dx:*` in this document are design specifications, not implemented package.json scripts. Use `gitpod automations service start <id>` to start services. See `.windsurf/automations.yaml` for the canonical service list.

**Last Updated**: 2026-02-08

**Consolidated from 7 source documents**

---

## Table of Contents

1. [Dev Environment Service](#dev-environment-service)
2. [Dev: System Invariants & Contracts](#dev:-system-invariants-&-contracts)
3. [ValueOS Local Development Environment](#valueos-local-development-environment)
4. [ValueOS Development Master Context](#valueos-development-master-context)
5. [Dev: Anti-Fragility & Resilience](#dev:-anti-fragility-&-resilience)
6. [Dev: Database Governance](#dev:-database-governance)
7. [Dev: DX Orchestration & Setup](#dev:-dx-orchestration-&-setup)

---

## Dev Environment Service

*Source: `dev-env-service.md`*

Purpose
- Define the components that make up the local dev environment and the processes required to set it up fully.
- Provide a deterministic “works on a new machine” path (Docker + Dev Container + pnpm).
- Specify the event/audit signals that indicate the dev env is healthy, degraded, or broken.
- Reduce “tribal knowledge” by making invariants explicit and testable.

Scope
- Local dev environment (Docker Compose stack, devcontainer, scripts, ports, env files).
- Setup + verification workflows for developers and CI.
- DevEnv events and health signals (not business-domain audit trail events).

Non-goals
- Production deployment details.
- Detailed contributor guide for every subsystem (link to owning docs instead).
- Replacing README; this is a canonical “dev env contract”.

---

## Components

### 1) Dev Container (VS Code / Windsurf / DevPod)
Responsibility
- Provides a consistent Node/pnpm toolchain and shell environment.
- Prevents host-machine drift (Node versions, global tooling).
- Attaches to the Compose stack reliably.

Invariants
- Node and pnpm versions match `package.json -> engines`.
- Container user is non-root for development workflows where possible.
- The devcontainer must not require pulling a registry image (must build locally).

Health signals
- Devcontainer builds successfully.
- VS Code attaches with no “image pull” fallback.
- `pnpm -v` and `node -v` satisfy `engines`.

Primary config
- `Dockerfile.dev`
- `ops/compose/profiles/devcontainer.yml`
- `.devcontainer/devcontainer.json`

---

### 2) Docker Compose Stack (Local Services)
Responsibility
- Brings up all required dependencies (db, auth, cache, gateway, etc.).
- Establishes a stable network and port map.

Invariants
- `compose.yml` is the source of truth; overrides only add/modify dev behavior.
- Ports are derived from `config/ports.json` (avoid hard-coded drift).
- Services must start in a predictable order or expose readiness checks.

Health signals
- `pnpm run dx:doctor` reports services healthy/running.
- App can connect to dependencies via service DNS names on the Compose network.
- No recurring crash loops; logs stable after warm-up.

Primary config
- `compose.yml`
- any `compose.*.override.yml`
- `config/ports.json`

---

### 3) Package Manager / Monorepo Tooling (pnpm)
Responsibility
- Installs dependencies deterministically.
- Enforces workspace boundaries and lockfile integrity.

Invariants
- `pnpm-lock.yaml` is committed and authoritative.
- `pnpm install --frozen-lockfile` succeeds in CI.
- `preinstall` guard prevents npm/yarn usage if required.

Health signals
- `pnpm install` completes without engine errors.
- Workspace packages resolve correctly.
- `pnpm -r test` runs across packages without missing deps.

Primary config
- `package.json` (engines, scripts, workspaces)
- `pnpm-lock.yaml`
- `.npmrc` (if present)

---

### 4) Database + Migrations (Supabase/Postgres/Prisma/etc.)
Responsibility
- Runs local DB and applies migrations safely.
- Provides repeatable seed and reset workflows.

Invariants
- Migrations are the only way schema changes occur.
- Reset/seed flows are idempotent (safe to run repeatedly).
- Local DB credentials are sourced from env files, not hard-coded.

Health signals
- DB container is healthy and accepts connections.
- Migrations apply cleanly from a clean state.
- Seed produces expected baseline records.

Primary config
- `supabase/` or `prisma/` (depending on stack)
- `scripts/dev/*` for start/reset/seed

---

### 5) API / Backend Service
Responsibility
- Exposes local API for the frontend and internal tools.
- Connects to DB, cache, audit, and agent services.

Invariants
- Backend port comes from `config/ports.json`.
- Uses tenant-safe defaults for local dev (safe seed tenant, test users).
- Emits DevEnv events for lifecycle transitions (boot, ready, degraded).

Health signals
- Readiness endpoint returns OK.
- Logs show successful DB connection and migration check.
- No unhandled rejections during startup.

Primary config
- Backend Dockerfile / compose service definition
- backend env template(s)

---

### 6) Frontend (ValyntApp)
Responsibility
- Runs the local UI with hot reload.
- Connects to backend through stable base URL/port mapping.

Invariants
- Frontend uses a single configured base URL (no ad-hoc hard-coding).
- Dev server binds to the expected port from `config/ports.json` (or a clearly documented default).
- Build artifacts are not required for local dev (unless explicitly documented).

Health signals
- UI loads and fetches from backend successfully.
- No repeated network errors / CORS failures.
- HMR functions (file edit -> UI update).

Primary config
- Frontend dev scripts
- Vite/Next config
- env files for base URL

---

### 7) Observability for Dev (Logs, Traces, Health)
Responsibility
- Make failures diagnosable quickly.
- Provide “one command” health check output.

Invariants
- Every core service has a basic health/readiness signal.
- A single “doctor” command exists and is kept current.

Health signals
- `pnpm dx doctor` (or equivalent) returns green.
- Logs are routed consistently and include service names.

Primary config
- `scripts/dx/doctor.*`
- log settings in compose/services

---

## DevEnv Events (Contract)

These are NOT business audit events. They are developer-facing signals that can be used by:
- `dx doctor`
- CI smoke checks
- local troubleshooting

Event envelope
- `eventType`: string
- `severity`: info | warn | error
- `component`: string (devcontainer|compose|db|backend|frontend|tooling)
- `message`: string
- `timestamp`: ISO string
- `metadata`: object (optional)

Core event types
- `dev_env_boot_requested`
- `dev_env_boot_started`
- `dev_env_service_started`
- `dev_env_service_ready`
- `dev_env_service_degraded`
- `dev_env_service_failed`
- `dev_env_ports_validated`
- `dev_env_migrations_applied`
- `dev_env_seed_completed`
- `dev_env_doctor_passed`
- `dev_env_doctor_failed`

Recommended emission points
- Start scripts (`dx:up`, `dx:up:seed`)
- Doctor script
- Backend/Frontend startup (optional)

---

## Setup Process (Deterministic)

### Step 0: Preflight
- Node version matches `package.json engines`
- pnpm version matches `packageManager`
- Docker is installed and running

Commands
- `node -v`
- `pnpm -v`
- `docker version`

### Step 1: Install dependencies
- `pnpm install --frozen-lockfile` (first run may omit frozen if bootstrapping)

### Step 2: Bring up services
- `pnpm dx:up`
- or `pnpm run dx up --mode docker`

### Step 3: Apply migrations
- `pnpm dx db:migrate` (or equivalent)
- confirm `dev_env_migrations_applied`

### Step 4: Seed baseline data (optional but recommended)
- `pnpm dx:up:seed`
- confirm `dev_env_seed_completed`

### Step 5: Start app processes
- backend: `pnpm --filter backend dev` (or compose service)
- frontend: `pnpm --filter ValyntApp dev`

### Step 6: Verify health
- `pnpm dx doctor`
- open UI and run a basic flow

---

## Troubleshooting Playbook (Fast paths)

Engine mismatch (Node/pnpm)
- Symptom: `ERR_PNPM_UNSUPPORTED_ENGINE`
- Fix: use required Node version (nvm/volta/devcontainer toolchain)

Port conflicts
- Symptom: service won’t start or binds wrong port
- Fix: validate against `config/ports.json`, stop conflicting host processes

Line ending drift / mass git changes
- Symptom: hundreds of “changed” files after copy
- Fix: enforce `.gitattributes` and renormalize once

Compose image pull instead of build
- Symptom: devcontainer tries to pull `valueos-app`
- Fix: ensure override builds and tags `valueos-app:latest`

---

## Acceptance Criteria
- New machine → running UI + API in under one setup path.
- One command identifies common failure modes (`dx doctor`).
- Port + env configuration is single-source-of-truth and validated in CI.
- DevEnv events exist for boot, readiness, and failures.

---

## Dev: System Invariants & Contracts

*Source: `dev/system-invariants.md`*

## 1. Demo User Contract

- **Email:** `admin@valueos.com`
- **Password:** Set `DEMO_USER_PASSWORD` explicitly or use one-time generated password emitted to stderr
- **Role:** `admin`
- **Invariants:** Email/UUID remain deterministic; password is never hardcoded and must meet strong policy.
- **Seeding:** Idempotent via `scripts/seed-demo-user.ts`.

## 2. Port Assignments (Source: `config/ports.json`)

| Service             | Port  | Env Var                |
| :------------------ | :---- | :--------------------- |
| **Frontend**        | 5173  | `VITE_PORT`            |
| **Backend**         | 3001  | `API_PORT`             |
| **Postgres (Deps)** | 5432  | `POSTGRES_PORT`        |
| **Redis**           | 6379  | `REDIS_PORT`           |
| **Supabase API**    | 54321 | `SUPABASE_API_PORT`    |
| **Supabase Studio** | 54323 | `SUPABASE_STUDIO_PORT` |
| **Supabase DB**     | 54322 | `SUPABASE_DB_PORT`     |

## 3. Environment Variable Requirements

- **Backend:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Frontend:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Invariants:** Missing required variables must cause an immediate crash on startup.
- **Migration note:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_URL` are deprecated for backend runtime config. Prefer `DATABASE_URL`; `DB_URL` may be temporarily derived from `DATABASE_URL` only for legacy compatibility.

## 4. Database & Migration Contracts

- **Reset:** `pnpm run db:reset` must drop all tables and recreate the schema from scratch.
- **Migrations:**
  - Location: `supabase/migrations/*.sql`.
  - Naming: `YYYYMMDDHHMMSS_description.sql` (14-digit timestamp).
  - Append-only: Never edit a migration once applied.
- **Health Check:** `GET /health` must return 200 OK without authentication.

## 5. DevContainer Specifics

- **Port Forwarding:** Auto-forwarded by VS Code; use `127.0.0.1` instead of `localhost` in shell.
- **HMR:** Disabled in DevContainer due to unreliable WebSocket forwarding; manual refresh required.
- **IPv4:** All services bind to `127.0.0.1` explicitly to avoid container resolution issues.

---

**Last Updated:** 2026-01-28
**Related:** `docs/dev/DEV_MASTER.md`, `config/ports.json`

---

## ValueOS Local Development Environment

*Source: `dev-environment.md`*

Technical Design Brief

## 1. Purpose

This document defines the canonical local development environment for ValueOS.

The goal is to provide a deterministic, reproducible, one-command developer experience where:

Opening the repository in a Dev Container brings up a fully functional, login-capable application, including authentication, database, and supporting services.

This environment is optimized for:

- reliability (no "works on my machine")
- fast iteration
- minimal cognitive overhead
- alignment with production topology where appropriate

## 2. Problem Statement

ValueOS uses Supabase for authentication and database access.

Without Supabase running locally and the database migrated, the application cannot authenticate users or function meaningfully in development.

Historically, the environment was split into:

- a dev container (editor/runtime)
- a separate dev environment (Supabase, Redis, Postgres)

This split caused:

- unclear source of truth
- inconsistent startup procedures
- hidden dependencies
- fragile onboarding
- confusion around Docker usage (Docker-in-Docker vs host Docker)

## 3. Design Goals

### Primary Goals

- **Single Source of Truth**: One canonical definition of the local stack.
- **One-Step Startup**: "Reopen in Container" yields a working, login-capable app.
- **No Docker-in-Docker**: One Docker engine only.
- **Supabase First-Class**: Auth and DB are always present and correctly wired.
- **Fast & Idempotent**: No unnecessary reinstalls or rebuilds on every open.

### Non-Goals

- Running production-grade infrastructure locally
- Supporting multiple mutually incompatible local setups
- Optimizing for non-containerized workflows

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────┐
│ Docker Engine (WSL2 / Docker Desktop)                     │
│                                                          │
│ ┌──────────────┐                                         │
│ │ app          │ ← VS Code Dev Container attaches here   │
│ │ (ValueOS)    │                                         │
│ └──────┬───────┘                                         │
│        │ internal DNS                                    │
│        ▼                                                 │
│ ┌──────────────┐ ┌──────────────┐                        │
│ │ Supabase     │ │ Redis        │                        │
│ │ (Auth + DB)  │ │              │                        │
│ └──────────────┘ └──────────────┘                        │
│                                                          │
│ Shared Docker network: valueos-network                   │
│ Named volumes for persistence                            │
└──────────────────────────────────────────────────────────┘
```

**Key Principle**: The devcontainer is not the environment — it is the workspace service inside a multi-container environment defined by Docker Compose.

## 5. Technology Stack

### Core Components

- **VS Code Dev Containers**: Development workspace
- **Docker Compose**: Single project orchestration
- **Supabase (local)**: Authentication (GoTrue), Postgres database, REST/Realtime/Storage
- **Redis**: Cache and background coordination
- **Node.js + pnpm**: Application runtime

### Tooling Decisions

- One Docker engine (host/WSL2)
- No Docker daemon inside containers
- Optional Docker CLI access only if explicitly required

## 6. Source of Truth

| File                                            | Responsibility                  |
| ----------------------------------------------- | ------------------------------- |
| `.devcontainer/devcontainer.json`               | Entry point, VS Code attachment |
| `ops/compose/compose.yml + ops/compose/profiles/devcontainer.yml` | Entire local stack              |
| `.devcontainer/Dockerfile.optimized`            | App tooling image               |
| `.deps_installed`                               | Install marker (generated)      |

There is no separate "dev env" compose for local development.

## 7. Docker Compose Design

### Services Defined

**Mandatory (default profile):**

- `app` – ValueOS devcontainer service
- `db` – Supabase Postgres
- `auth` – Supabase GoTrue
- `rest` – PostgREST
- `realtime` – Supabase Realtime
- `storage` – Supabase Storage API
- `meta` – Postgres Meta (introspection)
- `kong` – API gateway
- `redis` – Cache service

**Optional profiles:**

- `studio` – Supabase Studio UI
- `debug` – Publishes DB/Redis ports to host

### Networking

- Single named network: `valueos-network`
- All services communicate via service DNS names, never localhost

### Persistence

Named volumes:

- `postgres-data`
- `storage-data`
- `redis-data`
- `pnpm-store` (for performance)

## 8. Devcontainer Responsibilities

### What the Devcontainer Does

- Hosts the application runtime
- Provides consistent toolchain (Node, pnpm, git)
- Attaches VS Code to the correct container
- Bootstraps dependencies once
- Applies DB migrations to ensure login works

### What It Explicitly Does Not Do

- Run Docker daemon
- Orchestrate infrastructure imperatively
- Start background services manually

## 9. Provisioning & Lifecycle

### Startup Flow

1. Developer opens repo in VS Code
2. VS Code runs Dev Containers
3. Docker Compose starts full stack
4. VS Code attaches to app
5. `postCreateCommand` runs:
   - Installs dependencies once
   - Applies DB migrations
6. App is ready for login

### Idempotency Guarantees

- Dependency installation is marker-gated (`.deps_installed`)
- Migrations are safe to rerun
- Rebuild ≠ reinstall

## 10. postCreateCommand Strategy

### Principles

- Must be fast
- Must be idempotent
- Must guarantee auth works

### Responsibilities

- `pnpm install` (once per container)
- Apply Supabase DB migrations

### Explicitly Excluded

- Heavy diagnostics
- Destructive resets
- CI-like validation

Diagnostics (`dx:doctor`) are run manually.

## 11. Supabase Strategy

### Why Supabase Is Embedded

- Auth is a hard dependency
- Login must work by default
- DB schema must match application expectations

### Chosen Pattern

Supabase runs as Compose services, not via CLI-managed containers.

**Benefits:**

- Deterministic
- Inspectable
- Debuggable
- No Docker socket exposure needed

## 12. Docker Usage Policy

### Default

- No docker commands executed inside app
- No `/var/run/docker.sock` mount

### Optional Extension (if ever needed)

If a future workflow requires Docker commands inside the devcontainer:

- Install docker CLI only
- Mount docker.sock
- Still no Docker-in-Docker

This is a deliberate opt-in, not default behavior.

## 13. Security & Isolation

- No privileged containers
- No nested daemons
- Minimal surface area
- Credentials scoped to local dev only
- Volumes isolated per project

## 14. Developer Experience Outcomes

After this design:

**New contributor:**

1. Clones repo
2. Clicks "Reopen in Container"
3. Logs in successfully

No README archaeology, no "run this script first", no hidden infra assumptions, no Docker confusion.

## 15. Verification Checklist

A valid environment satisfies:

- [ ] `pnpm run dx:doctor` shows app + supabase + redis
- [ ] App can authenticate locally
- [ ] Supabase DB persists across restarts
- [ ] Rebuild does not reinstall deps unless marker removed
- [ ] No Docker daemon inside containers
- [ ] Service hostnames resolve correctly

## 16. Future Extensions (Explicitly Planned)

- Compose profiles for observability
- CI reuse of the same compose stack
- Optional test-only services
- Devcontainer Tasks for common workflows

## 17. Summary

This design makes the devcontainer the owner of the entire local development environment without collapsing boundaries or introducing unnecessary complexity.

It aligns tooling, infrastructure, and developer workflow around one principle:

**Local development should be boring, predictable, and invisible.**

---

## ValueOS Development Master Context

*Source: `dev/DEV_MASTER.md`*

**Version:** 1.0.0
**Last Updated:** 2026-01-28
**Status:** Authoritative Dev Guide

---

## 1. Development Philosophy: Anti-Fragility

ValueOS development is designed to be "Beyond Graceful Degradation." We prioritize reproducibility and resilience through:

- **Ghost Mode (Auto-Mocking):** Automatic fallback to MSW when the backend is unreachable.
- **Runtime Config Injection:** Configuration is loaded at runtime via `window.__CONFIG__`, eliminating build-time `.env` mismatches.
- **Smart Remediation:** The UI provides "Fix It" buttons for known failure scenarios (e.g., seeding DB, running migrations).
- **Dev HUD:** A persistent overlay for environment switching, auth masquerade, and feature flag overrides.

---

## 2. System Invariants & Contracts

To ensure a reproducible environment, the following contracts must never be violated:

- **Demo User:** `admin@valueos.com` / `ValueOS2026!` (Fixed UUID, Role: `admin`).
- **Port Source of Truth:** `config/ports.json` (Frontend: 5173, Backend: 3001, Supabase API: 54321).
- **Database Reset:** `pnpm run db:reset` must be idempotent and produce an identical schema every time.
- **Migrations:** Append-only, 14-digit timestamp naming, and lexical execution order.

---

## 3. DX Orchestration Flow

The `pnpm run dx` command automates the entire development stack:

1.  **Env Generation:** Compiles `.env.local` and `.env.ports` from `config/ports.json`.
2.  **Preflight Checks:** Validates Docker, Node, and port availability.
3.  **Dependency Startup:** Launches Postgres (5432) and Redis (6379) via Docker.
4.  **Supabase Lifecycle:** Starts Supabase CLI; falls back to `valueos-postgres` if the CLI fails.
5.  **Schema Sync:** Applies migrations and regenerates TypeScript types.
6.  **Service Boot:** Starts Backend (3001) and Frontend (5173).

---

## 4. Sub-Contexts & Specialized Docs

Detailed development guides are consolidated into the following specialized documents:

1.  **[System Invariants & Contracts](./system-invariants.md):** Fixed credentials, port assignments, and environment variable requirements.
2.  **[DX Orchestration & Setup](./dx-orchestration.md):** Step-by-step breakdown of the `dx` flow, recovery commands, and reproducible setup.
3.  **[Anti-Fragility & Resilience](./anti-fragility.md):** Ghost Mode, Dev HUD, Runtime Config, and Smart Remediation details.
4.  **[Database Governance](./database-governance.md):** Migration inventory, naming conventions, and schema alignment plans.

---

## 5. Critical Commands Baseline

- **Setup:** `pnpm run dx:env` → `pnpm run dx`
- **Diagnostics:** `pnpm run dx:doctor`
- **Reset:** `pnpm run dx:reset` (Soft) or `pnpm run dx:clean` (Hard)
- **Database:** `pnpm run db:push` | `pnpm run seed:demo` | `pnpm run db:types`

### Migration note: `TCT_SECRET` is now mandatory in local development

- Backend startup now fails fast in **every** environment (including `development` and `test`) if `TCT_SECRET` is not set.
- Run `bash scripts/dx/bootstrap-env.sh` to create/update `ops/env/.env.backend.local` and provision a per-developer `TCT_SECRET`.
- If you manage env files manually, add `TCT_SECRET=$(openssl rand -hex 32)` to `ops/env/.env.backend.local`.

---

**Maintainer:** AI Implementation Team
**Related:** `docs/context/MASTER_CONTEXT.md`, `docs/getting-started/quickstart.md`

---

## Dev: Anti-Fragility & Resilience

*Source: `dev/anti-fragility.md`*

## 1. Ghost Mode (Auto-Mocking)

Ghost Mode ensures the frontend remains functional even if the backend is down.

- **Trigger:** `StartupStatus` detects backend failure during dependency checks.
- **Action:** Automatically activates Mock Service Worker (MSW).
- **Handlers:** Located in `src/mocks/handlers.ts`, covering health, auth, agents, and settings.
- **Manual Control:** Toggleable via the Dev HUD or `activateGhostMode()` utility.

## 2. Dev HUD (Heads-Up Display)

A persistent overlay (`DevHUD.tsx`) available in development mode.

- **Env:** Hot-swap between Local, Staging, and Mock environments.
- **Auth:** Masquerade as `admin`, `user`, or `guest` by injecting fake JWTs.
- **Flags:** Toggle feature flags instantly (persisted to `localStorage`).
- **Issues:** Real-time detection of environment issues with "Fix It" buttons.

## 3. Runtime Config Injection

Eliminates build-time environment mismatches.

- **Pattern:** `index.html` contains a `<script>` tag that injects `window.__CONFIG__` at runtime.
- **Usage:** App reads config via `getRuntimeConfig()` instead of `import.meta.env`.
- **Benefit:** The same build artifact can be deployed to any environment by simply changing the injected script.

## 4. Smart Remediation

Provides actionable fixes for common development hurdles:

- **`seed-database`**: Runs `npm run seed:demo` if the DB is empty.
- **`run-migrations`**: Applies pending migrations via `pnpm run db:push`.
- **`refresh-dev-token`**: Obtains a fresh development JWT.
- **`enable-ghost-mode`**: Manually triggers MSW mocking.

## 5. Architecture

The `BootstrapGuard` and `StartupStatus` components orchestrate the anti-fragility flow, ensuring dependencies are checked before the app fully mounts.

---

**Last Updated:** 2026-01-28
**Related:** `src/lib/startup/`, `src/components/dev/DevHUD.tsx`

---

## Dev: Database Governance

*Source: `dev/database-governance.md`*

## 1. Migration Inventory

ValueOS maintains a strict 14-digit timestamp naming convention for migrations in `supabase/migrations/`.

### Key Migrations

- `20240101000000_release_v1.sql`: Baseline schema.
- `20260115000000_tenant_foundations.sql`: Multi-tenancy core.
- `20260115000001_memory_first_architecture.sql`: Memory-centric OS schema.
- `20260116000000_tenant_rls_context.sql`: RLS policy enforcement.

## 2. Governance Rules

- **Naming:** `YYYYMMDDHHMMSS_description.sql`.
- **Dependency Annotations:** Use `-- DEPENDENCIES:` headers when a migration references tables from a prior file.
- **Immutability:** Once a migration is pushed to the remote or shared, it must never be edited. Use a new migration for fixes.
- **Validation:** Run `supabase db diff` to verify changes before committing.

## 3. Alignment & Backlog

- **Port Parity:** Ensure `config/ports.json` and `infra/supabase/config.toml` remain aligned (Supabase DB: 54322).
- **Repair Workflow:** Use `supabase migration repair` if local and remote histories drift.
- **Audit Cadence:** Weekly review of new migrations for naming and dependency compliance.

## 4. Change Execution Workflow

1. Create migration with correct naming.
2. Add dependency headers if applicable.
3. Run `supabase db reset` locally to validate ordering.
4. Push to remote via `supabase db push`.

---

**Last Updated:** 2026-01-28
**Related:** `docs/dev/DEV_MASTER.md`, `infra/supabase/MIGRATION_FIX.md`

---

## Dev: DX Orchestration & Setup

*Source: `dev/dx-orchestration.md`*

## 1. The `dx` Orchestration Flow

The `pnpm run dx` command is the primary entry point for development.

### Step-by-Step Breakdown

1.  **`dx:env`**: Compiles `.env.local` and `.env.ports` from `config/ports.json`.
2.  **Preflight**: Validates Docker, Node version (`.nvmrc`), and pnpm version.
3.  **Docker Deps**: Starts `valueos-postgres` (5432) and `valueos-redis` (6379).
4.  **Supabase Startup**:
    - Attempts `supabase start`.
    - If `DX_SKIP_SUPABASE=1` or startup fails, falls back to the `valueos-postgres` container.
5.  **Migrations**: Applies schema changes via `supabase db push`.
6.  **Types**: Regenerates TypeScript types from the active database.
7.  **Services**: Boots the Backend (3001) and Frontend (5173).

## 2. Reproducible Setup

### Quickstart

```bash
git clone ...
pnpm install
pnpm run dx
```

### Development Modes

- **Local Mode (Default)**: Frontend/Backend run on host; dependencies in Docker.
- **Full Docker Mode**: `pnpm run dx:docker` runs everything inside containers with Caddy routing.

## 3. Recovery & Maintenance

| Command              | Description                                  |
| :------------------- | :------------------------------------------- |
| `pnpm run dx:doctor` | Run diagnostic checks.                       |
| `pnpm run dx:down`   | Stop all services and clear state.           |
| `pnpm run dx:reset`  | Soft reset (remove containers + volumes).    |
| `pnpm run dx:clean`  | Hard reset (containers + env files + cache). |
| `pnpm run dx:logs`   | Tail logs for all services.                  |

## 4. Access Points

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Supabase Studio**: `http://localhost:54323`
- **Grafana (Traces/Logs/Metrics)**: `http://localhost:3000`

---

**Last Updated:** 2026-01-28
**Related:** `docs/dev/DEV_MASTER.md`, `docs/getting-started/quickstart.md`

---
