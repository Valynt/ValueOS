# EXPERIMENTAL — packages/mcp/

**Status:** Marked for demotion to `packages/experimental/` as of Sprint 0 of the ValueOS architectural refactor.

## What this means

The broad MCP (Model Context Protocol) platform — including the generic ground-truth module, CRM integration layer, and common MCP utilities — is a platform abstraction that does not directly deliver user value in the core value loop. It is being demoted to experimental status.

## Active imports (must be resolved before deletion)

The following imports from `packages/mcp` are currently active in `packages/backend`:

- `@mcp/ground-truth/modules/StructuralTruthModule` — used in `UnifiedAgentOrchestrator` (frozen)
- `@mcp/ground-truth/validators/GroundTruthValidator` — used in `UnifiedAgentOrchestrator` (frozen)

These will be absorbed into the `PolicyEngine` runtime service in Sprint 4 when the orchestrator is decomposed.

## Rules while in experimental status

- No new MCP subsystems may be added.
- No new imports of MCP internals from `packages/backend` or `apps/ValyntApp`.
- All new ground-truth validation goes through `packages/backend/src/runtime/policy-engine/`.

## Sub-packages

| Package | Status | Action |
|---|---|---|
| `packages/mcp/ground-truth` | Experimental | Absorb validators into `PolicyEngine` in Sprint 4; delete package. |
| `packages/mcp/crm` | Experimental | Evaluate whether CRM integration belongs in `packages/integrations/`; migrate or delete in Sprint 6. |
| `packages/mcp/common` | Experimental | Delete after ground-truth and CRM are migrated. |

## Demotion target

Sprint 4 (after `PolicyEngine` absorbs the ground-truth validators). Full deletion in Sprint 6–10.

**Reference:** ValueOS Refactor Roadmap, Sprint 0, Task 0.6; Sprint 4, Task 4.2.
