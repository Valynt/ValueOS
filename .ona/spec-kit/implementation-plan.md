# ValueOS Living Value Graph
## File-by-File Implementation Plan

**Version**: 1.0.0  
**Generated from**: Unified Specification v1.0  
**Scope**: Frontend implementation with TypeScript, React, Zustand, SDUI

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Route Files](#route-files)
3. [Shell Components](#shell-components)
4. [Header Components](#header-components)
5. [LeftRail Components](#leftrail-components)
6. [CenterCanvas Components](#centercanvas-components)
7. [RightInspector Components](#rightinspector-components)
8. [BottomTray Components](#bottomtray-components)
9. [Drawers](#drawers)
10. [Modals](#modals)
11. [State Management (Zustand)](#state-management-zustand)
12. [SDUI Schemas](#sdui-schemas)
13. [Hooks](#hooks)
14. [Types](#types)
15. [Utilities](#utilities)
16. [Implementation Priority](#implementation-priority)

---

## Directory Structure

```
app/
├── (routes)/
│   └── living-value-graph/
│       ├── page.tsx                    # Main page composition
│       ├── layout.tsx                  # Route-level layout
│       ├── loading.tsx                 # Suspense fallback
│       └── error.tsx                   # Error boundary
│
├── api/
│   └── sdui/
│       └── route.ts                     # SDUI payload endpoint
│
features/
└── living-value-graph/
    ├── components/
    │   ├── shell/
    │   │   ├── AppShell.tsx
    │   │   ├── TopNav.tsx
    │   │   ├── WorkspaceHeader.tsx
    │   │   ├── MainWorkspace.tsx
    │   │   ├── LeftRail.tsx
    │   │   ├── CenterCanvas.tsx
    │   │   ├── RightInspector.tsx
    │   │   └── BottomTray.tsx
    │   │
    │   ├── header/
    │   │   ├── HeadlineValueCard.tsx
    │   │   ├── ROIStatCard.tsx
    │   │   ├── PaybackStatCard.tsx
    │   │   ├── ConfidenceStatCard.tsx
    │   │   ├── DefensibilityScoreCard.tsx      [NEW]
    │   │   ├── OpportunitySummaryCard.tsx
    │   │   ├── ViewModeTabs.tsx
    │   │   └── StateBadge.tsx
    │   │
    │   ├── left-rail/
    │   │   ├── WorkflowStepPanel.tsx           [NEW]
    │   │   ├── GraphOutlinePanel.tsx
    │   │   ├── ScenarioLibraryPanel.tsx
    │   │   ├── SavedViewsPanel.tsx
    │   │   └── ArtifactsPanel.tsx
    │   │
    │   ├── canvas/
    │   │   ├── GraphToolbar.tsx
    │   │   ├── CanvasRouter.tsx
    │   │   ├── ValueTreeCanvas.tsx
    │   │   ├── WaterfallCanvas.tsx
    │   │   ├── ScenarioCompareCanvas.tsx
    │   │   ├── SensitivityCanvas.tsx
    │   │   ├── TimelineCanvas.tsx
    │   │   └── InlineMutationBar.tsx
    │   │
    │   ├── inspector/
    │   │   ├── InspectorHeader.tsx
    │   │   ├── NodeSummaryCard.tsx
    │   │   ├── FormulaPanel.tsx
    │   │   ├── InputsPanel.tsx
    │   │   ├── EvidencePanel.tsx
    │   │   ├── ConfidencePanel.tsx
    │   │   ├── DefensibilityPanel.tsx            [NEW]
    │   │   ├── ObjectionsPanel.tsx
    │   │   ├── RevisionHistoryPanel.tsx
    │   │   └── NodeActionsPanel.tsx
    │   │
    │   ├── bottom-tray/
    │   │   ├── WorkflowTimeline.tsx              [NEW]
    │   │   ├── AgentConsole.tsx
    │   │   ├── ActivityFeed.tsx
    │   │   ├── ValidationFeed.tsx
    │   │   └── DefensibilityFeed.tsx             [NEW]
    │   │
    │   ├── drawers/
    │   │   ├── AssumptionEditDrawer.tsx
    │   │   ├── EvidenceViewerDrawer.tsx
    │   │   ├── ScenarioBuilderDrawer.tsx
    │   │   ├── ApprovalDrawer.tsx
    │   │   └── DiffReviewDrawer.tsx
    │   │
    │   └── modals/
    │       ├── CreateNodeModal.tsx
    │       ├── LinkEvidenceModal.tsx
    │       ├── RedTeamReviewModal.tsx
    │       ├── LockVersionModal.tsx
    │       └── ExportArtifactModal.tsx
    │
    ├── store/
    │   ├── workspace-store.ts
    │   ├── draft-store.ts
    │   ├── workflow-store.ts                     [NEW]
    │   └── defensibility-store.ts                [NEW]
    │
    ├── schemas/
    │   ├── graph.schema.ts
    │   ├── sdui.schema.ts
    │   ├── workflow.schema.ts                    [NEW]
    │   └── defensibility.schema.ts               [NEW]
    │
    ├── hooks/
    │   ├── useGraphData.ts
    │   ├── useScenarioState.ts
    │   ├── useNodeSelection.ts
    │   ├── useGraphMutations.ts
    │   ├── useApprovalFlow.ts
    │   ├── useWorkflowState.ts                   [NEW]
    │   ├── useDefensibility.ts                     [NEW]
    │   └── useStateGating.ts                       [NEW]
    │
    ├── types/
    │   ├── graph.types.ts
    │   ├── ui.types.ts
    │   ├── workflow.types.ts                     [NEW]
    │   └── defensibility.types.ts                  [NEW]
    │
    ├── utils/
    │   ├── graph-layout.ts
    │   ├── confidence-format.ts
    │   ├── formula-render.ts
    │   ├── defensibility-calc.ts                 [NEW]
    │   └── state-gating.ts                         [NEW]
    │
    └── index.ts
```

---

## Route Files

### `app/(routes)/living-value-graph/page.tsx`

**Purpose**: Main page composition, orchestrates all feature components.

```typescript
"use client";

import { AppShell } from "@/features/living-value-graph/components/shell/AppShell";
import { useWorkspaceStore } from "@/features/living-value-graph/store/workspace-store";
import { useWorkflowStore } from "@/features/living-value-graph/store/workflow-store";

export default function LivingValueGraphPage() {
  const { initialize } = useWorkspaceStore();
  const { initializeWorkflow } = useWorkflowStore();

  useEffect(() => {
    initialize();
    initializeWorkflow();
  }, []);

  return (
    <AppShell>
      {/* Content injected via AppShell's internal composition */}
    </AppShell>
  );
}
```

**Size**: ~30 lines

---

### `app/(routes)/living-value-graph/layout.tsx`

**Purpose**: Route-level layout with providers.

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { WorkspaceStoreProvider } from "@/features/living-value-graph/store/workspace-store";
import { WorkflowStoreProvider } from "@/features/living-value-graph/store/workflow-store";

export default function LivingValueGraphLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceStoreProvider>
        <WorkflowStoreProvider>
          {children}
        </WorkflowStoreProvider>
      </WorkspaceStoreProvider>
    </QueryClientProvider>
  );
}
```

**Size**: ~25 lines

---

### `app/api/sdui/route.ts`

**Purpose**: SDUI payload endpoint.

```typescript
import { NextResponse } from "next/server";
import { SDUILayout } from "@/features/living-value-graph/schemas/sdui.schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "living_value_graph";
  const workflowState = searchParams.get("workflow_state") || "DRAFTING";

  const layout: SDUILayout = {
    page,
    workflow_state: workflowState,
    defensibility_score: 0.87,
    layout: {
      header: [
        { type: "stat_card", props: { metric: "npv" } },
        { type: "stat_card", props: { metric: "roi" } },
        { type: "stat_card", props: { metric: "payback" } },
        { type: "defensibility_panel", props: { show_progress: true } },
      ],
      left_rail: [
        { type: "workflow_stepper", props: { current_step: "evidence" } },
        { type: "graph_outline" },
        { type: "scenario_library" },
      ],
      right_inspector: [
        { type: "node_summary" },
        { type: "formula_panel" },
        { type: "evidence_list" },
        { type: "confidence_panel" },
        { type: "defensibility_panel" },
      ],
    },
    gating_rules: {
      allow_mutation: workflowState === "DRAFTING" || workflowState === "REFINING",
      allow_approval: workflowState === "VALIDATING" || workflowState === "REFINING",
      require_evidence: workflowState !== "INITIATED",
    },
  };

  return NextResponse.json(layout);
}
```

**Size**: ~50 lines

---

## Shell Components

### `features/living-value-graph/components/shell/AppShell.tsx`

**Props Interface**:
```typescript
interface AppShellProps {
  children?: React.ReactNode;
}
```

**Responsibilities**:
- Compose TopNav, WorkspaceHeader, MainWorkspace, BottomTray
- Handle responsive layout (desktop/tablet breakpoints)
- Provide error boundaries for each section

**Zustand Dependencies**:
- `useWorkspaceStore` for layout preferences
- `useWorkflowStore` for current phase (for theming)

**Size**: ~80 lines

---

### `features/living-value-graph/components/shell/TopNav.tsx`

**Props Interface**:
```typescript
interface TopNavProps {
  opportunityId: string;
  scenarioId: string;
  workflowState: WorkflowState;
  onScenarioChange: (id: string) => void;
}
```

**Components Rendered**:
- BrandMark
- OpportunitySwitcher
- ScenarioSelector
- WorkflowStepRail (NEW)
- StateBadge
- SaveStatus
- ApprovalActions (state-gated)
- UserMenu

**Zustand Dependencies**:
- `useWorkspaceStore` for opportunity/scenario selection
- `useWorkflowStore` for workflow state
- `useStateGating` for action visibility

**Size**: ~100 lines

---

### `features/living-value-graph/components/shell/WorkspaceHeader.tsx`

**Props Interface**:
```typescript
interface WorkspaceHeaderProps {
  opportunity: OpportunitySummary;
  globalMetrics: GlobalMetrics;
  defensibilityScore: number;
  workflowState: WorkflowState;
}
```

**Components Rendered**:
- OpportunitySummaryCard
- HeadlineValueCard
- ROIStatCard
- PaybackStatCard
- ConfidenceStatCard
- DefensibilityScoreCard (NEW)
- ViewModeTabs

**Zustand Dependencies**:
- `useWorkspaceStore` for view mode
- `useDefensibilityStore` for defensibility score

**Size**: ~90 lines

---

### `features/living-value-graph/components/shell/MainWorkspace.tsx`

**Props Interface**:
```typescript
interface MainWorkspaceProps {
  sduiLayout: SDUILayout;
}
```

**Responsibilities**:
- 3-column layout: LeftRail, CenterCanvas, RightInspector
- Handle resizable panels
- Sync selection state between canvas and inspector

**Size**: ~70 lines

---

### `features/living-value-graph/components/shell/LeftRail.tsx`

**Props Interface**:
```typescript
interface LeftRailProps {
  activeTab: LeftRailTab;
  workflowSteps: WorkflowStepState[];
  scenarios: Scenario[];
  savedViews: SavedView[];
  artifacts: Artifact[];
}
```

**Components Rendered**:
- WorkflowStepPanel (NEW)
- GraphOutlinePanel
- ScenarioLibraryPanel
- SavedViewsPanel
- ArtifactsPanel

**Size**: ~80 lines

---

### `features/living-value-graph/components/shell/CenterCanvas.tsx`

**Props Interface**:
```typescript
interface CenterCanvasProps {
  activeView: CanvasView;
  graph: Graph;
  selectedNodeId: string | null;
  workflowState: WorkflowState;
  onNodeSelect: (id: string) => void;
}
```

**Components Rendered**:
- GraphToolbar
- CanvasRouter (switches between views)
- InlineMutationBar (state-gated)

**Size**: ~60 lines

---

### `features/living-value-graph/components/shell/RightInspector.tsx`

**Props Interface**:
```typescript
interface RightInspectorProps {
  selectedNode: ValueNode | null;
  workflowState: WorkflowState;
  canEdit: boolean;
}
```

**Components Rendered**:
- InspectorHeader
- NodeSummaryCard
- FormulaPanel
- InputsPanel
- EvidencePanel
- ConfidencePanel
- DefensibilityPanel (NEW)
- ObjectionsPanel
- RevisionHistoryPanel
- NodeActionsPanel (state-gated)

**Size**: ~100 lines

---

### `features/living-value-graph/components/shell/BottomTray.tsx`

**Props Interface**:
```typescript
interface BottomTrayProps {
  activeTab: BottomTrayTab;
  workflowTimeline: WorkflowPhase[];
  activities: Activity[];
  validations: Validation[];
}
```

**Components Rendered**:
- WorkflowTimeline (NEW)
- AgentConsole
- ActivityFeed
- ValidationFeed
- DefensibilityFeed (NEW)

**Size**: ~80 lines

---

## Header Components

### `features/living-value-graph/components/header/DefensibilityScoreCard.tsx` [NEW]

**Props Interface**:
```typescript
interface DefensibilityScoreCardProps {
  score: number;              // 0-1 percentage
  breakdown: {
    backedByEvidence: number;  // $ value
    totalValue: number;        // $ total
    coveragePercent: number;     // 0-100
  };
  threshold: number;          // default 0.70
  isBlocking: boolean;        // score < threshold
}
```

**Visual**:
- Circular progress ring (green ≥ 90%, amber 70-89%, red < 70%)
- Main score as large number
- "X% of $YM backed by evidence" subtitle
- Warning icon if blocking

**Formula**: `score = Σ(node_value × evidence_coverage) / total_value`

**Size**: ~70 lines

---

### `features/living-value-graph/components/header/HeadlineValueCard.tsx`

**Props Interface**:
```typescript
interface HeadlineValueCardProps {
  npv: number;
  annualValue: number;
  scenarioLabel: string;
  lastRecalculated: string;
  currency: string;
}
```

**Size**: ~50 lines

---

### `features/living-value-graph/components/header/StateBadge.tsx`

**Props Interface**:
```typescript
interface StateBadgeProps {
  state: WorkflowState;
  phaseProgress: number;      // 0-6 (which phase we're in)
}
```

**Visual**:
- Badge with phase name
- Color coding per phase
- Optional progress indicator

**States**:
- INITIATED: gray
- DRAFTING: blue
- VALIDATING: amber
- COMPOSING: purple
- REFINING: orange
- FINALIZED: green (locked icon)

**Size**: ~60 lines

---

## LeftRail Components

### `features/living-value-graph/components/left-rail/WorkflowStepPanel.tsx` [NEW]

**Props Interface**:
```typescript
interface WorkflowStepPanelProps {
  steps: WorkflowStepState[];
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
}

interface WorkflowStepState {
  step: WorkflowStep;
  status: "not_started" | "active" | "complete" | "blocked";
  owner?: string;
  blockingReason?: string;
  artifacts?: string[];
}

type WorkflowStep = 
  | "hypothesis" 
  | "model" 
  | "evidence" 
  | "narrative" 
  | "objection" 
  | "revision" 
  | "approval";
```

**Visual**: Vertical stepper
```
[✓] 1. Hypothesis      [Complete]
[→] 2. Model           [Active]
[○] 3. Evidence        [Blocked - needs 2 more sources]
[○] 4. Narrative       [Blocked]
```

**Interactions**:
- Click active step: Show blocking issues
- Click complete step: View artifacts
- Hover: Show tooltip with owner/timestamp

**Size**: ~100 lines

---

### `features/living-value-graph/components/left-rail/ArtifactsPanel.tsx`

**Props Interface**:
```typescript
interface ArtifactsPanelProps {
  artifacts: Artifact[];
  graphVersionId: string;
  lastNarrativeGeneration: string | null;
  isStale: boolean;
  onRegenerate: () => void;
}

interface Artifact {
  id: string;
  type: "executive_summary" | "deck" | "business_case" | "approval_packet";
  name: string;
  generatedAt: string;
  derivedFrom: string;      // graph version id
  downloadUrl: string;
}
```

**Enhanced Features**:
- Stale indicator (warning if graph changed)
- "Regenerate" button when stale
- Read-only badge (cannot edit directly)
- Download actions

**Size**: ~80 lines

---

## CenterCanvas Components

### `features/living-value-graph/components/canvas/InlineMutationBar.tsx`

**Props Interface**:
```typescript
interface InlineMutationBarProps {
  selectedNode: ValueNode;
  workflowState: WorkflowState;
  gatingRules: GatingRules;
  onEdit: () => void;
  onScenario: () => void;
  onAskAgent: () => void;
  onLinkEvidence: () => void;
  onRedTeam: () => void;
  onRequestApproval: () => void;
}

interface GatingRules {
  allowEdit: boolean;
  allowRedTeam: boolean;
  allowApproval: boolean;
  reason?: string;
}
```

**State Gating Matrix**:
```typescript
const GATING_MATRIX: Record<WorkflowState, GatingRules> = {
  INITIATED:    { allowEdit: true, allowRedTeam: false, allowApproval: false },
  DRAFTING:     { allowEdit: true, allowRedTeam: true, allowApproval: false },
  VALIDATING:   { allowEdit: true, allowRedTeam: true, allowApproval: true },
  COMPOSING:    { allowEdit: false, allowRedTeam: false, allowApproval: true },
  REFINING:     { allowEdit: true, allowRedTeam: true, allowApproval: true },
  FINALIZED:    { allowEdit: false, allowRedTeam: false, allowApproval: false },
};
```

**Visual**: Button group with disabled states
- Disabled buttons show lock icon
- Tooltip: "Available in [STATE] phase"

**Size**: ~90 lines

---

## RightInspector Components

### `features/living-value-graph/components/inspector/DefensibilityPanel.tsx` [NEW]

**Props Interface**:
```typescript
interface DefensibilityPanelProps {
  nodeId: string;
  evidenceCoverage: number;       // 0-1
  sourceIndependence: number;     // count of distinct sources
  auditTrailComplete: boolean;
  valueContribution: number;      // $ value
  threshold: number;              // 0.8 default
  warnings: DefensibilityWarning[];
}

interface DefensibilityWarning {
  type: "low_coverage" | "single_source" | "stale_evidence" | "missing_attribution";
  severity: "warning" | "critical";
  message: string;
  remediation?: string;
}
```

**Visual**:
- Progress bar for evidence coverage
- Source count with independence indicator
- Red/yellow warning cards for issues
- "Request evidence" quick action

**Size**: ~80 lines

---

## BottomTray Components

### `features/living-value-graph/components/bottom-tray/WorkflowTimeline.tsx` [NEW]

**Props Interface**:
```typescript
interface WorkflowTimelineProps {
  phases: WorkflowPhase[];
  currentPhase: WorkflowState;
  transitions: PhaseTransition[];
}

interface WorkflowPhase {
  state: WorkflowState;
  enteredAt: string;
  actor: string;
  actions: string[];
  blockingIssues?: ValidationIssue[];
}

interface PhaseTransition {
  from: WorkflowState;
  to: WorkflowState;
  triggeredAt: string;
  reason: string;
}
```

**Visual**: Horizontal timeline
```
[INITIATED] ──→ [DRAFTING] ──→ [VALIDATING] ──→ [COMPOSING]
   Jan 15         Jan 16          Jan 17           [pending]
   System         System          Alice Chen
```

**Interactions**:
- Click phase: Expand details panel
- Hover transition: Show trigger reason
- Red indicator: Show blocking issues

**Size**: ~90 lines

---

### `features/living-value-graph/components/bottom-tray/DefensibilityFeed.tsx` [NEW]

**Props Interface**:
```typescript
interface DefensibilityFeedProps {
  issues: DefensibilityIssue[];
  quickActions: QuickAction[];
}

interface DefensibilityIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  type: "evidence_gap" | "stale_citation" | "low_confidence";
  severity: "warning" | "critical";
  valueAtRisk: number;
  suggestedAction: string;
}
```

**Visual**: List of issues with:
- Node name (clickable to select)
- Severity badge
- Value at risk
- Quick fix button

**Size**: ~70 lines

---

## State Management (Zustand)

### `features/living-value-graph/store/workflow-store.ts` [NEW]

**Purpose**: Manage 7-step workflow and 6-state orchestration.

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkflowState {
  // Current orchestration phase
  phase: "INITIATED" | "DRAFTING" | "VALIDATING" | "COMPOSING" | "REFINING" | "FINALIZED";
  
  // 7-step loop progress
  steps: WorkflowStepState[];
  currentStep: WorkflowStep;
  
  // Actions
  initializeWorkflow: () => void;
  advancePhase: (to: WorkflowState, reason: string) => void;
  completeStep: (step: WorkflowStep) => void;
  blockStep: (step: WorkflowStep, reason: string) => void;
  getGatingRules: () => GatingRules;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      phase: "INITIATED",
      steps: INITIAL_WORKFLOW_STEPS,
      currentStep: "hypothesis",
      
      initializeWorkflow: () => {
        set({ phase: "INITIATED", steps: INITIAL_WORKFLOW_STEPS, currentStep: "hypothesis" });
      },
      
      advancePhase: (to, reason) => {
        const current = get().phase;
        if (isValidTransition(current, to)) {
          set({ phase: to });
          logTransition(current, to, reason);
        }
      },
      
      completeStep: (step) => {
        const steps = get().steps.map(s =>
          s.step === step ? { ...s, status: "complete" as const } : s
        );
        const nextStep = steps.find(s => s.status === "not_started");
        set({ steps, currentStep: nextStep?.step || get().currentStep });
      },
      
      blockStep: (step, reason) => {
        const steps = get().steps.map(s =>
          s.step === step ? { ...s, status: "blocked" as const, blockingReason: reason } : s
        );
        set({ steps });
      },
      
      getGatingRules: () => {
        return GATING_MATRIX[get().phase];
      },
    }),
    { name: "workflow-store" }
  )
);
```

**Size**: ~120 lines

---

### `features/living-value-graph/store/defensibility-store.ts` [NEW]

**Purpose**: Calculate and track defensibility metrics.

```typescript
interface DefensibilityState {
  globalScore: number;
  coverageByNode: Record<string, number>;
  totalBackedValue: number;
  totalValue: number;
  
  calculateScore: (graph: Graph) => void;
  getNodeCoverage: (nodeId: string) => number;
  isAboveThreshold: (threshold?: number) => boolean;
}

export const useDefensibilityStore = create<DefensibilityState>()((set, get) => ({
  globalScore: 0,
  coverageByNode: {},
  totalBackedValue: 0,
  totalValue: 0,
  
  calculateScore: (graph) => {
    let totalValue = 0;
    let backedValue = 0;
    const coverageByNode: Record<string, number> = {};
    
    for (const node of Object.values(graph.nodes)) {
      const nodeValue = node.value || 0;
      const coverage = calculateNodeEvidenceCoverage(node);
      
      totalValue += nodeValue;
      backedValue += nodeValue * coverage;
      coverageByNode[node.id] = coverage;
    }
    
    const globalScore = totalValue > 0 ? backedValue / totalValue : 0;
    
    set({
      globalScore,
      coverageByNode,
      totalBackedValue: backedValue,
      totalValue,
    });
  },
  
  getNodeCoverage: (nodeId) => get().coverageByNode[nodeId] || 0,
  
  isAboveThreshold: (threshold = 0.7) => get().globalScore >= threshold,
}));

// Helper function
function calculateNodeEvidenceCoverage(node: ValueNode): number {
  if (!node.evidence || node.evidence.length === 0) return 0;
  
  const totalEvidence = node.evidence.length;
  const highConfidenceEvidence = node.evidence.filter(e => e.confidence >= 0.8).length;
  
  return Math.min(1, highConfidenceEvidence / Math.max(1, totalEvidence * 0.5));
}
```

**Size**: ~90 lines

---

### `features/living-value-graph/store/workspace-store.ts`

**Enhancement**: Add workflow-aware selection.

```typescript
interface WorkspaceState {
  // Existing
  selectedNodeId: string | null;
  activeView: CanvasView;
  leftRailTab: LeftRailTab;
  bottomTrayTab: BottomTrayTab;
  canvas: CanvasState;
  
  // NEW: Workflow-aware UI state
  workflowStep: WorkflowStep;
  filters: {
    showDefensibilityIssues: boolean;
    minEvidenceCoverage: number | null;
  };
}
```

---

## SDUI Schemas

### `features/living-value-graph/schemas/workflow.schema.ts` [NEW]

```typescript
import { z } from "zod";

export const WorkflowStateSchema = z.enum([
  "INITIATED",
  "DRAFTING",
  "VALIDATING",
  "COMPOSING",
  "REFINING",
  "FINALIZED",
]);

export const WorkflowStepSchema = z.enum([
  "hypothesis",
  "model",
  "evidence",
  "narrative",
  "objection",
  "revision",
  "approval",
]);

export const WorkflowStepStateSchema = z.object({
  step: WorkflowStepSchema,
  status: z.enum(["not_started", "active", "complete", "blocked"]),
  owner: z.string().optional(),
  blockingReason: z.string().optional(),
  artifacts: z.array(z.string()).optional(),
});

export const GatingRulesSchema = z.object({
  allowEdit: z.boolean(),
  allowRedTeam: z.boolean(),
  allowApproval: z.boolean(),
  reason: z.string().optional(),
});

export const SDUIGatingRulesSchema = z.object({
  allow_mutation: z.boolean(),
  allow_approval: z.boolean(),
  require_evidence: z.boolean(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowStepState = z.infer<typeof WorkflowStepStateSchema>;
export type GatingRules = z.infer<typeof GatingRulesSchema>;
export type SDUIGatingRules = z.infer<typeof SDUIGatingRulesSchema>;
```

**Size**: ~50 lines

---

### `features/living-value-graph/schemas/defensibility.schema.ts` [NEW]

```typescript
import { z } from "zod";

export const DefensibilityScoreSchema = z.object({
  global: z.number().min(0).max(1),
  breakdown: z.object({
    backedByEvidence: z.number(),
    totalValue: z.number(),
    coveragePercent: z.number(),
  }),
  threshold: z.number().default(0.7),
  isBlocking: z.boolean(),
});

export const DefensibilityIssueSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  type: z.enum(["evidence_gap", "stale_citation", "low_confidence"]),
  severity: z.enum(["warning", "critical"]),
  valueAtRisk: z.number(),
  suggestedAction: z.string(),
});

export const DefensibilityPanelSchema = z.object({
  nodeId: z.string(),
  evidenceCoverage: z.number(),
  sourceIndependence: z.number(),
  auditTrailComplete: z.boolean(),
  valueContribution: z.number(),
  threshold: z.number().default(0.8),
  warnings: z.array(z.object({
    type: z.enum(["low_coverage", "single_source", "stale_evidence", "missing_attribution"]),
    severity: z.enum(["warning", "critical"]),
    message: z.string(),
    remediation: z.string().optional(),
  })),
});

export type DefensibilityScore = z.infer<typeof DefensibilityScoreSchema>;
export type DefensibilityIssue = z.infer<typeof DefensibilityIssueSchema>;
export type DefensibilityPanel = z.infer<typeof DefensibilityPanelSchema>;
```

**Size**: ~60 lines

---

### `features/living-value-graph/schemas/sdui.schema.ts`

**Enhancement**: Add workflow components.

```typescript
export const SDUIComponentSchema = z.enum([
  "stat_card",
  "defensibility_panel",      // [NEW]
  "workflow_stepper",         // [NEW]
  "node_summary",
  "formula_panel",
  "evidence_list",
  "confidence_panel",
  "objections_panel",
  "scenario_table",
  "timeline_chart",
  "activity_feed",
  "agent_console",
  "graph_outline",
  "scenario_library",
]);

export const SDUILayoutSchema = z.object({
  page: z.string(),
  workflow_state: WorkflowStateSchema,
  defensibility_score: z.number().min(0).max(1),
  layout: z.object({
    header: z.array(z.object({
      type: SDUIComponentSchema,
      props: z.record(z.unknown()).optional(),
    })),
    left_rail: z.array(z.object({
      type: SDUIComponentSchema,
      props: z.record(z.unknown()).optional(),
    })),
    right_inspector: z.array(z.object({
      type: SDUIComponentSchema,
      props: z.record(z.unknown()).optional(),
    })),
  }),
  gating_rules: SDUIGatingRulesSchema,
});

export type SDUIComponent = z.infer<typeof SDUIComponentSchema>;
export type SDUILayout = z.infer<typeof SDUILayoutSchema>;
```

**Size**: ~50 lines

---

## Hooks

### `features/living-value-graph/hooks/useWorkflowState.ts` [NEW]

```typescript
import { useWorkflowStore } from "../store/workflow-store";

export function useWorkflowState() {
  const { phase, steps, currentStep, advancePhase, completeStep } = useWorkflowStore();
  
  return {
    phase,
    steps,
    currentStep,
    isStepComplete: (step: WorkflowStep) => 
      steps.find(s => s.step === step)?.status === "complete",
    isStepBlocked: (step: WorkflowStep) => 
      steps.find(s => s.step === step)?.status === "blocked",
    canAdvanceTo: (nextPhase: WorkflowState) => {
      // Validation logic
      return true; // Simplified
    },
    advancePhase,
    completeStep,
  };
}
```

**Size**: ~40 lines

---

### `features/living-value-graph/hooks/useDefensibility.ts` [NEW]

```typescript
import { useDefensibilityStore } from "../store/defensibility-store";
import { useGraphData } from "./useGraphData";

export function useDefensibility() {
  const graph = useGraphData();
  const { 
    globalScore, 
    calculateScore, 
    getNodeCoverage, 
    isAboveThreshold 
  } = useDefensibilityStore();
  
  // Recalculate when graph changes
  useEffect(() => {
    calculateScore(graph);
  }, [graph, calculateScore]);
  
  return {
    globalScore,
    getNodeCoverage,
    isAboveThreshold,
    isBlocking: !isAboveThreshold(0.7),
  };
}
```

**Size**: ~35 lines

---

### `features/living-value-graph/hooks/useStateGating.ts` [NEW]

```typescript
import { useWorkflowStore } from "../store/workflow-store";

export function useStateGating() {
  const { phase, getGatingRules } = useWorkflowStore();
  const rules = getGatingRules();
  
  return {
    phase,
    rules,
    canEdit: rules.allowEdit,
    canRedTeam: rules.allowRedTeam,
    canApprove: rules.allowApproval,
    whyDisabled: rules.reason,
  };
}
```

**Size**: ~25 lines

---

## Utilities

### `features/living-value-graph/utils/defensibility-calc.ts` [NEW]

```typescript
import { ValueNode, Evidence } from "../types/graph.types";

export function calculateDefensibilityScore(
  nodes: ValueNode[]
): number {
  let totalValue = 0;
  let backedValue = 0;
  
  for (const node of nodes) {
    const nodeValue = node.value || 0;
    const coverage = calculateNodeCoverage(node);
    
    totalValue += nodeValue;
    backedValue += nodeValue * coverage;
  }
  
  return totalValue > 0 ? backedValue / totalValue : 0;
}

export function calculateNodeCoverage(node: ValueNode): number {
  if (!node.evidence || node.evidence.length === 0) {
    return 0;
  }
  
  const evidence = node.evidence;
  const totalWeight = evidence.reduce((sum, e) => sum + (e.weight || 1), 0);
  const validWeight = evidence
    .filter(e => isEvidenceValid(e))
    .reduce((sum, e) => sum + (e.weight || 1), 0);
  
  return totalWeight > 0 ? validWeight / totalWeight : 0;
}

function isEvidenceValid(evidence: Evidence): boolean {
  return (
    evidence.confidence >= 0.7 &&
    !evidence.isStale &&
    evidence.hasAttribution
  );
}
```

**Size**: ~50 lines

---

### `features/living-value-graph/utils/state-gating.ts` [NEW]

```typescript
import { WorkflowState, GatingRules } from "../schemas/workflow.schema";

export const GATING_MATRIX: Record<WorkflowState, GatingRules> = {
  INITIATED: {
    allowEdit: true,
    allowRedTeam: false,
    allowApproval: false,
    reason: "Complete hypothesis generation first",
  },
  DRAFTING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: false,
    reason: "Validate model before approval",
  },
  VALIDATING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: true,
  },
  COMPOSING: {
    allowEdit: false,
    allowRedTeam: false,
    allowApproval: true,
    reason: "Narrative generation in progress",
  },
  REFINING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: true,
  },
  FINALIZED: {
    allowEdit: false,
    allowRedTeam: false,
    allowApproval: false,
    reason: "Version is locked. Request override to edit.",
  },
};

export function getGatingRules(phase: WorkflowState): GatingRules {
  return GATING_MATRIX[phase];
}

export function canEdit(phase: WorkflowState): boolean {
  return GATING_MATRIX[phase].allowEdit;
}

export function canApprove(phase: WorkflowState): boolean {
  return GATING_MATRIX[phase].allowApproval;
}
```

**Size**: ~60 lines

---

## Types

### `features/living-value-graph/types/workflow.types.ts` [NEW]

```typescript
export type WorkflowState =
  | "INITIATED"
  | "DRAFTING"
  | "VALIDATING"
  | "COMPOSING"
  | "REFINING"
  | "FINALIZED";

export type WorkflowStep =
  | "hypothesis"
  | "model"
  | "evidence"
  | "narrative"
  | "objection"
  | "revision"
  | "approval";

export interface WorkflowStepState {
  step: WorkflowStep;
  status: "not_started" | "active" | "complete" | "blocked";
  owner?: string;
  blockingReason?: string;
  artifacts?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface GatingRules {
  allowEdit: boolean;
  allowRedTeam: boolean;
  allowApproval: boolean;
  reason?: string;
}

export interface ValidationIssue {
  type: "evidence_gap" | "formula_error" | "low_confidence" | "deficiency";
  severity: "warning" | "blocking";
  nodeId?: string;
  description: string;
  remediation?: string;
}
```

**Size**: ~50 lines

---

### `features/living-value-graph/types/defensibility.types.ts` [NEW]

```typescript
export interface DefensibilityScore {
  global: number;
  breakdown: {
    backedByEvidence: number;
    totalValue: number;
    coveragePercent: number;
  };
  threshold: number;
  isBlocking: boolean;
}

export interface DefensibilityIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  type: "evidence_gap" | "stale_citation" | "low_confidence";
  severity: "warning" | "critical";
  valueAtRisk: number;
  suggestedAction: string;
}

export interface DefensibilityWarning {
  type: "low_coverage" | "single_source" | "stale_evidence" | "missing_attribution";
  severity: "warning" | "critical";
  message: string;
  remediation?: string;
}

export interface NodeDefensibility {
  nodeId: string;
  evidenceCoverage: number;
  sourceIndependence: number;
  auditTrailComplete: boolean;
  valueContribution: number;
  warnings: DefensibilityWarning[];
}
```

**Size**: ~50 lines

---

## Implementation Priority

### Phase 1: Core Workflow (Week 1-2)

**Must implement**:
1. `workflow-store.ts` - Core workflow state
2. `WorkflowStepPanel.tsx` - 7-step visual indicator
3. `useStateGating.ts` - State-based action visibility
4. `InlineMutationBar.tsx` - Gated mutation controls
5. `StateBadge.tsx` - Current phase indicator

**Integration**: Wire into existing AppShell

---

### Phase 2: Defensibility (Week 2-3)

**Must implement**:
1. `defensibility-store.ts` - Score calculation
2. `DefensibilityScoreCard.tsx` - Header score display
3. `DefensibilityPanel.tsx` - Inspector panel
4. `defensibility-calc.ts` - Calculation utilities
5. `ApprovalDrawer.tsx` - Gated approval flow

**Integration**: Block approval if score < 70%

---

### Phase 3: Orchestration Visualization (Week 3-4)

**Must implement**:
1. `WorkflowTimeline.tsx` - Phase history
2. `ArtifactsPanel.tsx` - Derived narrative view
3. `DefensibilityFeed.tsx` - Issues list
4. `workflow.schema.ts` - Type safety
5. Enhanced `sdui.schema.ts` - Workflow-aware payloads

**Integration**: Full 6-state machine visible in UI

---

### Phase 4: Polish (Week 4)

**Implement**:
- Visual polish for stepper/timeline
- Animation for phase transitions
- Tooltips explaining gating
- Override flow with audit logging

---

## Summary

| Category | Files | New | Modified | Total Lines |
|----------|-------|-----|----------|-------------|
| Routes | 3 | 0 | 1 (sdui) | ~100 |
| Shell | 7 | 0 | 0 | ~500 |
| Header | 7 | 2 (Defensibility, enhanced StateBadge) | 1 | ~400 |
| LeftRail | 5 | 2 (WorkflowStepPanel, enhanced ArtifactsPanel) | 0 | ~350 |
| Canvas | 7 | 1 (enhanced InlineMutationBar) | 0 | ~450 |
| Inspector | 9 | 2 (DefensibilityPanel, enhanced EvidencePanel) | 0 | ~550 |
| BottomTray | 5 | 3 (WorkflowTimeline, DefensibilityFeed, enhanced) | 0 | ~350 |
| Store | 4 | 2 (workflow-store, defensibility-store) | 1 | ~400 |
| Schemas | 4 | 2 (workflow, defensibility) | 1 | ~200 |
| Hooks | 7 | 3 (useWorkflowState, useDefensibility, useStateGating) | 0 | ~150 |
| Utils | 5 | 2 (defensibility-calc, state-gating) | 0 | ~150 |
| Types | 4 | 2 (workflow, defensibility) | 0 | ~100 |
| **Total** | **67** | **20** | **5** | **~3,100** |

---

## Appendix: Quick Reference

### State Gating Quick Reference

```typescript
// Always check before enabling actions
const { canEdit, canApprove, whyDisabled } = useStateGating();

<button disabled={!canEdit} title={whyDisabled}>
  Edit
</button>
```

### Defensibility Calculation Quick Reference

```typescript
// Global score
const { globalScore, isAboveThreshold } = useDefensibility();

// Per-node coverage
const coverage = useDefensibilityStore().getNodeCoverage(nodeId);
```

### Workflow Progress Quick Reference

```typescript
const { phase, steps, isStepComplete } = useWorkflowState();

// Check if ready for approval
const readyForApproval = 
  phase === "REFINING" && 
  isStepComplete("objection") &&
  isAboveThreshold(0.7);
```
