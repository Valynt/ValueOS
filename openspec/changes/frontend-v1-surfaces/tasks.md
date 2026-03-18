# Tasks

## 1. Shared UI Primitives

### 1.1 Provenance Panel

- [ ] 1.1.1 Create `packages/components/components/ProvenancePanel.tsx` — slide-over panel triggered by clicking any financial figure
- [ ] 1.1.2 Display lineage chain: raw data source → formula → agent → confidence → evidence tier
- [ ] 1.1.3 Each chain node shows: label, value, source badge, timestamp
- [ ] 1.1.4 Accept `claimId` prop, fetch lineage via `GET /api/cases/:caseId/provenance/:claimId`
- [ ] 1.1.5 Animate slide-in from right, close on click-outside or Escape
- [ ] 1.1.6 Unit test: renders chain nodes, handles empty chain, handles loading state

### 1.2 Confidence Badge

- [ ] 1.2.1 Create `packages/components/components/ConfidenceBadge.tsx`
- [ ] 1.2.2 Accept `score: number` prop (0–1)
- [ ] 1.2.3 Color coding: green >= 0.8, amber >= 0.5, red < 0.5
- [ ] 1.2.4 Display score as percentage with tier indicator (High / Medium / Low)
- [ ] 1.2.5 Tooltip shows raw score and tier thresholds
- [ ] 1.2.6 Unit test: boundary values (0.5, 0.8), color rendering

### 1.3 Source Badge

- [ ] 1.3.1 Create `packages/components/components/SourceBadge.tsx`
- [ ] 1.3.2 Accept `sourceType: string` prop (customer-confirmed, CRM-derived, call-derived, benchmark-derived, SEC-filing, inferred, manually-overridden)
- [ ] 1.3.3 Each source type has distinct icon and color
- [ ] 1.3.4 Tier indicator: Tier 1 (customer-confirmed, SEC-filing), Tier 2 (CRM-derived, benchmark-derived), Tier 3 (inferred)
- [ ] 1.3.5 Unit test: renders correct icon and color per source type

### 1.4 Evidence Card

- [ ] 1.4.1 Create `packages/components/components/EvidenceCard.tsx`
- [ ] 1.4.2 Display: evidence description, source badge, confidence badge, freshness date, tier indicator
- [ ] 1.4.3 Expandable detail section with full source URL and metadata
- [ ] 1.4.4 Unit test: collapsed and expanded states

## 2. SDUIStateProvider Implementation

- [ ] 2.1 Replace stub `SDUIStateProvider` in `apps/ValyntApp/src/lib/state/SDUIStateProvider.tsx` with Zustand store
- [ ] 2.2 Store widget state per case (keyed by caseId)
- [ ] 2.3 Support undo/redo stack (integrate with existing `useCanvasState`)
- [ ] 2.4 Persist dirty state to sessionStorage for crash recovery
- [ ] 2.5 Expose actions: setWidgetState, resetWidgetState, undo, redo
- [ ] 2.6 Unit test: state transitions, undo/redo, persistence

## 3. SDUI Widget Registry Expansion

### 3.1 Deal Assembly Widgets

- [ ] 3.1.1 Create `StakeholderMap.tsx` widget — grid showing stakeholders with role, priority, source badge
- [ ] 3.1.2 Create `GapResolution.tsx` widget — list of missing data items with inline input fields, submit action, and resolved state
- [ ] 3.1.3 Register both in `CanvasHost.tsx` widget registry

### 3.2 Value Modeling Widgets

- [ ] 3.2.1 Create `HypothesisCard.tsx` widget — value driver, impact range, evidence tier, confidence badge, Accept/Edit/Reject actions
- [ ] 3.2.2 Create `AssumptionRegister.tsx` widget — sortable table with: name, value, unit, source badge, confidence badge, benchmark reference, unsupported flag highlight
- [ ] 3.2.3 Create `ScenarioComparison.tsx` widget — three-column layout showing ROI, NPV, payback, EVF decomposition per scenario with base emphasized
- [ ] 3.2.4 Create `SensitivityTornado.tsx` widget — horizontal bar chart showing assumption impact (positive and negative), clickable bars navigate to assumption
- [ ] 3.2.5 Register all four in `CanvasHost.tsx`

