# Module Ownership and Dependency Boundaries

**Last Updated**: 2026-03-19

## Domain Ownership Map

| Domain | Owned paths | Purpose | Public dependency surface |
|---|---|---|---|
| Browser application runtime | `apps/ValyntApp/src/**` | Browser-only React/Vite UI, client-side state, and anon/user-scoped Supabase access. | Browser-safe package exports plus local browser modules only. |
| Server/security runtime | `packages/backend/src/config/secrets/**`, `packages/backend/src/config/settings.ts`, `packages/backend/src/lib/supabase.ts` | Secret providers, privileged Supabase adapters, server config, and worker/runtime security ownership. | Backend internal modules only. Never imported from browser code. |
| Backend service layer | `packages/backend/src/**` | API/service orchestration, persistence coordination, workers, and backend domain execution. | Backend internal modules plus package public entrypoints. |

## Allowed Dependency Directions

1. `apps/ValyntApp/src/**` is browser-only.
   - Forbidden: Node built-ins such as `fs`, `crypto`, `events`, and `path`.
   - Forbidden: secret managers (`node-vault`, `@aws-sdk/client-secrets-manager`) and privileged backend adapters (`@valueos/backend/*`, `@backend/*`).
   - Forbidden: reads of non-`VITE_` environment variables in shipped browser entrypoints.
2. `packages/backend/src/**` owns server-only infrastructure.
   - Secret hydration, secret providers, and privileged Supabase clients must stay in backend-owned modules.
   - Backend must not import from `apps/ValyntApp/*`.
3. [`runtime-inventory.json`](../../runtime-inventory.json) is the authoritative runtime inventory.
   - CI and docs must align to it when browser/server ownership changes.

## Stub and Duplicate Entry Point Policy

- Backend adapter entrypoints that represent agent runtime behavior must consume `@valueos/agents` contracts directly.
- `packages/backend/src/lib/agent-fabric.ts` now validates and shapes execution through `@valueos/agents/orchestration` schemas instead of carrying an isolated stub contract.

## Enforcement

The following controls enforce this document:

- ESLint boundary restrictions in `eslint.config.js` and `apps/ValyntApp/eslint.config.js` for browser/server ownership.
- CI guard scripts: `scripts/ci/check-module-boundaries.mjs` and `scripts/ci/check-browser-runtime-boundaries.mjs`.
- CI workflow integration: `.github/workflows/ci.yml` steps for browser provider secrets and browser runtime boundaries.
