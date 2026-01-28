# Dev: System Invariants & Contracts

## 1. Demo User Contract

- **Email:** `admin@valueos.com`
- **Password:** `ValueOS2026!`
- **Role:** `admin`
- **Invariants:** Credentials and UUID must remain fixed for automated testing and seeding.
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
