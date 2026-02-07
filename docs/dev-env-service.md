# Dev Environment Service

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
- `compose.devcontainer.override.yml`
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
- `docker compose ps` shows services healthy/running.
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
- or `COMPOSE_PROFILES=devcontainer docker compose -f compose.yml -f compose.devcontainer.override.yml up -d`

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
