# ValueOS Unified Specification
## Hypothesis-First Agentic Workflow System

**Version**: 1.0.0  
**Date**: March 2026  
**Status**: Production Specification

---

# SECTION I: Architectural Design Brief

## 1. Core Principle

ValueOS operates on a **Hypothesis-First methodology**, where every workflow begins with a **quantifiable value thesis** and progresses through a structured, multi-agent validation loop to produce **CFO-defensible outputs**.

The system is designed to eliminate:

- Unsubstantiated ROI claims
- Narrative-first bias
- Spreadsheet fragility
- Lack of auditability

Instead, it enforces:

- Deterministic financial modeling
- Evidence-backed assumptions
- Adversarial validation
- Human-in-the-loop approval

---

## 2. Core Agentic Workflow (7-Step Loop)

The system is powered by a **Multi-Agent Orchestration Loop**, where specialized agents collaborate in a closed feedback cycle:

### Step 1: Hypothesis (Value Driver Generation)

Proactively generates a **specific, measurable value thesis**.

**Example**: *"Reduce Days Sales Outstanding (DSO) by 12%"*

**Output**:
```json
{
  "hypothesis_id": "HYP-001",
  "metric": "DSO",
  "expected_delta": -0.12,
  "value_type": "cash_flow_improvement"
}
```

**UI Realization**: Graph seed node, Hypothesis builder, Agent console prompt

---

### Step 2: Model (Financial Value Tree Construction)

A **Financial Logic Agent** builds a structured **Value Tree**.

**Enforces**:
- Deterministic formulas
- Traceable assumptions
- Standard financial constructs (NPV, IRR, Payback)

**Output**:
```json
{
  "value_tree": {
    "driver": "DSO Reduction",
    "formula": "(Current DSO - Target DSO) * Daily Revenue",
    "inputs": ["revenue", "current_dso", "target_dso"]
  }
}
```

**UI Realization**: `ValueTreeCanvas`, `FormulaPanel`, `InputsPanel`

---

### Step 3: Evidence (Grounding Layer)

A **Retrieval Agent** sources verifiable data:

- SEC EDGAR (10-K, 10-Q)
- Industry benchmarks
- Internal CRM / ERP data

**Output**:
```json
{
  "sources": [
    { "type": "10-K", "company": "TargetCo", "year": 2024 },
    { "type": "benchmark", "source": "Gartner", "metric": "DSO" }
  ],
  "confidence": 0.82
}
```

**UI Realization**: `EvidencePanel`, citation links, evidence gap warnings

---

### Step 4: Narrative (Executive Translation)

A **Narrative Agent** converts financial logic into:

- Executive-ready story
- Vertical-specific framing
- Persona-aware messaging (CFO, CRO, COO)

**Output**: Executive Summary, Value articulation aligned to business priorities

**UI Realization**: `ArtifactsPanel` (derived, read-only), Executive summary views

**Constraint**: Narrative is **derived from** model, not independent source of truth.

---

### Step 5: Objection (Red Team Simulation)

A **Red Team Agent** simulates executive pushback:

- "Is this achievable?"
- "What assumptions are weak?"
- "What's the downside risk?"

**Output**:
```json
{
  "objections": [
    "DSO reduction assumption exceeds industry variance",
    "No sensitivity analysis on revenue volatility"
  ]
}
```

**UI Realization**: `ObjectionsPanel`, `RedTeamReviewModal`, warning states

---

### Step 6: Revision (Auto-Correction Loop)

System automatically:

- Adjusts assumptions
- Recalculates model
- Refines narrative

**Maintains**:
- Version history
- Delta tracking
- Audit log

**UI Realization**: `InlineMutationBar`, `DiffReviewDrawer`, Scenario compare

---

### Step 7: Approval (Human-in-the-Loop Lock)

**Value Engineer validates and locks output**.

**Produces**:
- Immutable version
- Audit-ready artifact
- Downstream-ready component

**UI Realization**: `ApprovalDrawer`, `LockVersionModal`, `StateBadge`

---

## 3. Orchestration Model: Distributed Saga + State Machine

The workflow is governed by a **Distributed Saga Pattern**, ensuring:

- Fault tolerance
- State consistency
- Recoverability

### 3.1 State Machine

