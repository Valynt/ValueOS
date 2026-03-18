# ValueOS Living Value Graph - Implementation TODO
## Comprehensive Task List for Production UI

**Generated**: March 2026  
**Estimated Duration**: 4 weeks  
**Team Size**: 2-3 frontend engineers

---

## Phase 1: Foundation & Workflow State (Days 1-5)

### Week 1, Day 1: Project Setup
- [ ] Initialize Next.js project with shadcn/ui
- [ ] Install dependencies: TanStack Query, Zustand, React Hook Form, Zod, React Flow
- [ ] Set up directory structure per implementation plan
- [ ] Configure Tailwind with custom color tokens
- [ ] Create base type definitions

**Files to create**:
- `app/layout.tsx`
- `tailwind.config.ts`
- `lib/utils.ts`

---

### Week 1, Day 2: Core Types & Schemas
- [ ] Define graph types (`types/graph.types.ts`)
- [ ] Define workflow types (`types/workflow.types.ts`)
- [ ] Define defensibility types (`types/defensibility.types.ts`)
- [ ] Create Zod schemas for validation
- [ ] Set up SDUI schema foundation

**Files to create**:
- `features/living-value-graph/types/graph.types.ts`
- `features/living-value-graph/types/workflow.types.ts`
- `features/living-value-graph/types/defensibility.types.ts`
- `features/living-value-graph/types/ui.types.ts`
- `features/living-value-graph/schemas/graph.schema.ts`
- `features/living-value-graph/schemas/workflow.schema.ts`

**Acceptance Criteria**:
- All types compile without errors
- Zod schemas validate test data
- Type coverage > 90%

---

### Week 1, Day 3: Workflow State Management
- [ ] Implement `workflow-store.ts` with Zustand
- [ ] Add 6-state orchestration machine
- [ ] Add 7-step workflow tracking
- [ ] Implement phase transition logic
- [ ] Add validation for state changes
- [ ] Persist state to localStorage

**Files to create**:
- `features/living-value-graph/store/workflow-store.ts`
- `features/living-value-graph/hooks/useWorkflowState.ts`

**Key Functions**:
```typescript
advancePhase(to: WorkflowState, reason: string)
completeStep(step: WorkflowStep)
blockStep(step: WorkflowStep, reason: string)
getGatingRules(): GatingRules
```

**Acceptance Criteria**:
- Can transition through all 6 states
- Invalid transitions are blocked
- Step completion updates progress
- State persists across reloads

---

### Week 1, Day 4: State Gating System
- [ ] Create `GATING_MATRIX` constant
- [ ] Implement `useStateGating` hook
- [ ] Add utility functions for permission checks
- [ ] Create HOC for gated components
- [ ] Add tooltip/feedback for disabled actions

**Files to create**:
- `features/living-value-graph/utils/state-gating.ts`
- `features/living-value-graph/hooks/useStateGating.ts`

**Gating Matrix**:
```typescript
INITIATED:  { edit: true, redTeam: false, approval: false }
DRAFTING:   { edit: true, redTeam: true, approval: false }
VALIDATING: { edit: true, redTeam: true, approval: true }
COMPOSING:  { edit: false, redTeam: false, approval: true }
REFINING:   { edit: true, redTeam: true, approval: true }
FINALIZED:  { edit: false, redTeam: false, approval: false }
```

**Acceptance Criteria**:
- Actions correctly enabled/disabled per state
- Tooltips explain why actions are disabled
- Privileged users can override with audit trail

---

### Week 1, Day 5: Shell Components
- [ ] Implement `AppShell` layout
- [ ] Implement `TopNav` with workflow indicator
- [ ] Implement `MainWorkspace` 3-column layout
- [ ] Add resizable panels
- [ ] Create `StateBadge` component

**Files to create**:
- `features/living-value-graph/components/shell/AppShell.tsx`
- `features/living-value-graph/components/shell/TopNav.tsx`
- `features/living-value-graph/components/shell/MainWorkspace.tsx`
- `features/living-value-graph/components/header/StateBadge.tsx`

**Acceptance Criteria**:
- Responsive layout (desktop/tablet)
- Panels resizable with min/max constraints
- State badge shows correct phase
- Visual hierarchy clear

---

## Phase 2: Workflow Visualization (Days 6-10)

### Week 2, Day 1: Workflow Step Panel
- [ ] Create vertical stepper component
- [ ] Add step status indicators (not_started, active, complete, blocked)
- [ ] Implement click handlers for step navigation
- [ ] Add tooltips with owner/blocking info
- [ ] Animate step transitions

