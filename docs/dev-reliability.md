# ValueOS Dev Reliability Spec

## Supported platforms
- **macOS**: Apple Silicon / Intel (Docker Desktop)
- **Windows**: Windows 11 with WSL2 + Docker Desktop
- **Linux**: Ubuntu 22.04+ (Docker Engine + Compose v2)

## Required versions (pinned)
- **Node.js**: 20.19.0 (from `.nvmrc`)
- **pnpm**: 9.15.0 (via Corepack)
- **Docker**: 24.x+ with Compose v2

## Deterministic commands

```bash
# Bootstrap (full stack)
pnpm run dx

# Preflight checks
pnpm run dx:doctor

# Tail logs
pnpm run dx:logs

# Reset containers + volumes
pnpm run dx:reset
```

These commands are designed to be one-shot, non-interactive, and safe on fresh clones.

---

# Implementation Plan (Prioritized)

## Day 0 quick wins
- [x] **Pin pnpm + lockfile enforcement**
  - **Files**: `.npmrc`, `package.json`, `scripts/dx/ensure-pnpm.js`
  - **Change**: enforce pnpm-only installs; lockfile enforced locally.
  - **Acceptance**: `pnpm install --frozen-lockfile` works; `npm install` fails with actionable error.

- [x] **Docker mode build + HMR stability**
  - **Files**: `ops/compose/dev.yml`, `apps/ValyntApp/vite.config.ts`, `.env.example`, `scripts/dx/env-compiler.js`
  - **Change**: expose Vite HMR port; set clientPort; provide polling toggle; align envs.
  - **Acceptance**: HMR connects in Docker with a stable port.

- [x] **Doctor improvements + logs**
  - **Files**: `scripts/dx/doctor.js`
  - **Change**: show versions + failing container logs + next steps.
  - **Acceptance**: `pnpm run dx:doctor` outputs versions, ports, and actionable fixes.

## Day 1–2 hardening
- [ ] **Port auto-reassignment**
  - **Files**: `scripts/dx/ports.js`, `scripts/dx/env-compiler.js`, `scripts/dev-cli.js`
  - **Change**: detect conflicts and auto-resolve into `.env.ports` (or fail fast with the new suggestion).
  - **Acceptance**: running `pnpm run dx` on occupied ports reassigns or prints a one-line fix.

- [ ] **One-command bootstrap smoke test**
  - **Files**: `scripts/dev/smoke-test.sh`, `.github/workflows/ci-bootstrap.yml`
  - **Change**: run `pnpm run dx` + health checks + build in CI.
  - **Acceptance**: CI fails fast on unhealthy services and lockfile drift.

- [ ] **Env validation at boot**
  - **Files**: `scripts/dx/validate-env.js`, `scripts/dev-cli.js`
  - **Change**: validate required env keys before boot.
  - **Acceptance**: missing keys fail early with a targeted fix command.

---

## Troubleshooting

For the canonical list of symptoms → causes → fixes, see [Common Issues + Fixes](getting-started/troubleshooting.md).