| Phase | State | Description | UI Visibility |
|-------|-------|-------------|---------------|
| Discovery | `INITIATED` | Ingest Opportunity ID → Build Context Map + Pain Points | WorkspaceHeader badge |
| Modeling | `DRAFTING` | Generate hypothesis + construct Value Tree | WorkflowTimeline highlight |
| Integrity | `VALIDATING` | Validate logic, evidence, and assumptions | ValidationFeed active |
| Narrative | `COMPOSING` | Generate executive-ready outputs (PPTX / SDUI) | ArtifactsPanel regenerating |
| Iteration | `REFINING` | Apply Red Team + user feedback | ObjectionsPanel resolution |
| Realization | `FINALIZED` | Lock business case (decision-grade) | Lock badge, immutable state |

### 3.2 Saga Guarantees

- Idempotent agent execution
- Compensating actions for failed steps
- Event-driven transitions (NATS / Kafka compatible)
- Persistent workflow state

---

## 4. System Architecture (Five Core Modules)

### 4.1 Frontend (Presentation Layer)

**Technology**: React / Next.js / SDUI

**Features**:
- Value Tree visualization
- Hypothesis builder
- Objection explorer
- Executive outputs (PPTX, dashboards)

**Realization**: Living Value Graph UI (see Section IV)

---

### 4.2 Backend for Frontend (BFF)

**Purpose**: API aggregation layer

**Responsibilities**:
- Session orchestration
- Auth + RBAC
- UI-specific data shaping
- SDUI payload composition

---

### 4.3 Backend for Agents (BFA)

**Purpose**: Core agent execution layer

**Agents**:
1. Hypothesis Agent
2. Financial Model Agent
3. Evidence Retrieval Agent
4. Narrative Agent
5. Red Team Agent
6. Integrity Agent
7. Value Engineer Agent (human interface)

---

### 4.4 Data Layer

**Components**:
- Postgres (transactional data)
- Vector DB (semantic retrieval)
- Object storage (artifacts, PPTX)
- Audit log store (immutable)

---

### 4.5 Orchestration Layer

**Manages**:
- Agent workflows
- State transitions
- Saga execution

**Technologies**:
- LangGraph / Temporal / custom engine
- Event bus (NATS / Kafka)

---

## 5. System-Level Guarantees

### 5.1 CFO-Defensibility

Every number must be:

- **Traceable** → Source (evidence link)
- **Reproducible** → Model (deterministic formula)
- **Explainable** → Narrative (executive translation)

**UI Enforcement**: `DefensibilityScoreCard` shows % of value backed by evidence. Blocks approval if < 70%.

---

### 5.2 Auditability

**Full lineage**: Hypothesis → Model → Evidence → Output

- Version-controlled artifacts
- Immutable approvals
- Actor tracking
- Reason logging

---

### 5.3 Security & Governance

- Row-Level Security (multi-tenant)
- PII redaction
- Agent-level permissioning
- Compliance-ready (SOC2 / ISO alignment)

---

### 5.4 Determinism + AI Hybrid

- AI generates candidates
- System validates before finalization
- No black-box outputs allowed in final state

---

## 6. Key Insight (What Makes This Different)

This is **not**:
- A chatbot
- A static ROI calculator
- A slide generator

This **is**:

> A **closed-loop economic reasoning system** where **every claim is modeled, proven, attacked, and defended before approval.**

---

# SECTION II: Specification Constitution

## 1. Foundational Principles

### 1.1 Hypothesis-First Mandate
Every workflow MUST begin with a quantifiable value thesis before any modeling or analysis occurs.

**Rule**: No agent may execute financial calculations without a validated hypothesis artifact.

### 1.2 CFO-Defensibility Standard
All outputs must meet CFO-defensibility criteria:
- Traceability: Every number links to source data
- Reproducibility: Models execute deterministically given same inputs
- Explainability: Narrative explains financial logic in executive terms

**Rule**: Outputs without audit lineage are rejected by the Integrity Agent.

### 1.3 Closed-Loop Validation
The 7-step workflow operates as a closed feedback system:
1. Hypothesis → 2. Model → 3. Evidence → 4. Narrative → 5. Objection → 6. Revision → 7. Approval → (back to Evidence if challenged)

**Rule**: No step may be skipped. Workflow advancement requires explicit state transition events.

### 1.4 Deterministic + AI Hybrid
AI agents generate candidates. System enforces deterministic validation before finalization.

**Rule**: AI-generated outputs are always Draft state until validated by rule-based checks.

---

## 2. Quality Gates

