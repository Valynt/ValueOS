# ValueOS Dev Reliability Spec

## Supported platforms
- **macOS**: Apple Silicon / Intel (Docker Desktop)
- **Windows**: Windows 11 with WSL2 + Docker Desktop
- **Linux**: Ubuntu 22.04+ (Docker Engine + Compose v2)

## Required versions (pinned)
- **Node.js**: 20.19.0 (from `.nvmrc`)
- **pnpm**: 9.15.0 (via corepack)
- **Docker**: 24.x+ with Compose v2

## Deterministic commands
- **Bootstrap**: `./dev up` (or `pnpm run dx`)
- **Doctor**: `./dev doctor`
- **Logs**: `./dev logs <service>`
- **Reset**: `./dev reset`

These commands are designed to be one-shot, non-interactive, and safe on fresh clones.

---

# Implementation Plan (Prioritized)

## Day 0 quick wins
- [x] **Pin pnpm + lockfile enforcement**
  - **Files**: `.npmrc`, `package.json`, `scripts/dx/ensure-pnpm.js`
  - **Change**: enforce pnpm-only installs; lockfile enforced locally.
  - **Acceptance**: `pnpm install` works; `npm install` fails with actionable error.

- [x] **Docker mode build + HMR stability**
  - **Files**: `infra/docker/docker-compose.dev.yml`, `apps/ValyntApp/vite.config.ts`, `.env.example`, `scripts/dx/env-compiler.js`
  - **Change**: expose Vite HMR port; set clientPort; provide polling toggle; align envs.
  - **Acceptance**: HMR connects in Docker with a stable port.

- [x] **Doctor improvements + logs**
  - **Files**: `scripts/dx/doctor.js`
  - **Change**: show versions + failing container logs + next steps.
  - **Acceptance**: `./dev doctor` outputs versions, ports, and actionable fixes.

## Day 1–2 hardening
- [ ] **Port auto-reassignment**
  - **Files**: `scripts/dx/ports.js`, `scripts/dx/env-compiler.js`, `scripts/dev-cli.js`
  - **Change**: detect conflicts and auto-resolve into `.env.ports` (or fail fast with the new suggestion).
  - **Acceptance**: running `./dev up` on occupied ports reassigns or prints a one-line fix.

- [ ] **One-command bootstrap smoke test**
  - **Files**: `scripts/dev/smoke-test.sh`, `.github/workflows/ci-bootstrap.yml`
  - **Change**: run `./dev up` + health checks + build in CI.
  - **Acceptance**: CI fails fast on unhealthy services and lockfile drift.

- [ ] **Env validation at boot**
  - **Files**: `scripts/dx/validate-env.js`, `scripts/dev-cli.js`
  - **Change**: validate required env keys before boot.
  - **Acceptance**: missing keys fail early with a targeted fix command.

---

# Failure Playbook (Top 10)

1. **Port conflict detected**
   - **Symptom**: `Port 5173 is in use`
  - **Fix**: `export VITE_PORT=5174 && pnpm run dx:env -- --mode local --force`

2. **Docker daemon not running**
   - **Symptom**: `Cannot connect to Docker daemon`
   - **Fix**: Start Docker Desktop or `sudo systemctl start docker`

3. **Node version mismatch**
   - **Symptom**: `Node 20.19.0 required`
   - **Fix**: `nvm install && nvm use`

4. **pnpm missing / wrong version**
   - **Symptom**: `pnpm 9.15.0 expected`
   - **Fix**: `corepack enable && corepack prepare pnpm@9.15.0 --activate`

5. **Vite HMR not connecting in Docker**
   - **Symptom**: HMR websocket disconnects
   - **Fix**: ensure `VITE_HMR_PORT` is published and `VITE_HMR_CLIENT_PORT` matches

6. **Supabase not running**
   - **Symptom**: API URL not reachable
   - **Fix**: `supabase start` (or `DX_SUPABASE_LOCAL=0` to skip)

7. **Postgres not ready**
   - **Symptom**: backend fails to connect
   - **Fix**: `./dev logs postgres` and wait for healthcheck

8. **Redis connection error**
   - **Symptom**: backend logs `ECONNREFUSED redis`
   - **Fix**: `./dev reset` then `./dev up`

9. **Lockfile drift**
   - **Symptom**: CI fails `pnpm-lock.yaml` diff
   - **Fix**: `pnpm install --frozen-lockfile` and commit changes

10. **Corrupted pnpm store**
   - **Symptom**: install fails with checksum errors
   - **Fix**: `rm -rf .pnpm-store && pnpm install --prefer-offline`