### 3.3 Integrity Widgets

- [ ] 3.3.1 Create `ReadinessGauge.tsx` widget — circular gauge for composite score + four component bars (validation rate, grounding, benchmark coverage, unsupported count)
- [ ] 3.3.2 Create `EvidenceGapList.tsx` widget — list of claims with insufficient evidence, showing current tier, required tier, suggested action
- [ ] 3.3.3 Register both in `CanvasHost.tsx`

### 3.4 Executive Output Widgets

- [ ] 3.4.1 Create `ArtifactPreview.tsx` widget — formatted rendering of artifact content with `data-claim-id` attributes on financial figures for click-to-trace
- [ ] 3.4.2 Create `InlineEditor.tsx` widget — contentEditable region with save/cancel, diff highlight on modified sections, reason prompt on save
- [ ] 3.4.3 Register both in `CanvasHost.tsx`

### 3.5 Realization Widgets

- [ ] 3.5.1 Create `KPITargetCard.tsx` widget — metric name, baseline → target, timeline, source badge, progress indicator (for post-sale)
- [ ] 3.5.2 Create `CheckpointTimeline.tsx` widget — horizontal timeline with measurement dates, expected ranges, status indicators (pending/measured/missed/exceeded)
- [ ] 3.5.3 Register both in `CanvasHost.tsx`

### 3.6 Billing Widgets

- [ ] 3.6.1 Create `UsageMeter.tsx` widget — horizontal bar showing used/cap with percentage, color shifts at 80% and 100%, reset date
- [ ] 3.6.2 Create `PlanComparison.tsx` widget — side-by-side plan cards with features, pricing, current plan indicator, and upgrade CTA
- [ ] 3.6.3 Register both in `CanvasHost.tsx`

## 4. React Query Hooks

### 4.1 Deal Assembly Hooks

- [ ] 4.1.1 Create `useDealContext(caseId)` — `GET /api/cases/:caseId/context`
- [ ] 4.1.2 Create `useSubmitGapFill(caseId)` — `PATCH /api/cases/:caseId/context/gaps`
- [ ] 4.1.3 Create `useTriggerAssembly(caseId)` — `POST /api/cases/:caseId/assemble`

### 4.2 Value Modeling Hooks

- [ ] 4.2.1 Create `useHypotheses(caseId)` — `GET /api/cases/:caseId/hypotheses`
- [ ] 4.2.2 Create `useAcceptHypothesis()` / `useRejectHypothesis()` — mutations
- [ ] 4.2.3 Create `useAssumptions(caseId)` — `GET /api/cases/:caseId/assumptions`
- [ ] 4.2.4 Create `useUpdateAssumption()` — `PATCH` mutation with optimistic update
- [ ] 4.2.5 Create `useScenarios(caseId)` — `GET /api/cases/:caseId/scenarios`
- [ ] 4.2.6 Create `useSensitivity(caseId)` — `GET /api/cases/:caseId/sensitivity`

### 4.3 Integrity Hooks

- [ ] 4.3.1 Create `useReadiness(caseId)` — `GET /api/cases/:caseId/readiness`
- [ ] 4.3.2 Create `useEvidenceGaps(caseId)` — derived from readiness data
- [ ] 4.3.3 Create `usePlausibility(caseId)` — `GET /api/cases/:caseId/plausibility`

### 4.4 Executive Output Hooks