**Files to create**:
- `features/living-value-graph/components/left-rail/WorkflowStepPanel.tsx`

**Visual Design**:
```
[✓] 1. Hypothesis      [Complete]
[→] 2. Model           [Active - Alice Chen]
[○] 3. Evidence        [Blocked - needs 2 more sources]
```

**Acceptance Criteria**:
- All 7 steps visible
- Status changes animate smoothly
- Click shows blocking details
- Responsive on mobile

---

### Week 2, Day 2: Workflow Timeline
- [ ] Create horizontal timeline component
- [ ] Show phase history with timestamps
- [ ] Display actors for each transition
- [ ] Show blocking issues between phases
- [ ] Add expand/collapse for phase details

**Files to create**:
- `features/living-value-graph/components/bottom-tray/WorkflowTimeline.tsx`

**Acceptance Criteria**:
- Timeline shows all phase transitions
- Hover shows trigger reason
- Click expands phase details
- Updates in real-time

---

### Week 2, Day 3: Gated Actions Implementation
- [ ] Update `InlineMutationBar` with state gating
- [ ] Update `NodeActionsPanel` with state gating
- [ ] Update `ApprovalActions` in TopNav
- [ ] Add lock icons for disabled actions
- [ ] Implement override flow for privileged users

**Files to modify**:
- `features/living-value-graph/components/canvas/InlineMutationBar.tsx`
- `features/living-value-graph/components/inspector/NodeActionsPanel.tsx`
- `features/living-value-graph/components/shell/TopNav.tsx`

**Acceptance Criteria**:
- Edit disabled in COMPOSING and FINALIZED
- Approval only in VALIDATING, COMPOSING, REFINING
- Override requires reason and audit log
- Visual feedback clear

---

### Week 2, Day 4: LeftRail Components
- [ ] Implement `GraphOutlinePanel`
- [ ] Implement `ScenarioLibraryPanel`
- [ ] Implement `SavedViewsPanel`
- [ ] Update `ArtifactsPanel` with stale indicator
- [ ] Add tab switching logic

**Files to create**:
- `features/living-value-graph/components/left-rail/GraphOutlinePanel.tsx`
- `features/living-value-graph/components/left-rail/ScenarioLibraryPanel.tsx`
- `features/living-value-graph/components/left-rail/SavedViewsPanel.tsx`
- `features/living-value-graph/components/left-rail/ArtifactsPanel.tsx`

**Acceptance Criteria**:
- Tree view navigable
- Scenario switching works
- Artifacts show stale warning
- Tab state persists

---

### Week 2, Day 5: Workspace Header
- [ ] Implement `HeadlineValueCard`
- [ ] Implement `ROIStatCard`
- [ ] Implement `PaybackStatCard`
- [ ] Implement `ConfidenceStatCard`
- [ ] Create `ViewModeTabs` for canvas switching

**Files to create**:
- `features/living-value-graph/components/header/HeadlineValueCard.tsx`
- `features/living-value-graph/components/header/ROIStatCard.tsx`
- `features/living-value-graph/components/header/PaybackStatCard.tsx`
- `features/living-value-graph/components/header/ConfidenceStatCard.tsx`
- `features/living-value-graph/components/header/ViewModeTabs.tsx`

**Acceptance Criteria**:
- Metrics display with correct formatting
- Tab switching updates canvas
- Numbers use tabular numerals
- Values update on graph change

---

## Phase 3: Defensibility System (Days 11-15)

### Week 3, Day 1: Defensibility Calculation
- [ ] Implement `defensibility-calc.ts` utilities
- [ ] Create `defensibility-store.ts` with Zustand
- [ ] Add node-level coverage calculation
- [ ] Add global score aggregation
- [ ] Implement evidence validation rules

**Files to create**:
- `features/living-value-graph/utils/defensibility-calc.ts`
- `features/living-value-graph/store/defensibility-store.ts`
- `features/living-value-graph/hooks/useDefensibility.ts`
- `features/living-value-graph/schemas/defensibility.schema.ts`

**Formula**:
```typescript
defensibility_score = Σ(node_value × evidence_coverage) / total_value
evidence_coverage = high_confidence_evidence / total_evidence_needed
```

**Acceptance Criteria**:
- Calculation is deterministic
- Updates when evidence changes
- Performance: < 100ms for 500 nodes
- Score accurate to 2 decimal places

---

### Week 3, Day 2: DefensibilityScoreCard
- [ ] Create circular progress ring component
- [ ] Add color coding (green/amber/red)
- [ ] Show percentage and dollar breakdown
- [ ] Add blocking indicator when < 70%
- [ ] Animate on score change

