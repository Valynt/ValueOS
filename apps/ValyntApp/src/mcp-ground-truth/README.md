## ValyntApp MCP Ground Truth Compatibility Layer

This directory now provides an app-local compatibility surface only.

- **Canonical ownership:** `packages/mcp/ground-truth/`
- **App responsibility:** keep stable import paths for ValyntApp and perform app-safe default wiring
- **No duplicated MCP server runtime logic** remains in `apps/ValyntApp/src/mcp-ground-truth/`

### Call-site inventory (April 5, 2026)

#### App-local import path (`apps/ValyntApp/src/mcp-ground-truth`)

- `apps/ValyntApp/src/features/canvas/services/GroundTruthService.ts`
  - imports `createMCPServer` from `../../../mcp-ground-truth`

#### Package-level implementation (`packages/mcp/ground-truth`)

- consumed through the compatibility layer in `apps/ValyntApp/src/mcp-ground-truth/index.ts`
- runtime creator APIs delegated:
  - `createMCPServer`
  - `createDevServer`

### Migration boundary

1. Keep application imports pointed at `apps/ValyntApp/src/mcp-ground-truth`.
2. Keep all MCP server implementation changes in `packages/mcp/ground-truth`.
3. Add app-layer tests only for adapter behavior and compatibility defaults.