- [ ] 4.4.1 Create `useArtifacts(caseId)` — `GET /api/cases/:caseId/artifacts`
- [ ] 4.4.2 Create `useArtifact(caseId, artifactId)` — single artifact detail
- [ ] 4.4.3 Create `useEditArtifact()` — `PATCH /api/cases/:caseId/artifacts/:artifactId` mutation
- [ ] 4.4.4 Create `useGenerateArtifacts(caseId)` — `POST /api/cases/:caseId/artifacts/generate` mutation
- [ ] 4.4.5 Create `useProvenance(caseId, claimId)` — `GET /api/cases/:caseId/provenance/:claimId`

### 4.5 Realization Hooks

- [ ] 4.5.1 Create `useBaseline(caseId)` — `GET /api/cases/:caseId/baseline`
- [ ] 4.5.2 Create `useCheckpoints(caseId)` — `GET /api/cases/:caseId/baseline/checkpoints`
- [ ] 4.5.3 Create `useApproveCase(caseId)` — `POST /api/cases/:caseId/approve` mutation

### 4.6 Billing Hooks

- [ ] 4.6.1 Create `useBillingSummary()` — `GET /billing/summary`
- [ ] 4.6.2 Create `usePlans()` — `GET /billing/plans`
- [ ] 4.6.3 Create `usePlanChangePreview()` — `POST /billing/plan-change/preview` mutation
- [ ] 4.6.4 Create `useSubmitPlanChange()` — `POST /billing/plan-change/submit` mutation
- [ ] 4.6.5 Create `useInvoices()` — `GET /billing/invoices`
- [ ] 4.6.6 Create `useUsage()` — `GET /billing/usage`
- [ ] 4.6.7 Create `useApprovals()` — `GET /billing/approvals`
- [ ] 4.6.8 Create `useDecideApproval()` — `POST /billing/approvals/:id/decide` mutation

## 5. Page Views

### 5.1 Deal Assembly Workspace

- [ ] 5.1.1 Create `apps/ValyntApp/src/views/DealAssemblyWorkspace.tsx`
- [ ] 5.1.2 Layout: left panel (stakeholder map, use case cards), right panel (gap resolution, source summary)
- [ ] 5.1.3 Header: case name, assembly status (assembling / review / confirmed), trigger re-assembly button
- [ ] 5.1.4 Consume `useDealContext`, `useSubmitGapFill`, `useTriggerAssembly` hooks
- [ ] 5.1.5 Render CanvasHost with default deal assembly widget layout
- [ ] 5.1.6 Source provenance badges on all data points
- [ ] 5.1.7 "Confirm and proceed to modeling" CTA that transitions the case

### 5.2 Value Model Workbench

- [ ] 5.2.1 Create `apps/ValyntApp/src/views/ValueModelWorkbench.tsx`
- [ ] 5.2.2 Tab layout: Hypotheses | Assumptions | Scenarios | Sensitivity
- [ ] 5.2.3 Hypotheses tab: HypothesisCard list with accept/edit/reject
- [ ] 5.2.4 Assumptions tab: AssumptionRegister with inline edit, unsupported flags, filter by source type
- [ ] 5.2.5 Scenarios tab: ScenarioComparison three-column view
- [ ] 5.2.6 Sensitivity tab: SensitivityTornado chart with assumption click-through
- [ ] 5.2.7 Consume `useHypotheses`, `useAssumptions`, `useScenarios`, `useSensitivity` hooks
- [ ] 5.2.8 Render CanvasHost with modeling widget layout
- [ ] 5.2.9 Recalculation indicator when upstream data changes

### 5.3 Integrity Dashboard

- [ ] 5.3.1 Create `apps/ValyntApp/src/views/IntegrityDashboard.tsx`
- [ ] 5.3.2 Top: ReadinessGauge with composite score and component breakdown
- [ ] 5.3.3 Left: EvidenceGapList with actionable items
- [ ] 5.3.4 Right: PlausibilityFlags panel with benchmark context
- [ ] 5.3.5 Bottom: Confidence distribution chart across all claims
- [ ] 5.3.6 Consume `useReadiness`, `useEvidenceGaps`, `usePlausibility` hooks
- [ ] 5.3.7 "Presentation-ready" or "X blockers remaining" status banner

