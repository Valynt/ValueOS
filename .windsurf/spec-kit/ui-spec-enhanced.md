# ValueOS Living Value Graph
## Production UI Specification v1.0

> **System Contract Reference**: This UI specification is the frontend realization of the [ValueOS Architectural Design Brief](#valueos-architectural-design-brief). It implements the Hypothesis-First workflow as an interactive, auditable interface where every UI element maps to an architectural guarantee.

---

## 0. Architectural Binding Statement

The Living Value Graph is the primary user-facing implementation of the ValueOS architectural brief. It serves as the presentation-layer realization of the **Hypothesis-First, 7-Step Closed-Loop Economic Reasoning Process**.

### Workflow Phase to UI Surface Mapping

| Architectural Phase | System Meaning | UI Realization |
|---------------------|----------------|----------------|
| **1. Hypothesis** | Generate quantifiable thesis | Graph seed node, Hypothesis builder, Agent console prompt |
| **2. Model** | Build value tree and formulas | `ValueTreeCanvas`, `FormulaPanel`, `InputsPanel` |
| **3. Evidence** | Ground assumptions and claims | `EvidencePanel`, citation links, evidence gap warnings |
| **4. Narrative** | Turn model into executive story | `ArtifactsPanel` (derived, read-only), Executive summary views |
| **5. Objection** | Stress-test assumptions | `ObjectionsPanel`, `RedTeamReviewModal`, warning states |
| **6. Revision** | Adjust model and recalc | `InlineMutationBar`, `DiffReviewDrawer`, Scenario compare |
| **7. Approval** | Lock decision-grade version | `ApprovalDrawer`, `LockVersionModal`, `StateBadge` |

### State Machine Visualization

The 6-state orchestration flow (`INITIATED` → `DRAFTING` → `VALIDATING` → `COMPOSING` → `REFINING` → `FINALIZED`) appears in three UI surfaces:

1. **WorkspaceHeader** - Current lifecycle badge with color coding
2. **BottomTray.WorkflowTimeline** - Visual state machine with step completion indicators
3. **Component gating** - Actions enabled/disabled based on workflow state

---

## 1. Product Goal

The Living Value Graph UI is the interactive economic workspace where a strategist and buyer collaboratively construct, inspect, stress-test, and approve a value model.

The UI must support:

- **Deterministic financial modeling** - Formulas are visible, traceable, and non-editable without approval
- **Evidence-backed assumptions** - Every assumption shows its evidence lineage on demand
- **Live scenario mutation** - Fast modeling with clear diff previews before commit
- **Auditability and temporal versioning** - Full revision history, actor tracking, immutable locks
- **Executive-grade readability** - CFO can scan top layer; strategist can drill deep
- **SDUI-driven extensibility** - Server controls layout without frontend redeploy

---

## 2. UX Principles

### 2.1 Primary Principles

**Finance first**

The UI should read like a business case system, not a chat app.

**Explain before persuade**

Every displayed number must be expandable into:
- Formula
- Assumptions
- Evidence
- Confidence
- Revision history

**One source of truth**

The graph is the source; all summaries, cards, charts, and **narratives are derived views** (read-only, regenerable from graph state).

**Fast mutation, safe approval**

Users should be able to model quickly, but locked states must require explicit approval workflows with validation gates.

**Executive-simple, analyst-deep**

Top layer must be scannable for a CFO. Lower layers must support strategist-level drilldown into formulas and evidence.

---

## 3. Layout Architecture

### 3.1 Primary Shell

```
AppShell
├── TopNav
├── WorkspaceHeader
├── MainWorkspace
│   ├── LeftRail
│   ├── CenterCanvas
│   └── RightInspector
└── BottomTray
```

### 3.2 Layout Behavior

**TopNav**

Global navigation, workspace selector, user, save state, approval state, scenario selector, **workflow step indicator**.

**WorkspaceHeader**

Opportunity identity, headline NPV/ROI/payback, confidence, **defensibility score**, current state badge with workflow progress.

**LeftRail**

Graph navigation, scenario list, saved views, artifact navigator, **workflow step rail**.

**CenterCanvas**

Primary interactive graph and alternate visualizations with **state-gated mutation controls**.

**RightInspector**

Selected node details with **evidence-backed confidence panel**, formula, assumptions, objections, audit history.

**BottomTray**

Conversational agent, activity log, validation messages, **workflow timeline with phase transitions**.

---

## 4. Component Tree

### 4.1 Root Structure

```
LivingValueGraphPage
├── AppShell
│   ├── TopNav
│   │   ├── BrandMark
│   │   ├── OpportunitySwitcher
│   │   ├── ScenarioSelector
│   │   ├── WorkflowStepRail          [NEW: 7-step loop indicator]
│   │   ├── StateBadge                [ENHANCED: with phase progress]
│   │   ├── SaveStatus
│   │   ├── ApprovalActions           [STATE-GATED: see §7.1]
│   │   └── UserMenu
│   │
│   ├── WorkspaceHeader
│   │   ├── OpportunitySummaryCard
│   │   ├── HeadlineValueCard
│   │   ├── ROIStatCard
│   │   ├── PaybackStatCard
│   │   ├── ConfidenceStatCard
│   │   ├── DefensibilityScoreCard   [NEW: CFO-defensibility metric]
│   │   └── ViewModeTabs
│   │
│   ├── MainWorkspace
│   │   ├── LeftRail
│   │   │   ├── WorkflowStepPanel      [NEW: 7-step progress]
│   │   │   ├── GraphOutlinePanel
│   │   │   ├── ScenarioLibraryPanel
│   │   │   ├── SavedViewsPanel
│   │   │   └── ArtifactsPanel         [ENHANCED: derived view only]
│   │   │
│   │   ├── CenterCanvas
│   │   │   ├── GraphToolbar
│   │   │   ├── CanvasRouter
│   │   │   │   ├── ValueTreeCanvas
│   │   │   │   ├── WaterfallCanvas
│   │   │   │   ├── ScenarioCompareCanvas
│   │   │   │   ├── SensitivityCanvas
│   │   │   │   └── TimelineCanvas
│   │   │   └── InlineMutationBar      [STATE-GATED: see §7.1]
│   │   │
│   │   └── RightInspector
│   │       ├── InspectorHeader
│   │       ├── NodeSummaryCard
│   │       ├── FormulaPanel
│   │       ├── InputsPanel
│   │       ├── EvidencePanel          [ENHANCED: source lineage]
│   │       ├── ConfidencePanel        [ENHANCED: factor breakdown]
│   │       ├── DefensibilityPanel     [NEW: evidence coverage %]
│   │       ├── ObjectionsPanel
│   │       ├── RevisionHistoryPanel
│   │       └── NodeActionsPanel       [STATE-GATED: see §7.1]
│   │
│   └── BottomTray
│       ├── WorkflowTimeline           [NEW: visual state machine]
│       ├── AgentConsole
│       ├── ActivityFeed
│       ├── ValidationFeed
│       └── DefensibilityFeed          [NEW: evidence gaps & warnings]
│
├── Drawers
│   ├── AssumptionEditDrawer
│   ├── EvidenceViewerDrawer
│   ├── ScenarioBuilderDrawer
│   ├── ApprovalDrawer                 [ENHANCED: with gating rules]
│   └── DiffReviewDrawer
│
└── Modals
    ├── CreateNodeModal
    ├── LinkEvidenceModal
    ├── RedTeamReviewModal
    ├── LockVersionModal               [ENHANCED: validation gates]
    └── ExportArtifactModal
```

---

## 5. Core UI Components (with Architectural Binding)

### 5.1 WorkspaceHeader Components

#### HeadlineValueCard

Displays:
- Total NPV
- Annual value
- Scenario label
- Last recalculated timestamp

**Architectural binding**: Shows `Model` phase output (NPV from Value Tree calculation).

#### ROIStatCard

Displays:
- ROI %
- 3-year net value
- Cost basis

#### PaybackStatCard

Displays:
- Payback period
- Time-to-first-value

#### ConfidenceStatCard

Displays:
- Global confidence score
- Warning state if low-confidence nodes exceed threshold

#### DefensibilityScoreCard [NEW]

**Purpose**: CFO-defensibility metric from architectural guarantee.

Displays:
- **% of value backed by cited evidence** (primary metric)
- % of model customer-validated
- Unresolved critical assumptions count
- Weighted confidence score

**Visual**: Progress ring with color coding:
- Green: ≥ 90% defensible
- Amber: 70-89%
- Red: < 70% (blocks approval)

**Formula**: `defensibility_score = Σ(node_value × evidence_coverage) / total_value`

---

### 5.2 LeftRail Components

#### WorkflowStepPanel [NEW]

**Purpose**: Visual indicator of 7-step Hypothesis-First loop progress.

**Layout**: Vertical stepper with 7 items:

```
[✓] 1. Hypothesis      [Complete]
[✓] 2. Model           [Complete]
[→] 3. Evidence        [Active - needs sources]
[○] 4. Narrative       [Blocked]
[○] 5. Objection       [Blocked]
[○] 6. Revision        [Blocked]
[○] 7. Approval        [Blocked]
```

**States**:
- `complete` (checkmark, green)
- `active` (arrow, blue)
- `blocked` (circle, gray)
- `error` (x, red) - for failed steps

**Click behavior**: Click active step to see blocking issues. Click complete step to view artifact.

**Architectural binding**: Mirrors the 7-step agentic workflow from the architectural brief.

#### GraphOutlinePanel

Tree list of all nodes with:
- Expand/collapse
- Search
- Node jump
- Status icons (confidence indicators)

#### ScenarioLibraryPanel

Shows scenarios:
- Baseline
- Conservative
- Expected
- Upside
- Custom

#### SavedViewsPanel

User-defined filtered views:
- CFO view
- Strategist view
- Risk view
- Evidence gaps

#### ArtifactsPanel [ENHANCED]

**Derived assets** (read-only, regenerable from graph):
- Executive summary
- Deck
- Business case PDF
- Approval packet

**Stale indicator**: Shows "regenerate" button if graph changed since last narrative generation.

**Architectural binding**: Narrative is **derived from** model, not independent source of truth.

---

### 5.3 CenterCanvas Components

#### GraphToolbar

Controls:
- Zoom in/out
- Fit to screen
- Expand all / collapse all
- Filter by node type
- Filter by confidence
- Show/hide evidence markers
- **Show locked nodes overlay**
- Switch visualization mode

#### ValueTreeCanvas

Main graph visualization with node rendering:
- Type icon
- Label
- Current value
- Delta vs baseline
- Confidence chip
- Evidence count
- **Lock badge** (if node locked)

Edges support:
- Directional flow
- Dependency relationship
- Hover for formula path
- Invalid styling when dependent data stale

#### InlineMutationBar [STATE-GATED]

Appears when node selected.

**Actions** (enabled/disabled based on workflow state):

| Action | INITIATED | DRAFTING | VALIDATING | COMPOSING | REFINING | FINALIZED |
|--------|-----------|----------|------------|-----------|----------|-----------|
| Edit assumption | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Run scenario | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Ask agent | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Link evidence | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Red-team this node | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Request approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |

**Visual**: Disabled actions show lock icon with tooltip: "Available in [STATE] phase".

#### CanvasRouter Views

- `ValueTreeCanvas` - Primary graph
- `WaterfallCanvas` - Roll-up visualization
- `ScenarioCompareCanvas` - Multi-column compare
- `SensitivityCanvas` - Tornado chart
- `TimelineCanvas` - Value realization phases

---

### 5.4 RightInspector Components

#### InspectorHeader

Shows:
- Node name
- Node type
- Lineage path
- Lock status
- **Workflow phase** that created/modified this node

#### NodeSummaryCard

Shows:
- Current value
- Contribution to total
- Scenario delta
- Owner
- Last changed by

#### FormulaPanel

Displays:
- Rendered formula
- Expanded calculation steps
- Formula dependencies
- Unit checks

**Read-only**: Formulas are deterministic outputs from Financial Model Agent.

#### InputsPanel

Table of inputs:
- Input name
- Value (editable if state allows)
- Units
- Source type
- Editable status
- Last changed

#### EvidencePanel [ENHANCED]

Evidence list with **source lineage**:
- Source title
- Source type (10-K, benchmark, CRM, ERP)
- Citation location (page/section)
- Freshness (date)
- Strength rating (high/medium/low)
- **Confidence contribution**
- Open source action

#### ConfidencePanel [ENHANCED]

Displays **factor breakdown**:
- Node confidence score
- Evidence sufficiency %
- Volatility factor
- Unresolved assumptions count
- Peer benchmark alignment

#### DefensibilityPanel [NEW]

Shows for selected node:
- Evidence coverage %
- Source independence (count of distinct sources)
- Freshness score
- Audit trail completeness

**Warning**: Red indicator if node lacks sufficient evidence for its value contribution.

#### ObjectionsPanel

Displays:
- Red-team objections
- Open challenge items
- Mitigation suggestions
- **Resolution workflow** (address / override / escalate)

#### RevisionHistoryPanel

Displays:
- Version diffs
- Changed fields
- Actor
- Timestamp
- Reason
- **Workflow phase** when change made

#### NodeActionsPanel [STATE-GATED]

Actions (enabled based on workflow state):
- Edit
- Duplicate into scenario
- Request evidence
- Request red team
- Lock
- Unlock with permission

---

### 5.5 BottomTray Components

#### WorkflowTimeline [NEW]

**Purpose**: Visual state machine showing orchestration phase history.

**Layout**: Horizontal timeline with phases:

```
[INITIATED] → [DRAFTING] → [VALIDATING] → [COMPOSING] → [REFINING] → [FINALIZED]
   Jan 15      Jan 16        Jan 17         Jan 18        Jan 20         [pending]
```

**Features**:
- Click phase to see actions taken
- Shows actor for each transition
- Displays blocking issues between phases
- Shows retry/compensation events (from Saga)

**Architectural binding**: Mirrors the 6-state orchestration state machine.

#### AgentConsole

Conversational surface for graph mutation and inspection.

Examples:
- "Reduce improvement from 15% to 10%"
- "Show conservative case"
- "Why is this node low confidence?"
- "What's blocking approval?"

#### ActivityFeed

Chronological system log:
- Recalculated
- Evidence attached
- Objection generated
- Node locked
- **Workflow phase transition**

#### ValidationFeed

Shows:
- Formula errors
- Missing evidence
- Stale citations
- Unit mismatch
- Low confidence warnings
- **Defensibility blockers** (for approval)

#### DefensibilityFeed [NEW]

Shows evidence gaps and remediation:
- "Top 5 nodes lacking evidence"
- "Stale citations needing refresh"
- "Confidence improvement opportunities"
- Quick actions: "Find evidence for selected node"

---

## 6. SDUI Model (Server-Driven UI)

The UI supports server-driven composition so the platform can change layouts, cards, workflows, or domain-pack overlays without redeploying the frontend.

### 6.1 SDUI Rendering Model

```typescript
type SDUIComponent =
  | "stat_card"
  | "node_summary"
  | "formula_panel"
  | "evidence_list"
  | "confidence_panel"
  | "defensibility_panel"      // [NEW]
  | "workflow_stepper"          // [NEW]
  | "scenario_table"
  | "timeline_chart"
  | "activity_feed"
  | "agent_console";
```

### 6.2 Example SDUI Payload

```json
{
  "page": "living_value_graph",
  "workflow_state": "VALIDATING",
  "defensibility_score": 0.87,
  "layout": {
    "header": [
      { "type": "stat_card", "props": { "metric": "npv" } },
      { "type": "stat_card", "props": { "metric": "roi" } },
      { "type": "stat_card", "props": { "metric": "payback" } },
      { "type": "defensibility_panel", "props": { "show_progress": true } }
    ],
    "left_rail": [
      { "type": "workflow_stepper", "props": { "current_step": "evidence" } },
      { "type": "graph_outline" },
      { "type": "scenario_library" }
    ],
    "right_inspector": [
      { "type": "node_summary" },
      { "type": "formula_panel" },
      { "type": "evidence_list" },
      { "type": "confidence_panel" },
      { "type": "defensibility_panel" }
    ]
  },
  "gating_rules": {
    "allow_mutation": true,
    "allow_approval": false,
    "require_evidence": true
  }
}
```

### 6.3 SDUI Rules

- Financial logic is **never** defined by SDUI
- SDUI controls layout, ordering, visibility, and presentation
- SDUI can inject **state-gating rules** (`allow_mutation`, `allow_approval`)
- Unsupported components fail closed
- All component payloads are schema-validated

---

## 7. Interaction Model (with State Gating)

### 7.1 Primary Interactions

#### Select Node

User clicks a node in graph or outline.

System:
1. Highlights node
2. Opens details in inspector
3. Scroll-syncs outline and canvas
4. Fetches latest node detail if stale
5. **Shows workflow phase that created the node**

#### Edit Input

User changes input value.

System:
1. Validates input type and units
2. Applies optimistic local update
3. Recomputes dependent graph
4. Updates rollups
5. Shows diff
6. Logs change with **current workflow phase**

**State gating**: Blocked in FINALIZED without override permission.

#### Ask Agent

User issues natural-language instruction.

System:
1. Parses intent
2. Proposes graph mutation
3. Shows preview
4. User accepts or rejects
5. Committed changes trigger recalculation
6. **Advances workflow step if applicable**

#### Link Evidence

User opens evidence drawer and attaches source.

System:
1. Binds citation to node/input
2. Recalculates confidence
3. Clears evidence-gap warnings if satisfied
4. **May unblock workflow step (Evidence → Narrative)**

#### Run Scenario

User duplicates baseline into scenario and mutates assumptions.

System:
1. Branches graph state
2. Preserves parent lineage
3. Computes scenario outputs in parallel
4. **Shows scenario in workflow stepper as variant**

#### Lock Version

User submits approval.

System:
1. **Checks validation gates** (see §8)
2. Requires permissions
3. Stores immutable snapshot
4. Issues locked version ID
5. **Transitions workflow to FINALIZED**

### 7.2 Interaction States

Each node can exist in UI states:

| State | Visual | Meaning |
|-------|--------|---------|
| `default` | Normal | Standard display |
| `hovered` | Light ring | Mouse over |
| `selected` | Strong border | Active inspection |
| `editing` | Input field | Value being changed |
| `recalculating` | Spinner | Graph recomputing |
| `invalid` | Red border | Formula/data error |
| `low_confidence` | Amber indicator | Below threshold |
| `locked` | Lock badge | Immutable in FINALIZED |
| `stale` | Dotted border | Evidence/narrative newer than calculation |
| `diffed` | Side-by-side | Scenario comparison active |

### 7.3 State Gating Matrix

| Component/Action | INITIATED | DRAFTING | VALIDATING | COMPOSING | REFINING | FINALIZED |
|------------------|-----------|----------|------------|-----------|----------|-----------|
| **WorkspaceHeader** |||||||
| Approve button | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| Defensibility score | Hidden | Visible | Visible | Visible | Visible | Visible |
| **LeftRail** |||||||
| ArtifactsPanel regenerate | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| **CenterCanvas** |||||||
| InlineMutationBar | Full | Full | Limited | Hidden | Full | Hidden |
| ValueTreeCanvas edit | Enabled | Enabled | Enabled | Disabled | Enabled | Disabled |
| **RightInspector** |||||||
| InputsPanel edit | Enabled | Enabled | Enabled | Disabled | Enabled | Disabled |
| Lock button | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| **Drawers** |||||||
| ApprovalDrawer | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| AssumptionEditDrawer | Enabled | Enabled | Enabled | Disabled | Enabled | Disabled |

---

## 8. Approval and Governance Rules in UI

### 8.1 Approval Gating

A graph cannot be locked if:

1. **Material nodes lack evidence** (> 20% of value at stake)
2. **Blocking formula errors exist**
3. **Defensibility score below 70%**
4. **Confidence threshold below minimum** (configurable, default 0.7)
5. **Unresolved red-team objections marked critical**

**UI Enforcement**:
- Lock button disabled with tooltip showing blocking issues
- ValidationFeed shows checklist with red/green status
- DefensibilityScoreCard shows red if below threshold

### 8.2 Override Behavior

Privileged users may override with:

1. **Reason required** (text input)
2. **Audit event emitted** (logged with actor, reason, timestamp)
3. **Visibly marked on version record** (override badge)
4. **Escalation notification** (to compliance/audit team)

**UI Flow**:
1. User clicks "Force Lock" (privileged action)
2. Override modal requires justification
3. System logs override event
4. Version record shows "APPROVED_WITH_OVERRIDE" status

---

## 9. State Management (Enhanced)

### 9.1 Layered Model

- **Server state**: Canonical graph, evidence, versions, workflow states
- **Client workspace state**: Selection, filters, open panels, draft edits
- **Ephemeral interaction state**: Hover, drag, zoom, pending mutation previews
- **Workflow state**: Current phase, step progress, blocking issues [NEW]

### 9.2 Recommended Stack

- TanStack Query for server state
- Zustand for client workspace state
- React Hook Form + Zod for input editing
- XState for approval/mutation flows
- WebSocket or SSE for real-time graph updates

### 9.3 State Domains (Enhanced)

#### A. Graph Domain

```typescript
type GraphState = {
  graphId: string;
  scenarioId: string;
  versionId: string | null;
  nodes: Record<string, ValueNode>;
  edges: Record<string, ValueEdge>;
  computedAt: string | null;
  globalMetrics: {
    npv: number;
    roi: number;
    paybackMonths: number;
    confidence: number;
    defensibilityScore: number;        // [NEW]
  };
  evidenceCoverage: number;            // [NEW] % of value backed by evidence
};
```

#### B. UI Workspace Domain

```typescript
type WorkspaceUIState = {
  selectedNodeId: string | null;
  activeView: "tree" | "waterfall" | "scenario" | "sensitivity" | "timeline";
  leftRailTab: "workflow" | "outline" | "scenarios" | "views" | "artifacts";  // [CHANGED]
  bottomTrayTab: "workflow" | "agent" | "activity" | "validation" | "defensibility";  // [CHANGED]
  workflowStep: ValueWorkflowStep;     // [NEW]
  filters: {
    nodeTypes: string[];
    minConfidence: number | null;
    showLockedOnly: boolean;
    showEvidenceGapsOnly: boolean;
    showDefensibilityIssues: boolean;  // [NEW]
  };
  canvas: {
    zoom: number;
    panX: number;
    panY: number;
  };
};
```

#### C. Draft Mutation Domain

```typescript
type DraftMutationState = {
  pendingChanges: DraftChange[];
  previewMetrics: {
    npv?: number;
    roi?: number;
    paybackMonths?: number;
    defensibilityScore?: number;       // [NEW]
  } | null;
  isDirty: boolean;
  isRecalculating: boolean;
};
```

#### D. Approval Workflow Domain [ENHANCED]

```typescript
type WorkflowStep = 
  | "hypothesis" 
  | "model" 
  | "evidence" 
  | "narrative" 
  | "objection" 
  | "revision" 
  | "approval";

type WorkflowStepState = {
  step: WorkflowStep;
  status: "not_started" | "active" | "complete" | "blocked";
  owner?: string;
  blockingReason?: string;
  artifacts?: string[];
};

type ApprovalState = {
  phase: "idle" | "validating" | "ready" | "submitting" | "locked" | "rejected";
  workflowSteps: WorkflowStepState[];   // [NEW] 7-step progress
  blockingIssues: ValidationIssue[];
  defensibilityScore: number;           // [NEW]
  approvalDrawerOpen: boolean;
};

type ValidationIssue = {
  type: "evidence_gap" | "formula_error" | "low_confidence" | "deficiency";
  severity: "warning" | "blocking";
  nodeId?: string;
  description: string;
  remediation?: string;
};
```

### 9.4 Data Flow

#### Input Edit Flow

1. User edits input
2. Local draft state updates
3. Validation runs
4. Mutation request sent
5. Server recomputes graph
6. Updated graph streamed back
7. UI reconciles and updates metrics
8. **Defensibility score recalculated**

#### Agent Mutation Flow

1. User submits NL request
2. Agent returns proposed patch
3. UI renders preview diff
4. User approves
5. Patch committed
6. Graph recalculates
7. Timeline and history update
8. **Workflow step may advance**

#### Version Lock Flow

1. User clicks lock
2. System validates material nodes
3. **Defensibility score checked**
4. Unresolved issues displayed
5. If pass, snapshot created
6. Graph enters locked state
7. **Workflow transitions to FINALIZED**

---

## 10. Tailwind Design Guidance

### 10.1 Visual Tone

- Executive, crisp, minimal
- Dark text on light surfaces
- Restrained accent usage
- Dense information without clutter

### 10.2 Style Tokens

**Surfaces**
- App background: `neutral-50`
- Cards: `white`
- Selected card/node: `neutral-900` ring with soft tint
- Low confidence: `amber` tint (warning)
- Invalid: `red` tint (error)
- Locked: `slate` tint (immutable)
- **Workflow active**: `blue` accent
- **Defensibility high**: `green` accent
- **Defensibility low**: `red` accent

**Workflow Stepper Colors**
- Complete: `green-500`
- Active: `blue-500`
- Blocked: `gray-300`
- Error: `red-500`

**Corners**
- Cards: `rounded-2xl`
- Pills/badges: `rounded-full`

**Shadows**
- Soft shadow for cards
- Stronger shadow for overlays/drawers

**Typography**
- Headline metrics: large, bold
- Labels: muted, compact
- Formulas: mono or tabular numerals
- **Use tabular numerals across all finance outputs**

---

## 11. Performance Requirements

Must support:

- 500+ visible nodes without degraded interaction
- Incremental recompute updates
- Virtualization for outline and evidence lists
- Lazy-load inspector deep data
- Memoized graph layout
- Debounced freeform input edits

Recommended techniques:
- React Flow or custom canvas/SVG hybrid for graph
- Windowing for long panels
- Selector-based Zustand subscriptions
- Optimistic UI for mutations with rollback on failure

---

## 12. MVP Component Priority

### Phase 1 (Core Workflow)

- AppShell
- WorkspaceHeader (with DefensibilityScoreCard)
- LeftRail (with WorkflowStepPanel)
- ValueTreeCanvas
- RightInspector core panels (with DefensibilityPanel)
- AgentConsole
- ScenarioSelector
- ValidationFeed
- **WorkflowTimeline**

### Phase 2 (Analysis & Approval)

- WaterfallCanvas
- ScenarioCompareCanvas
- RevisionHistoryPanel
- ApprovalDrawer (with gating)
- DiffReviewDrawer
- RedTeamReviewModal

### Phase 3 (Advanced)

- SensitivityCanvas
- TimelineCanvas
- Advanced SDUI overlays
- Live multi-user collaboration indicators

---

## 13. Implementation Recommendation

**Use:**
- React
- Tailwind
- shadcn/ui
- React Flow for graph canvas
- TanStack Query
- Zustand
- Zod
- React Hook Form
- **XState for workflow state machine**

This keeps the system fast, typed, and maintainable.

---

## 14. Final Product Definition

The Living Value Graph UI should feel like:

- **A financial model workbench** (deterministic, rigorous)
- **An evidence-linked decision cockpit** (every claim traceable)
- **A versioned collaboration surface** (audit trail, approvals)
- **A workflow-driven reasoning system** (7-step process visible)

And only secondarily, an AI experience.

**The AI assists the graph. The graph remains the product. The workflow orchestrates the reasoning.**

---

## Appendix: Integration Points Checklist

- [x] **Workflow step rail** in LeftRail (`WorkflowStepPanel`)
- [x] **State-gated components** with matrix in §7.3
- [x] **Defensibility dashboard** (`DefensibilityScoreCard`, `DefensibilityPanel`, `DefensibilityFeed`)
- [x] **Narrative as derived view** (read-only in `ArtifactsPanel` with stale indicator)
- [x] **Workflow timeline** in BottomTray (`WorkflowTimeline`)
- [x] **Approval gating** with defensibility score threshold
- [x] **Architectural binding** documented throughout (§0, §5.1, §5.2, etc.)