### 2.1 Hypothesis Quality
- Must specify metric, delta, and value type
- Confidence threshold ≥ 0.7 for financial decisions
- Requires at least one data source reference

### 2.2 Model Quality
- All formulas deterministic and testable
- Assumptions explicitly listed with confidence scores
- Sensitivity analysis required for NPV > $1M

### 2.3 Evidence Quality
- Minimum 2 independent sources for key assumptions
- Confidence score ≥ 0.8 for primary drivers
- Gaps documented if data unavailable

### 2.4 Approval Readiness
- Defensibility score ≥ 70%
- No blocking formula errors
- No unresolved critical objections
- Evidence coverage > 80% of value at stake

---

# SECTION III: Agent Definitions

## 1. Agent Registry

| # | Agent | Lifecycle Stage | Purpose | Confidence Threshold |
|---|-------|-----------------|---------|---------------------|
| 1 | HypothesisAgent | Opportunity | Generate quantifiable theses | 0.70 |
| 2 | FinancialModelAgent | Target | Build deterministic value trees | 0.75 |
| 3 | EvidenceRetrievalAgent | Integrity | Source verifiable grounding data | 0.80 |
| 4 | NarrativeAgent | Expansion | Translate to executive stories | 0.70 |
| 5 | RedTeamAgent | Integrity | Adversarial validation | 0.80 |
| 6 | IntegrityAgent | Integrity | Final compliance audit | 0.95 |
| 7 | ValueEngineerAgent | All | Human-in-the-loop interface | 1.00 |

## 2. Agent Execution Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    7-STEP AGENTIC LOOP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│   │Hypothesis│────→│  Model   │────→│ Evidence │               │
│   │  Agent   │     │  Agent   │     │  Agent   │               │
│   └──────────┘     └──────────┘     └────┬─────┘               │
│                                          │                      │
│   ┌──────────┐     ┌──────────┐     ┌───┴──────┐               │
│   │ Approval │←────│ Revision │←────│ Narrative│               │
│   │  Agent   │     │  (Auto)  │     │  Agent   │               │
│   └────┬─────┘     └──────────┘     └──────────┘               │
│        │                                                        │
│   ┌────┴─────┐                                                 │
│   │ RedTeam  │←── Objection loop                                 │
│   │  Agent   │                                                 │
│   └──────────┘                                                 │
│                                                                 │
│   Loop back to Evidence if objections require more sources      │
│   Loop back to Model if assumptions are invalid                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3. State Transitions

| From State | To State | Trigger Event | Validation |
|------------|----------|---------------|------------|
| INITIATED | DRAFTING | hypothesis_generated | hypothesis.confidence >= 0.7 |
| DRAFTING | VALIDATING | model_constructed | model.formula_valid |
| VALIDATING | COMPOSING | evidence_sufficient | evidence.aggregate >= 0.8 |
| VALIDATING | DRAFTING | evidence_insufficient | (loop back) |
| COMPOSING | REFINING | narrative_generated | narrative.complete |
| REFINING | FINALIZED | objections_resolved | objections.none_critical |
| REFINING | VALIDATING | assumptions_invalid | (loop back) |
| ANY | ROLLED_BACK | saga_compensation_triggered | - |

---

# SECTION IV: Living Value Graph UI Specification

## 1. Architectural Binding Statement

The Living Value Graph is the **frontend realization** of the ValueOS architectural brief. It serves as the presentation-layer implementation of the **Hypothesis-First, 7-Step Closed-Loop Economic Reasoning Process**.

### 1.1 Workflow Phase to UI Surface Mapping

| Architectural Phase | System Meaning | UI Realization |
|---------------------|----------------|----------------|
| **1. Hypothesis** | Generate quantifiable thesis | Graph seed node, Hypothesis builder, Agent console prompt |
| **2. Model** | Build value tree and formulas | `ValueTreeCanvas`, `FormulaPanel`, `InputsPanel` |
| **3. Evidence** | Ground assumptions and claims | `EvidencePanel`, citation links, evidence gap warnings |
| **4. Narrative** | Turn model into executive story | `ArtifactsPanel` (derived, read-only), Executive summary views |
| **5. Objection** | Stress-test assumptions | `ObjectionsPanel`, `RedTeamReviewModal`, warning states |
| **6. Revision** | Adjust model and recalc | `InlineMutationBar`, `DiffReviewDrawer`, Scenario compare |
| **7. Approval** | Lock decision-grade version | `ApprovalDrawer`, `LockVersionModal`, `StateBadge` |

