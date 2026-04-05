# Domain packs import inventory (backend)

Generated on **2026-04-05** from `packages/backend/src` (post-canonicalization pass).

## Canonical namespace decision

- **Canonical filesystem/module namespace:** `domain-packs` (kebab-case).
- **Canonical API router entry point:** `packages/backend/src/api/domain-packs/index.ts`.
- **Canonical route mount:** `/api/v1/domain-packs`.

Rationale:

1. Kebab-case aligns with existing route slug conventions and avoids case-sensitive/case-insensitive filesystem drift.
2. A single production router prevents split ownership between `src/api/domainPacks.ts` and `src/api/domainPacks/index.ts`.
3. Legacy camelCase module roots (`domainPacks`) remain temporarily as shims and migration targets.

## Import inventory and classification

### Canonical imports (kebab-case)

These imports already use canonical kebab-case module roots:

- `src/api/domain-packs/*` and route mount wiring in `src/server.ts`.
- `src/services/domain-packs/*` imports/exports (GroundTruth, MCP, parser, DomainPackService).
- Updated type imports to `src/api/domain-packs/types.ts` from `src/services/domainPacks/*` and `src/agents/context/loadDomainContext.ts`.

### Legacy imports (camelCase)

These are legacy compatibility surfaces and staged migration targets:

1. **Legacy API shim root**
   - `packages/backend/src/api/domainPacks.ts`
   - `packages/backend/src/api/domainPacks/index.ts`
   - `packages/backend/src/api/domainPacks/types.ts`
   - `packages/backend/src/api/domainPacks/repository.ts`

   Status: retained intentionally as temporary re-export shims with deprecation comments.

2. **Legacy service module root (shim-only)**
   - `packages/backend/src/services/domainPacks/*`

   Status: retained only as compatibility shims; runtime imports now use `src/services/domain-packs/*`.

## Guardrail

CI guardrails now enforce both structure and import usage:

- `scripts/ci/check-mixed-case-module-roots.mjs`
  - Detects mixed-case duplicate module roots under `packages/backend/src`.
- `scripts/ci/check-domain-pack-import-paths.mjs`
  - Blocks non-shim runtime imports of `domainPacks` and requires canonical `domain-packs` imports.

Temporary allowlist roots remain:
- `packages/backend/src/api::domain-packs|domainPacks`
- `packages/backend/src/services::domain-packs|domainPacks`
