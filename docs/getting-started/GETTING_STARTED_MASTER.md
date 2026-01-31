# ValueOS Getting Started: Master Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-28
**Status:** DEPRECATED - See DEVELOPER_GUIDE.md

⚠️ **DEPRECATED**: This guide has been superseded by [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

The recommended setup is now the unified dev container environment, which provides a batteries-included development stack with all dependencies pre-configured.

### Quick Migration

1. Install VS Code with Dev Containers extension
2. Open the repository in VS Code
3. Use Command Palette: `Dev Containers: Reopen in Container`
4. The environment automatically sets up everything

For complete documentation, see [docs/getting-started/DEVELOPER_GUIDE.md](docs/getting-started/DEVELOPER_GUIDE.md).

---

## Legacy Content (For Reference Only)

## 1. Quickstart (Under 10 Minutes)

Get up and running with ValueOS from a clean machine.

### Prerequisites

- **Node.js**: 20+ (use `.nvmrc`)
- **Docker Desktop**: Installed and running
- **Corepack**: Enabled for pnpm management

### The "Golden Path" Setup

```bash
# 1. Clone and enter repo
git clone <repo-url> valueos && cd valueos

# 2. Install dependencies
pnpm install

# 3. Generate environment files
pnpm run dx:env

# 4. Start the full stack
pnpm run dx

# 5. Seed demo user (Optional)
pnpm run seed:demo
```

**Access Points:**

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Supabase Studio**: `http://localhost:54323`

---

## 2. Development Modes

ValueOS supports two primary development workflows:

### Option A: Local Mode (Default)

- **Command**: `pnpm run dx`
- **Behavior**: Frontend/Backend run on host; dependencies (Postgres, Redis, Supabase) run in Docker.
- **Best For**: Fast HMR and standard development.

### Option B: Full Docker Mode

- **Command**: `pnpm run dx:docker`
- **Behavior**: Everything runs inside Docker containers with Caddy routing.
- **Best For**: Environment parity and testing containerization.

---

## 3. Troubleshooting Common Issues

| Symptom                        | Cause                   | Fix                                    |
| :----------------------------- | :---------------------- | :------------------------------------- |
| `Cannot connect to Docker`     | Docker not running      | Start Docker Desktop                   |
| `EADDRINUSE: :::5173`          | Port conflict           | `pkill -f vite` or check `ports.json`  |
| `ENVIRONMENT CONTRADICTION`    | Wrong `.env.local` mode | `pnpm run dx:env`                      |
| `ECONNREFUSED 127.0.0.1:54322` | DB container down       | `pkill -f supabase` then `pnpm run dx` |
| Login fails for demo user      | Seed script not run     | `pnpm run seed:demo`                   |

---

## 4. Day-to-Day Commands

- **Start/Stop**: `pnpm run dx` / `pnpm run dx:down`
- **Reset**: `pnpm run dx:reset` (Soft) or `pnpm run dx:clean` (Hard)
- **Database**: `pnpm run db:push` (Migrations) | `pnpm run db:types` (Type Gen)
- **Diagnostics**: `pnpm run dx:doctor`

---

**Maintainer:** AI Implementation Team
**Related:** `docs/dev/DEV_MASTER.md`, `docs/context/MASTER_CONTEXT.md`
