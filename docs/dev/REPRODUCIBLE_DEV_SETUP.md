# ValueOS Reproducible Development Environment Setup

This guide provides copy/paste commands for a clean machine or a DevContainer. The single source of truth for the default flow is the [Local Dev Quickstart](../getting-started/quickstart.md).

---

## Prerequisites

- **Node.js**: v20.x (use `.nvmrc`)
- **Docker Desktop / Docker Engine**: Compose v2 enabled
- **Git**
- **Corepack** (bundled with Node 20+)

---

## Local Dev Quickstart (Default)

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm run dx:env -- --mode local --force
pnpm run dx
```

**Expected outcome:** `.env.local` and `.env.ports` are generated, Docker dependencies start, Supabase starts via the CLI, and the frontend is served at `http://localhost:5173`.

---

## Development Modes

### Option A (Default): Local mode (host + Docker deps)

```bash
pnpm run dx:env -- --mode local --force
pnpm run dx
```

**Expected outcome:** frontend/backend run on the host, dependencies run in Docker, Supabase is started by DX.

### Option B: Full Docker mode

```bash
pnpm run dx:env -- --mode docker --force
pnpm run dx:docker
```

**Expected outcome:** frontend, backend, and dependencies run in Docker with Caddy routing.

---

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health
- **Supabase API**: http://localhost:54321
- **Supabase Studio**: http://localhost:54323
- **Supabase DB**: localhost:54322

---

## DevContainer Notes

If you are running inside a DevContainer/Codespaces, use the same commands above. The DX orchestrator may skip Supabase startup if Docker-in-Docker port forwarding is unreliable; in that case, the stack uses the `valueos-postgres` container on port `5432` for database access.

---

## Common Issues

See the canonical list of symptoms → causes → fixes in [Common Issues + Fixes](../getting-started/troubleshooting.md).
