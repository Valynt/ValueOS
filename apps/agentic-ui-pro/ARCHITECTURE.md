# Agentic UI Pro - Architecture Design

## 1. State → Experience Mapping
Every backend state must translate into a clear UI state.
- **Backend States:** `INITIATED`, `DRAFTING`, `VALIDATING`, `COMPOSING`, `REFINING`, `FINALIZED`
- **UI Mapping:**
  - `INITIATED` -> Discovery Skeleton, loading indicators, "Assembling context..."
  - `DRAFTING` -> Value Tree Canvas, streaming nodes, "Building hypothesis..."
  - `VALIDATING` -> Integrity Dashboard, confidence scores, "Verifying evidence..."
  - `COMPOSING` -> Executive Output Studio, drafting artifacts, "Generating narrative..."
  - `REFINING` -> Interactive Canvas, inline editing, "Awaiting review..."
  - `FINALIZED` -> Locked state, export options, "Ready for presentation"

## 2. Agent Output → User Artifacts
Raw agent outputs must become meaningful business objects.
- **Raw JSON:** `{ "roi": 2.5, "payback_months": 6, "confidence": 0.85 }`
- **Business Object:** `ValueHypothesis`
- **UI Artifact:** `HeadlineValueCard` with ROI, Payback, and Confidence Badge.
- **Domain Models:** `ValueNode`, `Evidence`, `DefensibilityScore`, `WorkflowProgress`

## 3. Workflow → User Journey
Backend workflows must feel like intuitive steps.
- **7-Step Loop:** Hypothesis → Model → Evidence → Narrative → Objection → Revision → Approval
- **UI Journey:**
  - **Step 1: Discovery** (Hypothesis)
  - **Step 2: Modeling** (Model + Evidence)
  - **Step 3: Validation** (Objection + Revision)
  - **Step 4: Output** (Narrative + Approval)
- **Components:** `WorkflowTimeline`, `StepperWizard`, `HumanCheckpoint`

## 4. Confidence → Trust Layer
Every output must be explainable and defensible.
- **Metrics:** `globalScore`, `coverageByNode`, `sourceIndependence`
- **UI Elements:**
  - `DefensibilityScoreCard` (Global score)
  - `ConfidenceBadge` (Per-node score)
  - `EvidencePanel` (Source citations, drill-downs)
  - `IntegrityVetoPanel` (Warnings, blockers)

## 5. Async Systems → Smooth Flow
Agent execution is async, but UX must feel continuous.
- **Infrastructure:** Server-Sent Events (SSE) / WebSockets
- **UI Patterns:**
  - Streaming text/data (Typewriter effect)
  - Skeleton loaders with context ("Analyzing 10-K...")
  - Optimistic UI updates
  - Resumable state (Zustand persist)