**Files to create**:
- `features/living-value-graph/components/header/DefensibilityScoreCard.tsx`

**Visual**:
- Ring chart with 0-100% scale
- Center shows main score (e.g., "87%")
- Below: "$42M of $48M backed by evidence"
- Red warning when blocking

**Acceptance Criteria**:
- Ring renders correctly at all sizes
- Colors match design tokens
- Blocking state prevents approval
- Accessible (ARIA labels, keyboard nav)

---

### Week 3, Day 3: DefensibilityPanel (Inspector)
- [ ] Create panel showing node-level defensibility
- [ ] Display evidence coverage bar
- [ ] Show source independence count
- [ ] Add warning cards for issues
- [ ] Implement "Request evidence" action

**Files to create**:
- `features/living-value-graph/components/inspector/DefensibilityPanel.tsx`

**Content**:
```
Evidence Coverage: [████████░░] 78%
Source Independence: 3 distinct sources
Audit Trail: Complete
Warnings:
⚠️ Low coverage on key assumption
⚠️ Single source for revenue driver
```

**Acceptance Criteria**:
- Shows accurate coverage per node
- Warnings trigger on thresholds
- Quick actions work
- Updates when evidence added

---

### Week 3, Day 4: DefensibilityFeed
- [ ] Create feed component for issues
- [ ] Show top evidence gaps
- [ ] Display stale citations
- [ ] Add quick fix buttons
- [ ] Sort by value at risk

**Files to create**:
- `features/living-value-graph/components/bottom-tray/DefensibilityFeed.tsx`

**Acceptance Criteria**:
- Lists issues sorted by severity
- Shows value at risk per issue
- Click navigates to node
- Quick actions trigger workflows

---

### Week 3, Day 5: Evidence Panel Enhancement
- [ ] Update `EvidencePanel` with source lineage
- [ ] Add confidence contribution display
- [ ] Show citation location
- [ ] Add freshness indicator
- [ ] Link to source documents

**Files to modify**:
- `features/living-value-graph/components/inspector/EvidencePanel.tsx`

**Acceptance Criteria**:
- Each evidence shows full attribution
- Stale evidence flagged
- Click opens source
- Mobile responsive

---

## Phase 4: Canvas & Graph (Days 16-20)

### Week 4, Day 1: Graph Canvas Setup
- [ ] Set up React Flow canvas
- [ ] Create custom node types
- [ ] Add edge rendering
- [ ] Implement zoom/pan controls
- [ ] Add node selection logic

**Files to create**:
- `features/living-value-graph/components/canvas/ValueTreeCanvas.tsx`
- `features/living-value-graph/components/canvas/GraphToolbar.tsx`
- `features/living-value-graph/utils/graph-layout.ts`

**Node Types**:
- Driver node (large, value display)
- Metric node (medium, delta indicator)
- Input node (small, editable if permitted)

**Acceptance Criteria**:
- 500+ nodes render smoothly
- Selection updates inspector
- Zoom/pan performant
- Layout auto-arranges

---

### Week 4, Day 2: Node Visual States
- [ ] Implement all node states
- [ ] Add lock badges for FINALIZED
- [ ] Show confidence chips
- [ ] Add evidence count indicators
- [ ] Implement hover/selected styling

**States to implement**:
- `default` - Normal display
- `hovered` - Light ring, quick stats
- `selected` - Strong border, inspector sync
- `low_confidence` - Amber indicator
- `locked` - Lock badge, subdued
- `stale` - Dotted border

**Acceptance Criteria**:
- Each state visually distinct
- Animations smooth (300ms)
- Badges don't overlap
- Color contrast accessible

---

### Week 4, Day 3: Canvas Router & Views
- [ ] Implement `CanvasRouter` for view switching
- [ ] Create `WaterfallCanvas`
- [ ] Create `ScenarioCompareCanvas`
- [ ] Create `SensitivityCanvas`
- [ ] Create `TimelineCanvas`

**Files to create**:
- `features/living-value-graph/components/canvas/CanvasRouter.tsx`
- `features/living-value-graph/components/canvas/WaterfallCanvas.tsx`
- `features/living-value-graph/components/canvas/ScenarioCompareCanvas.tsx`
- `features/living-value-graph/components/canvas/SensitivityCanvas.tsx`
- `features/living-value-graph/components/canvas/TimelineCanvas.tsx`

**Acceptance Criteria**:
- View switching instant
- Each canvas shows correct data
- Charts responsive
- Export functionality works

---