### 5.4 Executive Output Studio

- [ ] 5.4.1 Create `apps/ValyntApp/src/views/ExecutiveOutputStudio.tsx`
- [ ] 5.4.2 Tab bar: Executive Memo | CFO Recommendation | Customer Narrative | Internal Case
- [ ] 5.4.3 Each tab renders ArtifactPreview widget with formatted content
- [ ] 5.4.4 Financial figures have `data-claim-id` — click opens ProvenancePanel
- [ ] 5.4.5 InlineEditor overlay on section click, with save/cancel and reason prompt
- [ ] 5.4.6 DRAFT watermark when readiness < 0.8, inline blocker callouts
- [ ] 5.4.7 "Generate artifacts" button when none exist
- [ ] 5.4.8 Consume `useArtifacts`, `useEditArtifact`, `useGenerateArtifacts`, `useProvenance`, `useReadiness` hooks

### 5.5 Realization Tracker

- [ ] 5.5.1 Create `apps/ValyntApp/src/views/RealizationTracker.tsx`
- [ ] 5.5.2 Header: selected scenario label, approval date, baseline version
- [ ] 5.5.3 KPI target section: KPITargetCard grid showing baseline → target, timeline, source badge
- [ ] 5.5.4 Checkpoint section: CheckpointTimeline with measurement dates and expected ranges
- [ ] 5.5.5 Assumptions section: carried-forward assumptions with source tags (read-only)
- [ ] 5.5.6 Handoff notes section: four-section notes (deal context, buyer priorities, implementation assumptions, key risks)
- [ ] 5.5.7 Consume `useBaseline`, `useCheckpoints` hooks

### 5.6 Billing Portal

- [ ] 5.6.1 Create `apps/ValyntApp/src/views/BillingPortal.tsx`
- [ ] 5.6.2 Usage section: UsageMeter widgets per meter (ai_tokens, api_calls) with caps and trends
- [ ] 5.6.3 Plan section: current plan card + PlanComparison for upgrade/downgrade
- [ ] 5.6.4 Plan change flow: preview modal with delta summary, approval routing if over threshold
- [ ] 5.6.5 Invoice section: paginated invoice list with period, amount, status, detail link
- [ ] 5.6.6 Payment methods section: list of cards, add/remove via Stripe Elements
- [ ] 5.6.7 Approval queue section (enterprise): pending approvals with approve/reject actions
- [ ] 5.6.8 Consume `useBillingSummary`, `usePlans`, `useInvoices`, `useUsage`, `useApprovals` hooks

## 6. Routing and Navigation

- [ ] 6.1 Add lazy imports to `AppRoutes.tsx` for all 6 new page views
- [ ] 6.2 Add routes under `/org/:tenantSlug/`:
  - `workspace/:caseId/assembly` → DealAssemblyWorkspace
  - `workspace/:caseId/model` → ValueModelWorkbench
  - `workspace/:caseId/integrity` → IntegrityDashboard
  - `workspace/:caseId/outputs` → ExecutiveOutputStudio
  - `workspace/:caseId/realization` → RealizationTracker
  - `billing` → BillingPortal
- [ ] 6.3 Add legacy route bridges for non-tenant paths
- [ ] 6.4 Add navigation items to `MainLayout.tsx` sidebar:
  - Billing (under Settings group)
- [ ] 6.5 Add sub-navigation within ValueCaseWorkspace for case-scoped surfaces:
  - Assembly → Model → Integrity → Outputs → Realization (lifecycle progression tabs)
- [ ] 6.6 Highlight active lifecycle stage in sub-nav based on case status

## 7. Workspace Lifecycle Navigation

