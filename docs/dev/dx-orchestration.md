# Dev: DX Orchestration & Setup

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
| Command | Description |
| :--- | :--- |
| `pnpm run dx:doctor` | Run diagnostic checks. |
| `pnpm run dx:down` | Stop all services and clear state. |
| `pnpm run dx:reset` | Soft reset (remove containers + volumes). |
| `pnpm run dx:clean` | Hard reset (containers + env files + cache). |
| `pnpm run dx:logs` | Tail logs for all services. |

## 4. Access Points
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Supabase Studio**: `http://localhost:54323`
- **Jaeger UI**: `http://localhost:16686`

---
**Last Updated:** 2026-01-28
**Related:** `docs/dev/DEV_MASTER.md`, `docs/getting-started/quickstart.md`