### Week 4, Day 4: Inspector Components
- [ ] Implement `InspectorHeader`
- [ ] Implement `NodeSummaryCard`
- [ ] Implement `FormulaPanel`
- [ ] Implement `InputsPanel`
- [ ] Implement `ConfidencePanel`
- [ ] Implement `ObjectionsPanel`
- [ ] Implement `RevisionHistoryPanel`

**Files to create**:
- `features/living-value-graph/components/inspector/InspectorHeader.tsx`
- `features/living-value-graph/components/inspector/NodeSummaryCard.tsx`
- `features/living-value-graph/components/inspector/FormulaPanel.tsx`
- `features/living-value-graph/components/inspector/InputsPanel.tsx`
- `features/living-value-graph/components/inspector/ConfidencePanel.tsx`
- `features/living-value-graph/components/inspector/ObjectionsPanel.tsx`
- `features/living-value-graph/components/inspector/RevisionHistoryPanel.tsx`

**Acceptance Criteria**:
- All panels render correct data
- Formulas display in monospace
- Inputs editable (if state allows)
- History shows full audit trail

---

### Week 4, Day 5: Bottom Tray Components
- [ ] Implement `AgentConsole`
- [ ] Implement `ActivityFeed`
- [ ] Implement `ValidationFeed`
- [ ] Add tab switching
- [ ] Integrate with workflow state

**Files to create**:
- `features/living-value-graph/components/bottom-tray/AgentConsole.tsx`
- `features/living-value-graph/components/bottom-tray/ActivityFeed.tsx`
- `features/living-value-graph/components/bottom-tray/ValidationFeed.tsx`

**Acceptance Criteria**:
- Console accepts commands
- Feed shows chronological events
- Validation shows errors/warnings
- Tabs persist selection

---

## Phase 5: Drawers, Modals & Polish (Days 21-25)

### Week 5, Day 1: Drawers
- [ ] Implement `AssumptionEditDrawer`
- [ ] Implement `EvidenceViewerDrawer`
- [ ] Implement `ScenarioBuilderDrawer`
- [ ] Implement `DiffReviewDrawer`
- [ ] Add drawer animation

**Files to create**:
- `features/living-value-graph/components/drawers/AssumptionEditDrawer.tsx`
- `features/living-value-graph/components/drawers/EvidenceViewerDrawer.tsx`
- `features/living-value-graph/components/drawers/ScenarioBuilderDrawer.tsx`
- `features/living-value-graph/components/drawers/DiffReviewDrawer.tsx`

**Acceptance Criteria**:
- Drawers slide in/out smoothly
- Content scrollable
- Close on escape/overlay click
- State persists while open

---

### Week 5, Day 2: Modals
- [ ] Implement `CreateNodeModal`
- [ ] Implement `LinkEvidenceModal`
- [ ] Implement `RedTeamReviewModal`
- [ ] Implement `LockVersionModal` with gating
- [ ] Implement `ExportArtifactModal`

**Files to create**:
- `features/living-value-graph/components/modals/CreateNodeModal.tsx`
- `features/living-value-graph/components/modals/LinkEvidenceModal.tsx`
- `features/living-value-graph/components/modals/RedTeamReviewModal.tsx`
- `features/living-value-graph/components/modals/LockVersionModal.tsx`
- `features/living-value-graph/components/modals/ExportArtifactModal.tsx`

**Acceptance Criteria**:
- Modals centered with overlay
- Forms validate before submit
- LockVersionModal checks defensibility
- Exports generate correct files

---

### Week 5, Day 3: Approval Flow
- [ ] Implement `ApprovalDrawer`
- [ ] Add validation checklist
- [ ] Integrate defensibility check
- [ ] Add override flow
- [ ] Implement audit logging

**Files to create**:
- `features/living-value-graph/components/drawers/ApprovalDrawer.tsx`

**Validation Checklist**:
- [ ] Defensibility score ≥ 70%
- [ ] No blocking formula errors
- [ ] No unresolved critical objections
- [ ] All high-value nodes have evidence

**Acceptance Criteria**:
- All checks visible
- Blockers prevent approval
- Override requires reason
- Audit trail captures decision

---

### Week 5, Day 4: SDUI Integration
- [ ] Create SDUI payload endpoint
- [ ] Implement SDUI renderer
- [ ] Add component registry
- [ ] Handle unknown components (fail closed)
- [ ] Add schema validation

**Files to create**:
- `app/api/sdui/route.ts`
- `features/living-value-graph/components/SDUIRenderer.tsx`
- `features/living-value-graph/schemas/sdui.schema.ts`

