# ValueOS Development Master Context

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

---
**Maintainer:** AI Implementation Team
**Related:** `docs/context/MASTER_CONTEXT.md`, `docs/getting-started/quickstart.md`
