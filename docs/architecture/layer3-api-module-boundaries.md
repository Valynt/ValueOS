# Layer 3 API module boundaries (ValueOS)

## Scope audited

The requested directories do not exist in this repository:

- `services/layer3-knowledge/src/api/routes/`
- `value_fabric/layer3/api/routes/`

Equivalent Layer 3 service route modules are currently under:

- `packages/backend/src/routes/`

## Route module inventory and classification

| Module | Classification | Why |
|---|---|---|
| `packages/backend/src/routes/value-graph.ts` | (2) Wrapper with local behavior | Defines tenant/auth middleware, request validation (`validateCaseAccess`), response envelope conventions, and endpoint logic bound to backend runtime dependencies. |
| `packages/backend/src/routes/realization.ts` | (2) Wrapper with local behavior | Owns auth + tenant middleware chaining and response shaping for realization endpoints. |
| `packages/backend/src/routes/deal-assembly.ts` | (2) Wrapper with local behavior | Owns auth + tenant middleware chaining, request-body extraction, and response shaping for deal assembly endpoints. |
| `packages/backend/src/routes/sdui.ts` | (2) Wrapper with local behavior | Includes version negotiation, schema migration/downgrade logic, and runtime integrations specific to backend service wiring. |
| `packages/backend/src/routes/dev.ts` | (2) Wrapper with local behavior | Development-only security gating, host allowlist checks, and protected operational endpoints. |
| `packages/backend/src/routes/devRoutes.ts` | (2) Wrapper with local behavior | Runtime feature-flag evaluation and conditional route registration. |

No class (1) pure re-export/import-only wrappers were found, so there are no redundant wrappers to remove in the current layout.

## Ownership model

- **Route logic owner:** `packages/backend/src/routes/*` currently owns Layer 3 HTTP route composition and service-specific middleware behavior.
- **Shared/domain logic owner:** service/domain behavior should remain in reusable backend services (for example, `packages/backend/src/services/**`) and shared schemas/types.

## What may remain service-local

Service-local route modules are allowed when they contain one or more of:

1. Service runtime wiring (Express middleware chain, feature flags, environment guards).
2. API compatibility concerns (path preservation, response envelope shaping, request adaptation).
3. Operational/security controls (authn/authz policy attachment, tenant checks, host allowlists, dev gating, telemetry hooks).

## How future routes should be added

1. **Put shared business logic in services first** (`packages/backend/src/services/**`), keeping handlers thin.
2. **Implement route composition in `packages/backend/src/routes/`** with explicit auth + tenant middleware.
3. **Avoid pure wrappers:** if a file only re-exports another router, register the source router directly where routes are mounted.
4. **When a wrapper is needed, document why** (security, compatibility, or operational coupling) in a short file header note.
5. **Keep mount points stable** in `packages/backend/src/server/register-routes.ts` to preserve route prefixes and dependency injection behavior.