**SDUI Components to Support**:
- `stat_card`
- `defensibility_panel`
- `workflow_stepper`
- `node_summary`
- `formula_panel`
- `evidence_list`
- `confidence_panel`
- `objections_panel`

**Acceptance Criteria**:
- Server payload renders correctly
- Unknown components don't crash
- Layout responsive
- Props type-safe

---

### Week 5, Day 5: API Hooks
- [ ] Create `useGraphData` hook
- [ ] Create `useScenarioState` hook
- [ ] Create `useNodeSelection` hook
- [ ] Create `useGraphMutations` hook
- [ ] Create `useApprovalFlow` hook

**Files to create**:
- `features/living-value-graph/hooks/useGraphData.ts`
- `features/living-value-graph/hooks/useScenarioState.ts`
- `features/living-value-graph/hooks/useNodeSelection.ts`
- `features/living-value-graph/hooks/useGraphMutations.ts`
- `features/living-value-graph/hooks/useApprovalFlow.ts`

**Acceptance Criteria**:
- Hooks handle loading states
- Errors displayed gracefully
- Optimistic updates work
- Cache invalidation correct

---

## Phase 6: Testing & Optimization (Days 26-28)

### Week 6, Day 1: Unit Tests
- [ ] Test workflow store
- [ ] Test defensibility calculations
- [ ] Test state gating logic
- [ ] Test component rendering
- [ ] Test hook behavior

**Test Files**:
- `features/living-value-graph/store/workflow-store.test.ts`
- `features/living-value-graph/utils/defensibility-calc.test.ts`
- `features/living-value-graph/utils/state-gating.test.ts`

**Coverage Targets**:
- Store logic: 100%
- Utilities: 90%
- Components: 70%

---

### Week 6, Day 2: Integration Tests
- [ ] Test workflow phase transitions
- [ ] Test defensibility blocking approval
- [ ] Test state gating across components
- [ ] Test SDUI rendering
- [ ] Test graph interactions

**Test Files**:
- `features/living-value-graph/__tests__/workflow-flow.test.tsx`
- `features/living-value-graph/__tests__/defensibility-flow.test.tsx`
- `features/living-value-graph/__tests__/state-gating.test.tsx`

---

### Week 6, Day 3: Performance Optimization
- [ ] Add React.memo to node components
- [ ] Implement virtualization for lists
- [ ] Optimize graph layout algorithm
- [ ] Add debouncing to inputs
- [ ] Profile and fix bottlenecks

**Targets**:
- First paint < 2s
- Graph interaction 60fps
- Input response < 50ms
- Memory < 200MB for 500 nodes

---

## Appendix: Dependencies

### Required Packages
```bash
# Core
npm install react react-dom next

# State
npm install zustand @tanstack/react-query

# Forms & Validation
npm install react-hook-form zod @hookform/resolvers

# UI Components
npm install shadcn/ui
npx shadcn add button card badge dialog drawer tabs scroll-area

# Graph Canvas
npm install reactflow

# Charts
npm install recharts

# Utilities
npm install date-fns lodash clsx tailwind-merge

# Testing
npm install vitest @testing-library/react @testing-library/jest-dom
```

---

## Appendix: Definition of Done

### Per Component
- [ ] TypeScript compiles without errors
- [ ] Props fully typed with interfaces
- [ ] Unit tests pass (if logic-heavy)
- [ ] Storybook story created (if visual)
- [ ] Accessibility check (keyboard nav, ARIA)
- [ ] Mobile responsive (if applicable)
- [ ] Code reviewed

### Per Phase
- [ ] All features in phase working
- [ ] Integration tests pass
- [ ] No console errors
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Final Deliverable
- [ ] All 67 files implemented
- [ ] 7-step workflow fully functional
- [ ] Defensibility system blocks approval < 70%
- [ ] State gating prevents illegal actions
- [ ] SDUI renders server payloads
- [ ] Test coverage > 70%
- [ ] Performance targets met
- [ ] Deployed to staging

---

## Quick Reference

### State Gating Check
```typescript
const { canEdit, canApprove } = useStateGating();

// In component
{canEdit && <EditButton />}
{canApprove && <ApproveButton />}
```

### Defensibility Check
```typescript
const { globalScore, isAboveThreshold } = useDefensibility();

// Block approval if needed
const canLock = isAboveThreshold(0.7) && validationPassed;
```

### Workflow Advance
```typescript
const { advancePhase, completeStep } = useWorkflowState();

// Complete current step
completeStep("evidence");

// Advance to next phase
advancePhase("COMPOSING", "Evidence sufficient");
```
