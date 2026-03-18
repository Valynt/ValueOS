# Frontend UI Surfaces and React Hooks

## Problem Statement

The backend infrastructure for ValueOS V1 is complete across all 10 domains (billing, deal assembly, value modeling, executive outputs, trust layer, ground truth, etc.), but the frontend lacks the UI surfaces and React hooks needed to expose these capabilities to users. This creates a gap where the APIs exist but users cannot interact with them through the application interface.

## Motivation

To achieve V1 launch readiness, we need complete frontend surfaces that:
1. Enable users to interact with deal assembly workflows
2. Visualize value modeling scenarios and assumptions
3. Monitor case readiness and integrity metrics
4. Generate and edit executive output artifacts
5. Track realization progress against baselines
6. Manage billing and subscription details

## Success Criteria

- All 6 workspace views (DealAssembly, ValueModel, Integrity, ExecutiveOutput, Realization, Billing) render correctly
- 14+ SDUI widgets are registered and functional in CanvasHost
- 40+ React Query hooks provide data fetching with loading/error states
- Shared UI primitives (ProvenancePanel, ConfidenceBadge, SourceBadge, EvidenceCard) are reusable across surfaces
- User can navigate complete lifecycle: Assembly → Model → Integrity → Outputs → Realization

## Related Changes

- billing-v2 (database and services complete)
- deal-assembly-pipeline (database and services complete)
- value-modeling-engine (database and services complete)
- executive-output-generation (database and services complete)
- trust-layer-completion (database and services complete)
- ground-truth-integration (SECEdgarClient, XBRLParser complete)