- [ ] 7.1 Create `apps/ValyntApp/src/components/workspace/LifecycleNav.tsx` — horizontal tab bar showing lifecycle stages
- [ ] 7.2 Stages: Assembly → Modeling → Integrity → Outputs → Realization
- [ ] 7.3 Visual indicators: completed (checkmark), active (highlighted), locked (greyed, requires prior stage)
- [ ] 7.4 Click navigates to corresponding workspace/:caseId/* route
- [ ] 7.5 Embed LifecycleNav in ValueCaseWorkspace above CanvasHost
- [ ] 7.6 Unit test: stage highlighting, locked state, navigation

## 8. Accessibility

- [ ] 8.1 All new widgets support keyboard navigation (Tab, Enter, Escape)
- [ ] 8.2 All badges have aria-label with full text description
- [ ] 8.3 ProvenancePanel is focus-trapped when open
- [ ] 8.4 Charts (tornado, gauge) include sr-only text descriptions
- [ ] 8.5 InlineEditor announces save/cancel state changes via aria-live
- [ ] 8.6 Color coding never used as sole differentiator (always paired with text/icon)

## 9. Tests

### 9.1 Shared Primitives

- [ ] 9.1.1 Unit test ProvenancePanel: chain rendering, loading, empty state, close behavior
- [ ] 9.1.2 Unit test ConfidenceBadge: boundary values, color coding, tooltip
- [ ] 9.1.3 Unit test SourceBadge: all source types, tier indicators
- [ ] 9.1.4 Unit test EvidenceCard: collapsed/expanded, all fields rendered

### 9.2 Widgets

- [ ] 9.2.1 Unit test StakeholderMap: renders stakeholders with roles and badges
- [ ] 9.2.2 Unit test GapResolution: inline input, submit, resolved state
- [ ] 9.2.3 Unit test HypothesisCard: accept/edit/reject actions emit correct events
- [ ] 9.2.4 Unit test AssumptionRegister: sorting, filtering, unsupported highlight
- [ ] 9.2.5 Unit test ScenarioComparison: three columns render, base emphasized
- [ ] 9.2.6 Unit test SensitivityTornado: bars render, click navigates
- [ ] 9.2.7 Unit test ReadinessGauge: score rendering, component bars
- [ ] 9.2.8 Unit test EvidenceGapList: gap items with actions
- [ ] 9.2.9 Unit test ArtifactPreview: content rendering, claim-id attributes present
- [ ] 9.2.10 Unit test InlineEditor: edit mode, save with reason, cancel reverts
- [ ] 9.2.11 Unit test KPITargetCard: baseline → target display, source badge
- [ ] 9.2.12 Unit test CheckpointTimeline: dates render, status indicators
- [ ] 9.2.13 Unit test UsageMeter: percentage display, color shifts at 80%/100%
- [ ] 9.2.14 Unit test PlanComparison: current plan indicator, upgrade CTA

### 9.3 Page Views

- [ ] 9.3.1 Unit test DealAssemblyWorkspace: renders with mocked deal context, gap fill works
- [ ] 9.3.2 Unit test ValueModelWorkbench: tab switching, hypothesis accept/reject
- [ ] 9.3.3 Unit test IntegrityDashboard: readiness rendering, blocker banner
- [ ] 9.3.4 Unit test ExecutiveOutputStudio: tab switching, inline edit, provenance click
- [ ] 9.3.5 Unit test RealizationTracker: baseline rendering, checkpoint timeline
- [ ] 9.3.6 Unit test BillingPortal: usage meters, plan change preview, invoice list

### 9.4 Hooks

- [ ] 9.4.1 Unit test all React Query hooks: loading, success, error states
- [ ] 9.4.2 Unit test mutation hooks: optimistic updates, cache invalidation

### 9.5 Integration

- [ ] 9.5.1 Integration test: navigate through lifecycle tabs (Assembly → Model → Integrity → Outputs → Realization)
- [ ] 9.5.2 Integration test: click financial figure → provenance panel opens with chain
- [ ] 9.5.3 Integration test: inline edit artifact → edit logged in audit trail
- [ ] 9.5.4 E2E test: full case lifecycle from dashboard → assembly → model → integrity → outputs → realization
