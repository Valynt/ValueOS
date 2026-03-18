# Frontend UI Surfaces and React Hooks — Design

## Architecture

### Component Hierarchy

```
AppRoutes.tsx (lazy imports)
├── DealAssemblyWorkspace
│   └── CanvasHost
│       ├── StakeholderMap
│       ├── GapResolution
│       └── SourceSummary
├── ValueModelWorkbench
│   └── CanvasHost
│       ├── HypothesisCard[]
│       ├── AssumptionRegister
│       ├── ScenarioComparison
│       └── SensitivityTornado
├── IntegrityDashboard
│   └── CanvasHost
│       ├── ReadinessGauge
│       └── EvidenceGapList
├── ExecutiveOutputStudio
│   └── CanvasHost
│       ├── ArtifactPreview
│       └── InlineEditor
├── RealizationTracker
│   └── CanvasHost
│       ├── KPITargetCard[]
│       └── CheckpointTimeline
└── BillingPortal
    └── CanvasHost
        ├── UsageMeter[]
        └── PlanComparison
```

### Shared Primitives (packages/components)

All primitives accept standardized props and emit consistent events:

- **ProvenancePanel**: `{ claimId: string, caseId: string, onClose: () => void }` — Slide-over for claim lineage
- **ConfidenceBadge**: `{ score: number, showTooltip?: boolean }` — Color-coded confidence indicator
- **SourceBadge**: `{ sourceType: SourceType, size?: 'sm' | 'md' }` — Icon + label for data source
- **EvidenceCard**: `{ evidence: Evidence, expandable?: boolean }` — Evidence display with metadata

### State Management

- **SDUIStateProvider**: Zustand store per case (keyed by caseId)
  - Widget state persistence
  - Undo/redo stack integration
  - sessionStorage crash recovery
- **React Query**: Server state caching with optimistic updates
  - Invalidation patterns: `['cases', caseId, 'assumptions']` → refetch assumptions
  - Mutation hooks with cache updates

## API Integration

### Hook Patterns

All hooks follow consistent pattern:
```typescript
export function useAssumptions(caseId: string) {
  return useQuery({
    queryKey: ['cases', caseId, 'assumptions'],
    queryFn: () => fetchAssumptions(caseId),
    enabled: !!caseId,
  });
}
```

### Key Endpoints

- `GET /api/cases/:caseId/context` — Deal context
- `GET /api/cases/:caseId/assumptions` — Assumption register
- `GET /api/cases/:caseId/scenarios` — Scenario data
- `GET /api/cases/:caseId/readiness` — Readiness score
- `GET /api/cases/:caseId/artifacts` — Executive artifacts
- `GET /api/cases/:caseId/provenance/:claimId` — Claim lineage
- `GET /billing/summary` — Billing summary
- `GET /billing/usage` — Usage metrics

## File Organization

```
packages/components/components/
├── ProvenancePanel.tsx
├── ConfidenceBadge.tsx
├── SourceBadge.tsx
└── EvidenceCard.tsx

apps/ValyntApp/src/
├── hooks/
│   ├── useDealContext.ts
│   ├── useAssumptions.ts
│   ├── useScenarios.ts
│   ├── useReadiness.ts
│   ├── useArtifacts.ts
│   ├── useProvenance.ts
│   └── billing/
│       ├── useBillingSummary.ts
│       ├── useUsage.ts
│       └── useInvoices.ts
├── views/
│   ├── DealAssemblyWorkspace.tsx
│   ├── ValueModelWorkbench.tsx
│   ├── IntegrityDashboard.tsx
│   ├── ExecutiveOutputStudio.tsx
│   ├── RealizationTracker.tsx
│   └── BillingPortal.tsx
├── components/workspace/
│   ├── CanvasHost.tsx
│   ├── LifecycleNav.tsx
│   └── widgets/
│       ├── StakeholderMap.tsx
│       ├── HypothesisCard.tsx
│       ├── AssumptionRegister.tsx
│       ├── ScenarioComparison.tsx
│       ├── SensitivityTornado.tsx
│       ├── ReadinessGauge.tsx
│       ├── EvidenceGapList.tsx
│       ├── ArtifactPreview.tsx
│       ├── InlineEditor.tsx
│       ├── KPITargetCard.tsx
│       ├── CheckpointTimeline.tsx
│       ├── UsageMeter.tsx
│       └── PlanComparison.tsx
└── lib/state/
    └── SDUIStateProvider.tsx (Zustand store)
```

## Dependencies

- `@tanstack/react-query` — Server state management
- `zustand` — Client state management
- `lucide-react` — Icons for source badges
- `recharts` — Charts for sensitivity tornado
- `@radix-ui/react-*` — Accessible UI primitives

## Accessibility Requirements

- Keyboard navigation (Tab, Enter, Escape) on all widgets
- aria-label descriptions on all badges
- Focus trap in ProvenancePanel when open
- Screen reader text for charts
- aria-live announcements for InlineEditor state changes
- Color never used as sole differentiator
