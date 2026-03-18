# Proposal: Frontend V1 Surfaces

## Intent

Build the user-facing surfaces for the V1 value engineering workflow. Each surface renders agent-generated data through SDUI widgets and purpose-built components, enabling the "Review and Steer" experience described in the V1 Product Design Brief.

## Scope

In scope:
- Deal Assembly Workspace (context review, gap filling, source provenance)
- Value Model Workbench (hypothesis review, assumption register, scenario comparison, sensitivity)
- Integrity Dashboard (readiness score, evidence gaps, plausibility flags)
- Executive Output Studio (multi-artifact preview, inline editing, traceability drill-down)
- Realization Tracker (promise baseline, KPI targets, checkpoint timeline)
- Billing Portal (usage dashboard, plan management, invoice history, approval queue)
- Shared primitives: provenance panel, confidence badges, source badges
- SDUI widget registry expansion
- SDUIStateProvider implementation (currently a stub)
- React Query hooks for all new API endpoints

Out of scope:
- PPTX/PDF export
- Mobile-responsive layouts (V2)
- Custom theme support (V2)
- Real-time collaboration / multiplayer editing (V2)

## Approach

Extend the existing `AppRoutes.tsx`, `CanvasHost`, and widget registry. Each surface is a new route under `/org/:tenantSlug/`. Surfaces consume backend APIs via React Query hooks and render SDUI payloads through new registered widgets. Shared primitives (provenance panel, badges) are built once in `packages/components/` and imported by all surfaces.