### 1.2 State Machine Visualization

The 6-state orchestration flow appears in **three UI surfaces**:

1. **WorkspaceHeader** - Current lifecycle badge with color coding
2. **BottomTray.WorkflowTimeline** - Visual state machine with step completion indicators
3. **Component gating** - Actions enabled/disabled based on workflow state

---

## 2. Layout Architecture

### 2.1 Primary Shell

```
AppShell
├── TopNav
│   └── WorkflowStepRail [7-step progress indicator]
├── WorkspaceHeader
│   └── DefensibilityScoreCard [% value backed by evidence]
├── MainWorkspace
│   ├── LeftRail
│   │   └── WorkflowStepPanel [7-step stepper]
│   ├── CenterCanvas
│   │   └── InlineMutationBar [state-gated actions]
│   └── RightInspector
│       ├── EvidencePanel [source lineage]
│       ├── ConfidencePanel [factor breakdown]
│       └── DefensibilityPanel [node-level coverage]
└── BottomTray
    ├── WorkflowTimeline [orchestration state machine]
    └── DefensibilityFeed [evidence gaps & warnings]
```

---

## 3. Core UI Components (with Architectural Binding)

### 3.1 WorkspaceHeader Components

#### DefensibilityScoreCard [ARCHITECTURAL: CFO-Defensibility]

**Purpose**: Shows % of total value backed by cited evidence.

**Display**:
- Progress ring (0-100%)
- Color coding: Green ≥ 90%, Amber 70-89%, Red < 70%
- **Blocks approval if < 70%**

**Formula**: `defensibility_score = Σ(node_value × evidence_coverage) / total_value`

---

### 3.2 LeftRail Components

#### WorkflowStepPanel [ARCHITECTURAL: 7-Step Loop]

**Layout**: Vertical stepper

```
[✓] 1. Hypothesis      [Complete]
[✓] 2. Model           [Complete]
[→] 3. Evidence        [Active - needs sources]
[○] 4. Narrative       [Blocked]
[○] 5. Objection       [Blocked]
[○] 6. Revision        [Blocked]
[○] 7. Approval        [Blocked]
```

**Click behavior**: Click active step to see blocking issues.

---

#### ArtifactsPanel [ARCHITECTURAL: Narrative as Derived]

**Constraint**: All artifacts are **read-only, regenerable** from graph state.

**Stale indicator**: "Regenerate" button if graph changed since last narrative generation.

**Rule**: Narrative is never editable independently of model.

---

### 3.3 CenterCanvas Components

#### InlineMutationBar [ARCHITECTURAL: State Gating]

| Action | INITIATED | DRAFTING | VALIDATING | COMPOSING | REFINING | FINALIZED |
|--------|-----------|----------|------------|-----------|----------|-----------|
| Edit assumption | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Red-team node | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Request approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |

**Visual**: Disabled actions show lock icon with tooltip: "Available in [STATE] phase".

---

### 3.4 RightInspector Components

#### EvidencePanel [ARCHITECTURAL: Evidence-Backed Assumptions]

Shows for each assumption:
- Source title and type (10-K, benchmark, CRM, ERP)
- Citation location
- Freshness date
- **Confidence contribution**

#### DefensibilityPanel [ARCHITECTURAL: Traceability]

Shows for selected node:
- Evidence coverage %
- Source independence count
- Audit trail completeness

**Warning**: Red indicator if node lacks sufficient evidence for its value contribution.

---

### 3.5 BottomTray Components

#### WorkflowTimeline [ARCHITECTURAL: State Machine]

**Layout**: Horizontal timeline

```
[INITIATED] → [DRAFTING] → [VALIDATING] → [COMPOSING] → [REFINING] → [FINALIZED]
   Jan 15      Jan 16        Jan 17         Jan 18        Jan 20         [pending]
```

**Features**:
- Click phase to see actions taken
- Shows actor for each transition
- Displays blocking issues between phases

---

#### DefensibilityFeed [ARCHITECTURAL: Auditability]

Shows:
- "Top 5 nodes lacking evidence"
- "Stale citations needing refresh"
- Quick action: "Find evidence for selected node"

---

## 4. State Gating Matrix

