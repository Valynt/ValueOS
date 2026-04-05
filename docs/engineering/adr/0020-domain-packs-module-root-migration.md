# ADR-0020: Domain Packs Module-Root Canonicalization

## Status
Accepted

## Date
2026-04-05

## Scope
Backend import paths, migration shims, and CI guardrails for domain-pack modules.

## Supersedes
None

## Context
The backend had parallel module roots for the same domain (`domainPacks` and `domain-packs`).
That drift created import inconsistency and allowed runtime code to keep depending on camelCase
paths that were intended to be temporary compatibility surfaces.

## Decision
1. Canonical runtime module root is `domain-packs`.
2. Runtime imports have been moved to canonical modules.
3. `domainPacks` remains shim-only where externally required.
4. Every shim header includes explicit removal metadata:
   - Removal date: **2026-08-31**
   - Tracking ticket: **ENG-4821**
5. CI blocks new non-shim imports of `domainPacks` by scanning backend source imports.

### Migration map

| Legacy path root | Canonical path root | Status |
| --- | --- | --- |
| `src/services/domainPacks/merge.ts` | `src/services/domain-packs/merge.ts` | Canonicalized; legacy file is shim |
| `src/services/domainPacks/snapshot.ts` | `src/services/domain-packs/snapshot.ts` | Canonicalized; legacy file is shim |
| `src/services/domainPacks/validate.ts` | `src/services/domain-packs/validate.ts` | Canonicalized; legacy file is shim |
| `src/services/domainPacks/versioning.ts` | `src/services/domain-packs/versioning.ts` | Canonicalized; legacy file is shim |
| `src/api/domainPacks*.ts` | `src/api/domain-packs/*.ts` | API compatibility shim retained |

## Alternatives considered
1. Immediate deletion of `domainPacks` roots.
   - Rejected: breaks external/importing surfaces still in migration.
2. No CI enforcement.
   - Rejected: regressions would reintroduce mixed import roots.

## Consequences
- Runtime code converges on one module-root convention.
- Temporary shims remain auditable with explicit retirement metadata.
- CI now prevents new camelCase domain-pack import debt from being introduced.
