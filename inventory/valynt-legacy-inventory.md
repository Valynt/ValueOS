# ValyntApp Legacy-Restored Inventory

Generated: 2026-01-17

Summary

- Total restored files under `apps/ValyntApp/src/legacy-restored`: 457 (confirmed via repo search)
- Top-level directory counts (legacy-restored):
  - `services`: 341 files
  - `components`: 20 files
  - `types`: 43 files
  - `pages`: 14 files
  - `integrations`: 9 files
  - `test`: 11 files
  - Other notable files: `main.tsx`, `vite-env.d.ts`, `App.tsx` (if present)

Per-directory sample files

## services (sample)

- services/SessionManager.ts
- services/ProblemMonitor.ts
- services/ValueFabricService.ts
- services/ValueKernel.ts
- services/WorkflowStateService.ts
- services/WorkflowLifecycleIntegration.ts
- services/MessageBus.ts
- services/EmailService.ts
- services/Payment/StripeService.ts (billing subfolder exists)

## components (sample)

- components/AppShell.tsx
- components/ArtifactPreview.tsx
- components/TracePanel.tsx
- components/Deals/DealSelector.tsx
- components/Deals/DealSummaryDrawer.tsx

## types (sample)

- types/index.ts
- types/vos.ts
- types/value-commitment-tracking.ts
- types/agents.ts
- types/workflow.ts

## pages (sample)

- pages/Home.tsx
- pages/Deals.tsx
- pages/DealWorkspace.tsx
- pages/Benchmarks.tsx

## integrations (sample)

- integrations/index.ts
- integrations/hubspot/HubSpotAdapter.ts
- integrations/salesforce/SalesforceAdapter.ts
- integrations/slack/SlackAdapter.ts

## tests (sample)

- test/vitest-global-setup.ts
- test/setup-integration.ts
- many service-level unit/integration tests under `services/__tests__`

Recommended owners (suggested)

- `types` → `platform/core-team` (high impact on compilation)
- `services` → `backend-infra-team` (service logic, auth, integrations)
- `components` → `frontend-ui-team` (UI primitives and layout)
- `pages` → `frontend-app-team` (routes, auth pages)
- `integrations` → `integrations-team` (external adapters)
- `test` → `qa/engineering` (stabilize tests)

Next actions

1. Merge `types` first in small batches; run `npm run typecheck` after each batch.
2. Merge `services` with safe stubs for external calls; run unit tests.
3. Merge core `components` and validate `npm run dev` smoke render.

Notes

- Many `services` include tests; run them in isolation while merging to validate behavior.
- Use the semantic index (ChunkHound) to find all usages of critical symbols (`SessionManager`, `EnterpriseAdapter`, `ValueFabricService`) before merging.

Inventory generation method

- Used repository file search queries on `apps/ValyntApp/src/legacy-restored/*` and aggregated counts.

If you want, I can now:

- (A) produce a CSV with full file list, or
- (B) run semantic queries (requires Ollama + ChunkHound), or
- (C) start creating small PR branches to merge `types` in batches.
