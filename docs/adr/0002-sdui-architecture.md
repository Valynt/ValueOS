# ADR 0002: SDUI Architecture and Component Registry Patterns

- **Status**: Accepted
- **Date**: 2025-11-17
- **Scope**: Server-Driven UI renderer, component registry, and schema versioning for canvas experiences.

## Context
The platform serves dynamic canvases and workflows that must evolve without frequent frontend redeploys. We need a consistent schema for SDUI payloads, a governed component registry, and backwards-compatible rendering paths.

## Decision
- Maintain a **versioned component registry** where each component definition includes schema version, props contract, and validation rules; publish the registry alongside SDUI manifests.
- Use **JSON schema validation** in the renderer to reject malformed payloads and surface actionable errors for missing props or deprecated variants.
- Implement **graceful degradation**: unknown components render as placeholders with telemetry, and optional props default to documented fallbacks.
- Keep **rendering deterministic** by avoiding runtime `eval` and by whitelisting allowed interactions; prefer declarative actions (navigation, mutations) over arbitrary code.
- Cache SDUI manifests at the edge with **short TTLs and ETags** to balance freshness with performance, and pair each manifest with migration notes for rolling upgrades.

## Alternatives Considered
- **Static UI bundles per experience**: Rejected because it would reintroduce deployment friction and slow experimentation.
- **Unversioned component JSON**: Rejected due to high risk of breaking changes and limited traceability during incidents.

## Consequences
- Component authors must increment schema versions when breaking props change, and the renderer must support at least N-1 compatibility.
- Edge caching requires cache-busting during registry rollouts; the runbook includes cache invalidation steps in rollbacks.
- The manifest validation path becomes a critical dependency and must be covered by automated tests and logging.
