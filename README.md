# ValueOS Engineering

> **"Stabilize the repo. Stop the world if necessary, but never ship broken windows."**

This repository operates under a **Strict Quality Governance** model. We prioritize runtime determinism and type-safety over feature velocity.

## 🚦 Quick Start (The Happy Path)

We do not guess if the app works. We verify it.

```bash
# 1. Install dependencies
pnpm install

# 2. Setup Environment
cp .env.example .env

# 3. Boot (Verifies Environment -> Syncs DB -> Starts App)
pnpm dev


If pnpm dev fails, do not bypass it. Fix your local environment.

🛡️ The Protocols

Protocol A: Environment Determinism

We run scripts/dev-verify.ts before every boot.

Node/PNPM Version: Enforced.

Docker Services: Must be reachable (Postgres: 5432, LocalStack: 4566).

.env Parity: You cannot run with missing keys.

Protocol B: The Green Islands

We use the Strangler Fig Pattern for type safety.

Legacy Code: Lives in the "Sea of Debt".

Strict Zones: Defined in config/strict-zones.json.

These folders operate under tsconfig.strict.json.

Zero TypeScript errors allowed here.

If you touch a Green Island, you must keep it Green.

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
