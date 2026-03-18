# Design: Frontend V1 Surfaces

## Technical Approach

Each V1 surface is a lazy-loaded page component under `apps/ValyntApp/src/views/`. Pages consume React Query hooks for server state and render data through a mix of SDUI widgets (via `CanvasHost`) and purpose-built components. Shared UI primitives live in `packages/components/`.

## Architecture Decisions

### Decision: Extend CanvasHost widget registry

The existing `CanvasHost` + `widgetRegistry` pattern supports dynamic server-driven layouts. New widgets are registered in `CanvasHost.tsx` and lazy-loaded. Each surface defines a default widget layout that the backend can override.

### Decision: Implement SDUIStateProvider

The current `SDUIStateProvider` is a stub. Implement it as a Zustand store (consistent with existing state management) that holds SDUI widget state, supports undo/redo via `useCanvasState`, and persists dirty state.

### Decision: React Query for all server state

All API calls use TanStack Query (already in the stack) via custom hooks in `apps/ValyntApp/src/hooks/`. Mutations invalidate related queries. Optimistic updates for inline edits.

### Decision: Shared primitives in packages/components

Provenance panel, confidence badges, source badges, and evidence cards are reusable across all surfaces. Build once in `packages/components/components/`, import in surface views.

### Decision: Route structure under existing MainLayout

All new routes nest under `/org/:tenantSlug/` within `MainLayout` (existing shell with sidebar navigation). New nav items added to sidebar for Deal Assembly, Integrity, Outputs, Realization, and Billing.

## Route Map

```
/org/:tenantSlug/
├── dashboard                          (existing)
├── opportunities                      (existing)
├── opportunities/:oppId/cases/:caseId (existing — ValueCaseCanvas)
├── workspace/:caseId                  (existing — ValueCaseWorkspace)
├── workspace/:caseId/assembly         (NEW — DealAssemblyWorkspace)
├── workspace/:caseId/model            (NEW — ValueModelWorkbench)
├── workspace/:caseId/integrity        (NEW — IntegrityDashboard)
├── workspace/:caseId/outputs          (NEW — ExecutiveOutputStudio)
├── workspace/:caseId/realization      (NEW — RealizationTracker)
├── billing                            (NEW — BillingPortal)
├── models                             (existing)
├── agents                             (existing)
├── settings                           (existing)
└── company                            (existing)
```

## Component Architecture

```
ValueCaseWorkspace (existing — pipeline shell)
    │
    ├── DealAssemblyWorkspace
    │   ├── StakeholderMap
    │   ├── UseCaseCards
    │   ├── GapResolutionPanel
    │   └── SourceProvenanceBadges
    │
    ├── ValueModelWorkbench
    │   ├── HypothesisCards
    │   ├── AssumptionRegister
    │   ├── ScenarioComparison
    │   └── SensitivityChart (tornado)
    │
    ├── IntegrityDashboard
    │   ├── ReadinessGauge
    │   ├── EvidenceGapList
    │   ├── PlausibilityFlags
    │   └── ConfidenceDistribution
    │
    ├── ExecutiveOutputStudio
    │   ├── ArtifactTabs
    │   ├── ArtifactPreview
    │   ├── InlineEditor
    │   └── ProvenancePanel
    │
    └── RealizationTracker
        ├── BaselineOverview
        ├── KPITargetCards
        ├── CheckpointTimeline
        └── HandoffNotes

BillingPortal (standalone page)
    ├── UsageDashboard
    ├── PlanSelector
    ├── InvoiceHistory
    ├── PaymentMethods
    └── ApprovalQueue
```

## SDUI Widget Registry Additions

| Widget Type | Surface | Description |
|---|---|---|
| `stakeholder-map` | Deal Assembly | Visual stakeholder role/priority grid |
| `gap-resolution` | Deal Assembly | Missing data items with inline fill |
| `hypothesis-card` | Value Model | Accept/edit/reject hypothesis |
| `assumption-register` | Value Model | Sortable/filterable assumption table |
| `scenario-comparison` | Value Model | Side-by-side ROI/NPV/payback |
| `sensitivity-tornado` | Value Model | Tornado chart for sensitivity |
| `readiness-gauge` | Integrity | Composite score with breakdown |
| `evidence-gap-list` | Integrity | Gap items with actions |
| `artifact-preview` | Outputs | Formatted artifact with traceability |
| `inline-editor` | Outputs | Rich text editing with diff |
| `kpi-target-card` | Realization | Target vs timeline display |
| `checkpoint-timeline` | Realization | Visual checkpoint timeline |
| `usage-meter` | Billing | Usage bar with cap indicator |
| `plan-comparison` | Billing | Side-by-side plan features/pricing |

## File Changes

### New (Views)
- `apps/ValyntApp/src/views/DealAssemblyWorkspace.tsx`
- `apps/ValyntApp/src/views/ValueModelWorkbench.tsx`
- `apps/ValyntApp/src/views/IntegrityDashboard.tsx`
- `apps/ValyntApp/src/views/ExecutiveOutputStudio.tsx`
- `apps/ValyntApp/src/views/RealizationTracker.tsx`
- `apps/ValyntApp/src/views/BillingPortal.tsx`

### New (Hooks)
- `apps/ValyntApp/src/hooks/useDealContext.ts`
- `apps/ValyntApp/src/hooks/useHypotheses.ts`
- `apps/ValyntApp/src/hooks/useAssumptions.ts`
- `apps/ValyntApp/src/hooks/useScenarios.ts`
- `apps/ValyntApp/src/hooks/useReadiness.ts`
- `apps/ValyntApp/src/hooks/useArtifacts.ts`
- `apps/ValyntApp/src/hooks/useProvenance.ts`
- `apps/ValyntApp/src/hooks/useBaseline.ts`
- `apps/ValyntApp/src/hooks/useBilling.ts`

### New (Shared Components)
- `packages/components/components/ProvenancePanel.tsx`
- `packages/components/components/ConfidenceBadge.tsx`
- `packages/components/components/SourceBadge.tsx`
- `packages/components/components/EvidenceCard.tsx`

### New (SDUI Widgets)
- `apps/ValyntApp/src/components/canvas/widgets/StakeholderMap.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/GapResolution.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/HypothesisCard.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/AssumptionRegister.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/ScenarioComparison.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/SensitivityTornado.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/ReadinessGauge.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/EvidenceGapList.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/ArtifactPreview.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/InlineEditor.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/KPITargetCard.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/CheckpointTimeline.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/UsageMeter.tsx`
- `apps/ValyntApp/src/components/canvas/widgets/PlanComparison.tsx`

### Modified
- `apps/ValyntApp/src/AppRoutes.tsx` — Add new routes
- `apps/ValyntApp/src/components/canvas/CanvasHost.tsx` — Register 14 new widgets
- `apps/ValyntApp/src/lib/state/SDUIStateProvider.tsx` — Implement with Zustand
- `apps/ValyntApp/src/layouts/MainLayout.tsx` — Add nav items for new surfaces
