---
title: Module Ownership and Dependency Boundaries
owner: team-platform
system: valueos-platform
---

# Module Ownership and Dependency Boundaries

**Last Updated**: 2026-02-13

## Domain Ownership Map

| Domain | Owned paths | Purpose | Public dependency surface |
|---|---|---|---|
| App composition layer | `apps/ValyntApp/src/lib/*` | Client and app-local composition primitives, adapters, and UI-near runtime glue. | Workspace package entrypoints only (e.g., `@valueos/agents/<public-subpath>`). |
| Agent runtime | `packages/agents/*` | Canonical multi-agent orchestration and runtime contracts (core loop, scoring, tools, evals). | Package exports declared by `@valueos/agents`. |
| Backend service layer | `packages/backend/src/*` | API/service orchestration, persistence coordination, and backend domain execution. | Backend internal modules plus package public entrypoints. |

## Allowed Dependency Directions

1. `apps/ValyntApp/src/lib/*` → package **public** APIs only.
   - Forbidden: app imports into any package `src/*` internals.
   - Forbidden: app relative imports that cross into `packages/*`.
2. `packages/backend/src/*` → package **public** APIs (including `@valueos/agents/*` public exports).
   - Forbidden: backend imports from `apps/ValyntApp/*`.
   - Forbidden: backend-local stubs for package-owned agent runtime behavior.
3. `packages/agents/*` is the canonical owner for reusable agent runtime contracts.
   - Consumers must avoid deep imports into non-exported internals.

## Stub and Duplicate Entry Point Policy

- Backend adapter entrypoints that represent agent runtime behavior must consume `@valueos/agents` contracts directly.
- `packages/backend/src/lib/agent-fabric.ts` now validates and shapes execution through `@valueos/agents/orchestration` schemas instead of carrying an isolated stub contract.

## Enforcement

The following controls enforce this document:

- ESLint boundary restrictions in `eslint.config.js` for app and backend import zones.
- CI guard script: `scripts/ci/check-module-boundaries.mjs`.
- CI workflow integration: `.github/workflows/ci.yml` step `Check module boundaries`.
