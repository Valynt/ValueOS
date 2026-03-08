# EXPERIMENTAL — packages/sdui/

**Status:** Marked for demotion to `packages/experimental/` as of Sprint 0 of the ValueOS architectural refactor.

## What this means

The generic SDUI engine (server-driven UI rendering, atomic UI actions, component mutation, UI refinement loops, playground adapters) is a platform abstraction that does not directly deliver user value in the core value loop. It is being demoted to experimental status.

## What stays

The `SDUIPageDefinition` schema type and the `renderPage` function are actively used by the `UnifiedAgentOrchestrator` (frozen) and will be absorbed into the `ArtifactComposer` runtime service in Sprint 4. These specific exports are retained until that migration is complete.

**Retained exports (until Sprint 4):**
- `packages/sdui/src/schema.ts` — `SDUIPageDefinition`, `SDUIComponentSection`
- `packages/sdui/src/renderPage.ts` — `renderPage`, `RenderPageOptions`

## What is demoted

All other SDUI subsystems are non-core platform abstractions:
- `AtomicUIActions` — absorbed into `ArtifactComposer`
- `ComponentToolRegistry` — absorbed into `ArtifactComposer`
- `UIRefinementLoop` — deleted (service migration Sprint 6–10)
- `ComponentMutationService` — deleted (service migration Sprint 6–10)
- `SDUISandboxService` — deleted (service migration Sprint 6–10)
- `PlaygroundWorkflowAdapter` — deleted (service migration Sprint 6–10)
- `LayoutEngine` — absorbed into `ArtifactComposer`

## Rules while in experimental status

- No new SDUI subsystems may be added.
- No new imports of SDUI internals from `packages/backend` or `apps/ValyntApp` (except the retained exports above).
- All new artifact generation goes through `packages/backend/src/runtime/artifact-composer/`.

## Demotion target

Sprint 4 (after `ArtifactComposer` absorbs the retained exports). Full deletion of non-core subsystems in Sprint 6–10 service migration.

**Reference:** ValueOS Refactor Roadmap, Sprint 0, Task 0.6; Sprint 4, Task 4.4.