| Component/Action | INITIATED | DRAFTING | VALIDATING | COMPOSING | REFINING | FINALIZED |
|------------------|-----------|----------|------------|-----------|----------|-----------|
| **Approve button** | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| **InlineMutationBar** | Full | Full | Limited | Hidden | Full | Hidden |
| **InputsPanel edit** | Enabled | Enabled | Enabled | Disabled | Enabled | Disabled |
| **Artifacts regenerate** | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |
| **Lock button** | Hidden | Hidden | Enabled | Enabled | Enabled | Hidden |

---

## 5. Approval and Governance

### 5.1 Approval Gating [ARCHITECTURAL: Human-in-the-Loop]

A graph cannot be locked if:

1. **Defensibility score < 70%** (> 30% value without evidence)
2. **Blocking formula errors exist**
3. **Unresolved critical objections**
4. **Confidence threshold below 0.7**

**UI Enforcement**:
- Lock button disabled with tooltip showing blocking issues
- ValidationFeed shows checklist
- DefensibilityScoreCard red if below threshold

### 5.2 Override Behavior [ARCHITECTURAL: Auditability]

Privileged users may override with:
1. **Reason required** (mandatory text input)
2. **Audit event emitted** (logged with actor, reason, timestamp)
3. **Visibly marked** ("APPROVED_WITH_OVERRIDE" status)

---

## 6. State Management

### 6.1 Workflow State Domain [NEW]

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
  workflowSteps: WorkflowStepState[];
  blockingIssues: ValidationIssue[];
  defensibilityScore: number;
};
```

### 6.2 Data Flow with Workflow

#### Input Edit Flow
1. User edits input
2. Local draft state updates
3. Validation runs
4. **Defensibility score recalculated**
5. Mutation request sent
6. Server recomputes graph
7. Updated graph streamed back

#### Version Lock Flow
1. User clicks lock
2. System validates material nodes
3. **Defensibility score checked**
4. Unresolved issues displayed
5. If pass, snapshot created
6. **Workflow transitions to FINALIZED**

---

## 7. SDUI Model

### 7.1 Extended Component Registry

```typescript
type SDUIComponent =
  | "stat_card"
  | "defensibility_panel"      // [NEW] % value backed by evidence
  | "workflow_stepper"         // [NEW] 7-step progress
  | "node_summary"
  | "formula_panel"
  | "evidence_list"
  | "confidence_panel"
  | "objections_panel"
  | "scenario_table"
  | "timeline_chart"
  | "activity_feed"
  | "agent_console";
```

### 7.2 State-Gated SDUI Payload

```json
{
  "page": "living_value_graph",
  "workflow_state": "VALIDATING",
  "defensibility_score": 0.87,
  "layout": {
    "header": [
      { "type": "stat_card", "props": { "metric": "npv" } },
      { "type": "defensibility_panel", "props": { "show_progress": true } }
    ],
    "left_rail": [
      { "type": "workflow_stepper", "props": { "current_step": "evidence" } }
    ]
  },
  "gating_rules": {
    "allow_mutation": true,
    "allow_approval": false,
    "require_evidence": true
  }
}
```

---

## 8. Final Product Definition

The Living Value Graph UI should feel like:

- **A financial model workbench** (deterministic, rigorous)
- **An evidence-linked decision cockpit** (every claim traceable)
- **A versioned collaboration surface** (audit trail, approvals)
- **A workflow-driven reasoning system** (7-step process visible)

And only secondarily, an AI experience.

**The AI assists the graph. The graph remains the product. The workflow orchestrates the reasoning.**

---

# Appendix: Specification Checklist

## Architectural Binding
- [x] 7-step workflow → UI components mapped
- [x] 6-state machine → UI badges/timeline
- [x] CFO-defensibility → DefensibilityScoreCard
- [x] Evidence-backed → EvidencePanel with lineage
- [x] Narrative-derived → ArtifactsPanel (read-only)
- [x] Human-in-the-loop → ApprovalDrawer with gating

## Integration Points
- [x] **Workflow step rail** in LeftRail
- [x] **State-gated components** with explicit matrix
- [x] **Defensibility dashboard** in header and inspector
- [x] **Narrative as derived view** with stale indicator
- [x] **Workflow timeline** in BottomTray

## Quality Gates
- [x] Defensibility score ≥ 70% blocks approval
- [x] Evidence coverage tracked per node
- [x] Confidence threshold enforcement
- [x] Override behavior with audit logging
