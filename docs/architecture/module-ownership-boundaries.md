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


## Canonical Naming Map (Package Metadata Governance)

Canonical naming policy for workspace package metadata:

| Surface | Canonical ValueOS form | Legacy form to avoid | Notes |
|---|---|---|---|
| npm scope | `@valueos/*` | `@valuecanvas/*` | All workspace package `name` fields must use the `@valueos` scope unless explicitly allowlisted. |
| package author | `ValueOS` | `ValueCanvas` | Package `author` should use ValueOS branding for active services/libraries. |
| service metadata | ValueOS identifiers | `valuecanvas` variants | Service metadata keys (for example `service`, `serviceName`, `serviceMetadata`) must not introduce new legacy identifiers. |

### Package metadata audit snapshot (2026-04-05)

- Audited every repository `package.json` for legacy `valuecanvas` tokens across `name`, `author`, and service metadata fields.
- Total files scanned: **25**.
- Legacy findings: **1 package** (`packages/services/domain-validator/package.json`) with legacy `name` + `author`.
- Action taken: renamed metadata to ValueOS-aligned identifiers (`@valueos/domain-validator`, `ValueOS`).

### Publishable package migration path

`packages/services/domain-validator` is marked release-eligible in workspace policy, so this rename must be treated as a package-identity migration.

1. **Current canonical package name:** `@valueos/domain-validator`.
2. **Legacy package (`@valuecanvas/domain-validator`) strategy:** publish a final deprecation release on the legacy name that depends on or re-exports the canonical package, with an npm deprecation message directing consumers to `@valueos/domain-validator`.
3. **Consumer migration:**
   - Update dependency declarations to `@valueos/domain-validator`.
   - Regenerate lockfiles.
   - Verify CI for any references to `@valuecanvas/domain-validator` in deployment manifests or scripts.
4. **Sunset window recommendation:** keep deprecation notice active for at least one full release cycle before archive/removal.

### CI enforcement

- Guard script: `scripts/ci/check-package-metadata-naming.mjs`.
- Allowlist (exception ledger): `scripts/ci/package-metadata-legacy-allowlist.json`.
- Shared governance runner executes this check in both PR and main verification lanes.
