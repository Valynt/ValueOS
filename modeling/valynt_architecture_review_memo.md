# Valynt Value Orchestration: Architecture Review Memo

**Document Type**: Architecture Review Memo with Claim Audit  
**Version**: v2.0-ARM  
**Date**: 2026-03-23  
**Status**: Under Review  

---

## 1. Executive Summary

### What Exists (Current State)

A demo-grade value orchestration system with:
- 8-agent fabric implemented as TypeScript classes (5 agents functional, 3 partially implemented)
- Domain entity schemas (Zod) for 7 core entities
- Database schema (PostgreSQL) with RLS policies for tenant isolation
- Frontend UI presenting capabilities that exceed backend implementation
- Economic Kernel stub (formulas defined, Decimal.js not yet integrated)
- IntegrityAgent logic implemented but not wired to lifecycle transitions

**Verdict**: The system demonstrates the vision but is not production-credible. Key flows are mocked or disconnected.

### What Is Proposed (Target State)

A production-grade value orchestration system with:
- 5-core + 2-extension agent fabric (consolidated from 8)
- Deterministic Economic Kernel for all financial calculations
- Integrity-first governance with veto authority over lifecycle transitions
- Truthful telemetry connecting value claims to realized outcomes via external systems
- Claim maturity model governing speculative → validated → committed → realized progression

**Verdict**: Architecturally sound but requires significant implementation effort and calibration of untested mechanisms.

### What Is Unproven (Hypotheses Requiring Validation)

1. **Evidence tier effectiveness**: Silver/Gold/Platinum stratification improves claim reliability (untested)
2. **Integrity score calibration**: 0.6 threshold predicts customer acceptance (no empirical basis)
3. **Scoring formula weights**: 0.6/0.4 and 0.5/0.5 weightings optimize for desired outcomes (arbitrary)
4. **5-agent consolidation**: Reduces complexity without losing capability (untested)
5. **Truthful telemetry adoption**: Customers will provide telemetry access at rates sufficient for "proven" status (high risk)
6. **Veto authority acceptance**: Sales teams will tolerate AI blocking deal progression (organizational risk)

**Verdict**: Core mechanisms are design hypotheses, not validated interventions.

---

## 2. Claim Audit Table

| Claim | Type | Evidence | Weakness | Status |
|-------|------|----------|----------|--------|
| "7 entities constitute irreducible core" | Architectural | Coherent minimal ontology; eliminates redundancy | Not proven against edge cases (multi-case scenarios, amendment workflows, complex commitment bundling) | **Hypothesis** |
| "Economic Kernel is deterministic and audit-safe" | Technical | Decimal.js library selected; formulas explicit; no floating-point arithmetic | No validation against real-world financial variance; no third-party audit of formulas | **Designed** |
| "IntegrityAgent has veto power over lifecycle transitions" | Governance | Gate logic defined; violation taxonomy specified; blocking conditions enumerated | Not enforced in production flows; override protocol unspecified; sales team friction unaddressed | **Partially Implemented** |
| "Truthful Telemetry ensures real ROI tracking" | Product | RealizationProof entity; telemetry source tracking; variance calculation defined | Telemetry integrations missing (ERP, CRM APIs not connected); manual CSV fallback undermines "truthful" claim; data decay risk after 6 months | **Conceptual** |
| "Defense readiness ≥ 0.8 = presentation-ready threshold" | Policy | Formula defined with explicit weights | Threshold arbitrary; no empirical calibration against customer acceptance rates; no sensitivity analysis provided | **Heuristic** |
| "Integrity score ≥ 0.6 blocks status advance to in_review" | Policy | Formula defined; gate logic specified | Same calibration weaknesses as defense readiness; 0.6 cutoff not validated; may produce false positives/negatives | **Heuristic** |
| "Right-sized 5-agent architecture reduces complexity" | Design | Clear consolidation rationale; overlapping responsibilities eliminated | Not benchmarked against original 8-agent system; complexity reduction not measured; agent interaction testing incomplete | **Hypothesis** |
| "Evidence tiers (silver/gold/platinum) improve claim reliability" | Governance | Tier taxonomy defined; graduated trust mechanism | No empirical validation that tier requirements correlate with claim accuracy; no historical data to validate stratification | **Hypothesis** |
| "Production-credible architecture blueprint" | Positioning | Migration plan exists; phased roadmap defined; specific gaps identified | Current system explicitly not production-ready; blueprint is aspirational specification, not implemented system | **Aspirational** |
| "Variance > 20% triggers intervention workflow" | Operational | Threshold specified; response protocol outlined | 20% cutoff arbitrary; no escalation path for >50% or >100% variance; response effectiveness untested | **Heuristic** |
| "Realization > 110% generates expansion signal" | Growth | Logic defined; trigger mechanism specified | 110% threshold arbitrary; correlation between over-realization and expansion opportunity not validated | **Heuristic** |
| "5-minute value case creation" | UX | Target specified; workflow optimized | Not measured; assumes DiscoveryAgent generates quality hypotheses in single pass; may require iteration | **Target** |
| "80% realization tracking coverage within 6 months" | Operational | Telemetry hierarchy defined (API → CSV → manual) | Depends on customer willingness to provide data access; no binding mechanism to enforce participation; proxy data (Salesforce) not yet implemented as "Proof-Lite" fallback | **Target** |
| "Integrity score accuracy > 90%" | Quality | Metric defined; correlation methodology implied | No baseline data; no validation plan; measurement method unspecified | **Target** |
| "LLM-generated confidence scores correlate with claim validity" | ML | secureInvoke grounding scores available; hallucination detection implemented | Confidence scores not calibrated against outcomes; grounding score threshold (0.7) arbitrary | **Hypothesis** |
| "Decimal.js prevents financial calculation errors" | Technical | Library selected; schema enforces string decimals | Serialization/deserialization risks at API boundaries; type safety not fully verified across stack | **Implemented** |
| "Bitemporal hooks enable future audit compliance" | Architecture | valid_from/to fields in schema; temporal awareness documented | Not implemented (hooks only); query patterns not designed; historical reconstruction not tested | **Future Capability** |
| "Consolidating ComplianceAuditor into IntegrityAgent reduces complexity" | Design | Overlapping responsibilities identified; merge rationale clear | Compliance-specific validation logic not yet merged; scope expansion may increase IntegrityAgent complexity | **Partially Implemented** |
| "NarrativeAgent implementation: 16 hours" | Estimation | Scope defined (PDF/PPTX generation); reuse of BusinessCase schema assumed | Estimate assumes no complexity in templating engine; no technical spike performed; actual effort unknown | **Estimate (Unvalidated)** |
| "Claim maturity model (speculative → validated → committed → proven) is backbone of system" | Conceptual | States defined; transitions outlined; integrity requirements per stage specified | Distributed across entities rather than unified abstraction; no canonical "Claim" entity; maturity logic fragmented | **Partially Implemented** |

---

## 3. Canonical Model

### 3.1 Design Principles

1. **Minimalism**: Only entities required for audit-grade value lineage
2. **Immutability**: Historical states must be reconstructible
3. **Temporal Awareness**: All values have effective time and system time
4. **Deterministic Boundaries**: Financial calculations isolated from reasoning

### 3.2 Core Entities (7)

#### Account
```typescript
interface Account {
  id: UUID;                    // Primary key
  organization_id: UUID;       // Tenant isolation
  legal_name: string;           // Required
  primary_domain: string;      // Unique per tenant
  industry_code: string;         // NAICS or SIC
  created_at: Timestamp;       // System time
  updated_at: Timestamp;         // System time
}

// Invariants:
// - organization_id + primary_domain is unique
// - industry_code must be valid NAICS/SIC value
// - legal_name non-empty, max 255 chars
```

#### Opportunity
```typescript
interface Opportunity {
  id: UUID;
  organization_id: UUID;
  account_id: UUID;            // FK → Account
  
  name: string;                // Engagement identifier
  stage: OpportunityStage;     // lifecycle position
  status: OpportunityStatus;   // operational state
  
  // Temporal
  opened_at: Timestamp;
  closed_at: Timestamp | null;
  expected_close_date: Date | null;
  
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - account_id references valid Account in same organization
// - if status = 'closed_won' or 'closed_lost', closed_at must be set
// - stage transitions must follow defined state machine
```

#### ValueHypothesis
```typescript
interface ValueHypothesis {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // FK → Opportunity
  
  description: string;         // Falsifiable claim
  category: ValueDriver;        // revenue_growth | cost_reduction | risk_mitigation | capital_efficiency
  
  // Quantified value (range, never point)
  estimated_value_low: Decimal;    // Conservative (P10)
  estimated_value_high: Decimal;   // Optimistic (P90)
  value_unit: ValueUnit;       // usd | percent | hours | headcount | days
  timeframe_months: number;    // 1-120
  
  // Confidence and status
  confidence: number;          // 0.0 - 1.0
  status: HypothesisStatus;     // proposed | under_review | validated | rejected | superseded
  
  // Provenance
  created_by_agent: string;
  reasoning_trace_id: UUID | null;
  
  // Temporal
  valid_from: Timestamp;       // When claim becomes valid
  valid_to: Timestamp | null;    // When claim expires/superseded
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - estimated_value_low < estimated_value_high
// - confidence > 0.7 requires linked Evidence with tier ∈ (gold, platinum)
// - status = 'validated' requires integrity_check_passed = true
// - if superseded, valid_to must be set and superseded_by_id must reference valid hypothesis
// - description must contain at least one measurable metric (enforced by validation, not DB)
```

#### Assumption
```typescript
interface Assumption {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // FK → Opportunity
  hypothesis_id: UUID | null;  // FK → ValueHypothesis (null = opportunity-level)
  
  name: string;                // Short label
  description: string | null;
  
  value: Decimal;              // Numeric value
  unit: string;                // USD, %, days, FTE, etc.
  
  source: AssumptionSource;    // edgar | gartner | industry_benchmark | customer_stated | internal_estimate | calculated
  
  // Confidence interval for sensitivity
  sensitivity_low: Decimal | null;   // Multiplier (e.g., 0.8)
  sensitivity_high: Decimal | null;  // Multiplier (e.g., 1.2)
  
  // Human validation
  human_reviewed: boolean;
  reviewed_by: UUID | null;    // FK → User
  reviewed_at: Timestamp | null;
  
  // Temporal (bitemporal)
  valid_from: Timestamp;       // When true in business reality
  valid_to: Timestamp | null;   // When no longer true
  
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - if hypothesis_id not null, must reference valid hypothesis in same opportunity
// - source = 'customer_stated' → human_reviewed must be true
// - if sensitivity_low/high set, must satisfy: sensitivity_low < 1.0 < sensitivity_high
// - if human_reviewed = true, reviewed_by and reviewed_at must be set
// - valid_from < valid_to (if valid_to not null)
```

#### Evidence
```typescript
interface Evidence {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // FK → Opportunity
  hypothesis_id: UUID | null;   // FK → ValueHypothesis (null = opportunity-level)
  
  title: string;               // Short label
  content: string;             // Full evidence text/data
  
  // Quality classification
  tier: EvidenceTier;          // silver | gold | platinum
  provenance: EvidenceProvenance;  // edgar_filing | industry_report | customer_interview | system_of_record | agent_calculated | contractual_commitment
  
  // Attribution
  source_url: string | null;   // Required for gold/platinum
  source_document: string | null;  // Citation, filing ID, etc.
  
  // LLM grounding
  grounding_score: number | null;  // 0.0 - 1.0 from secureInvoke
  
  // Flags
  is_synthetic: boolean;       // Generated for testing/validation
  
  // Temporal
  evidence_date: Date | null;  // When evidence was created (not when recorded)
  valid_until: Date | null;    // Expiration for time-sensitive evidence
  
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - tier ∈ (gold, platinum) → source_url must be non-null
// - tier = platinum → provenance must be ∈ (edgar_filing, contractual_commitment, system_of_record)
// - if grounding_score < 0.7 and tier ∈ (gold, platinum), must have human_reviewed override
// - evidence_date ≤ created_at (evidence can't be from the future)
```

#### BusinessCase
```typescript
interface BusinessCase {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // FK → Opportunity (1:1 enforced)
  
  title: string;               // Customer-facing title
  status: CaseStatus;          // draft | in_review | approved | presented | archived
  
  // Frozen reference to hypotheses at time of case creation
  // (Prevents drift when hypotheses evolve)
  hypothesis_snapshot: HypothesisSnapshot[];  // JSONB array
  
  // Financial summary (computed by Economic Kernel)
  total_value_low: Decimal;
  total_value_high: Decimal;
  roi_3yr: Decimal;
  npv: Decimal;
  irr: Decimal;
  payback_months: number;
  
  // Scenario breakdown
  scenarios: ScenarioSnapshot;  // conservative, base, upside
  
  // Integrity (computed, materialized)
  defense_readiness_score: number | null;
  integrity_score: number | null;
  integrity_check_at: Timestamp | null;
  
  // Versioning
  version: number;             // Incremented on regeneration
  superseded_by_id: UUID | null;  // If this version replaced
  
  // Ownership
  owner_id: UUID;              // Presenting user
  
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - opportunity_id is unique (one active case per opportunity enforced at application layer)
// - status ∈ (in_review, approved, presented) → integrity_score ≥ 0.6 AND defense_readiness_score ≥ 0.8
// - status ∈ (in_review, approved, presented) → ALL hypotheses in snapshot have status = 'validated'
// - total_value_low = SUM(hypothesis.estimated_value_low for h in snapshot)
// - total_value_high = SUM(hypothesis.estimated_value_high for h in snapshot)
// - version = 1 + (count of prior cases for this opportunity)
// - if superseded_by_id set, superseded_by must reference valid case with higher version
```

#### ValueCommitment
```typescript
interface ValueCommitment {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // FK → Opportunity
  business_case_id: UUID;      // FK → BusinessCase (which version committed)
  
  title: string;
  description: string | null;
  
  commitment_type: CommitmentType;  // financial | operational | strategic | compliance
  priority: Priority;          // low | medium | high | critical
  
  // The promise (must be within business case ranges)
  committed_value_low: Decimal;
  committed_value_high: Decimal;
  currency: Currency;          // ISO code
  
  // Timeline
  timeframe_months: number;   // 1-120
  committed_at: Timestamp;
  target_completion_date: Date;
  actual_completion_date: Date | null;
  
  // Progress
  status: CommitmentStatus;    // draft | active | at_risk | fulfilled | cancelled
  progress_percentage: number;  // 0.0 - 100.0
  
  // Realization tracking
  latest_realization_rate: number | null;  // 0.0-2.0 (1.0 = on target)
  latest_realization_at: Timestamp | null;
  
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Invariants:
// - committed_value_low ≥ business_case.total_value_low * 0.8
// - committed_value_high ≤ business_case.total_value_high * 1.2
// - status = 'fulfilled' → actual_completion_date must be set AND latest_realization_rate ≥ 0.9
// - if status = 'at_risk', latest_realization_rate must be < 0.9
// - target_completion_date > committed_at
```

#### RealizationProof
```typescript
interface RealizationProof {
  id: UUID;
  organization_id: UUID;
  commitment_id: UUID;         // FK → ValueCommitment
  
  // Measurement specification
  metric_name: string;         // KPI being measured
  metric_definition: string;   // How this metric is calculated
  unit: string;               // Unit of measurement
  
  // Values
  committed_target: Decimal; // What was promised (from commitment)
  actual_value: Decimal;       // What was measured
  
  // Variance (computed deterministically)
  variance_percentage: Decimal;  // ((actual - committed) / committed) * 100
  variance_direction: VarianceDirection;  // above_target | on_target | below_target | at_risk
  
  // Provenance
  data_source: string;        // System providing data (Salesforce, ERP, CSV upload, etc.)
  data_source_type: DataSourceType;  // api | csv_upload | manual_entry | proxy | self_reported
  measurement_method: string;  // SQL query, API endpoint, calculation logic
  measurement_query: string | null;  // Actual query/code used (for audit)
  
  // Temporal
  measurement_period_start: Date;
  measurement_period_end: Date;
  measured_at: Timestamp;     // When measurement was taken
  
  // Flags
  is_disputed: boolean;       // Customer disputes accuracy
  dispute_reason: string | null;
  
  created_at: Timestamp;
}

// Invariants:
// - commitment_id references valid commitment in same organization
// - actual_value and committed_target have same unit
// - variance_direction = 'at_risk' if variance_percentage < -10.0
// - data_source_type = 'self_reported' → confidence tier reduced (not implemented at entity level, policy layer)
// - measurement_period_end > measurement_period_start
// - measured_at ≥ measurement_period_end (can't measure before period ends)
```

### 3.3 Entity Relationship Invariants

```
Account (1) ───< Opportunity (N) ───< ValueHypothesis (N)
    │                                   │
    │                                   │
    └───< Assumption (N) ──────────────┘    (hypothesis_id nullable)
                │
                ▼
           Evidence (N) ───> ValueHypothesis (optional)
                │
                └───> BusinessCase (1 per Opportunity, versioned)
                          │
                          └───> ValueCommitment (N)
                                    │
                                    └───< RealizationProof (N)
```

**Cross-Entity Invariants**:

1. **Tenant Isolation**: All queries must include `organization_id`. No cross-tenant references possible.

2. **Opportunity Consistency**: All entities with `opportunity_id` must reference same opportunity as their parent (if parent has opportunity scope).

3. **Business Case Immutability**: Once `status = 'presented'`, `hypothesis_snapshot` must not change. New version required for updates.

4. **Commitment Bounds**: Commitment values must fall within business case ranges (enforced at creation, not DB).

5. **Realization Period**: RealizationProof must reference commitment period that includes measurement period.

---

## 4. Claim Maturity Model

### 4.1 Maturity States

| State | Definition | Entry Requirements | Exit Triggers |
|-------|------------|-------------------|---------------|
| **Speculative** | Initial AI-generated hypothesis without human validation | DiscoveryAgent generates with silver-tier evidence | Human review initiated; Evidence upgraded; Rejected |
| **Validated** | Human-reviewed hypothesis passing integrity gates | Human-reviewed assumptions ≥ 80%; Evidence tier gold/platinum for high-confidence; `integrity_score ≥ 0.6`; `defense_readiness ≥ 0.8` | Business case creation; Superseded by better hypothesis; Rejected |
| **Committed** | Contractual promise frozen in business case | Business case status = 'approved'; Stakeholder explicit approval; System-locked context snapshot | Realization tracking initiated; Commitment cancelled; Renegotiated (new version) |
| **Proven** | Realized via external telemetry with documented variance | RealizationProof with `data_source_type ∈ (api, system_of_record)`; Measurement method documented; `variance_percentage` calculated | Becomes historical record; Supports expansion signals |

### 4.2 State Transition Rules

```
Speculative ──► Validated
├── All assumptions human-reviewed OR explicitly flagged for review
├── Evidence tier ≥ gold for claims with confidence > 0.7
├── IntegrityAgent score ≥ 0.6
├── No open critical violations
└── Human reviewer approval (explicit action)

Validated ──► Committed
├── BusinessCase created with hypothesis in snapshot
├── Case integrity_score ≥ 0.6 AND defense_readiness ≥ 0.8
├── Stakeholder approval captured (digital signature or explicit confirmation)
└── Opportunity status = 'closed_won' (contractual closure)

Committed ──► Proven
├── RealizationProof created with telemetry linkage
├── Measurement method documented
├── Variance calculated and within acceptable bounds OR escalation handled
└── Customer attestation OR system-of-record validation
```

### 4.3 Exception Transitions

| Exception | Handling | Audit Requirement |
|-----------|----------|-------------------|
| Validated → Superseded | New hypothesis invalidates old; old marked superseded with `superseded_by_id` | Reason for supersession captured |
| Committed → Cancelled | Contract terminated; commitment status changed; realization tracking stops | Cancellation reason; authorized by |
| Committed → Renegotiated | New business case version created; commitment linked to new case | Renegotiation trigger documented |
| Proven → Disputed | Customer disputes measurement; `is_disputed` flag set; resolution workflow | Dispute reason; resolution method |

### 4.4 Maturity and Evidence Tier Mapping

| Maturity | Minimum Evidence Tier | Confidence Ceiling | Human Review Required |
|------------|----------------------|-------------------|------------------------|
| Speculative | Silver | 0.7 | No |
| Validated | Gold | 0.9 | Yes (for >0.7 confidence) |
| Committed | Gold/Platinum | 1.0 | Yes (all stakeholders) |
| Proven | Platinum | N/A (measured) | N/A (system-generated) |

---

## 5. Architecture: Agents, Kernel, and Human Gates

### 5.1 Reasoning vs Deterministic Boundaries

| Task | Assigned To | Reasoning Allowed? | Deterministic? | Human Review? |
|------|-------------|-------------------|----------------|---------------|
| Hypothesis description generation | DiscoveryAgent (LLM) | Yes | No | No (initial) |
| Evidence tier classification | DiscoveryAgent (rules) | No | Yes | No |
| Cash flow structure proposal | ModelingAgent (LLM) | Yes (template-guided) | No | No |
| Financial calculations (NPV/IRR/ROI) | Economic Kernel | No | Yes | No |
| Sensitivity analysis | Economic Kernel | No | Yes | No |
| Evidence quality assessment | IntegrityAgent (rules + LLM assist) | Partial | Partial | No |
| Integrity violation detection | IntegrityAgent (rules) | No | Yes | No |
| Integrity score calculation | IntegrityAgent (formula) | No | Yes | No |
| Veto decision (pass/veto) | IntegrityAgent (threshold) | No | Yes | No |
| Veto override evaluation | Human reviewer | Yes | N/A | Yes (mandatory) |
| Commitment target setting | CommitmentAgent (LLM + constraints) | Yes | Partial | Yes (stakeholder) |
| Narrative generation | NarrativeAgent (LLM) | Yes | No | Yes (optional) |
| Variance calculation | RealizationAgent (formula) | No | Yes | No |
| Intervention recommendation | RealizationAgent (LLM) | Yes | No | Yes (CS manager) |
| Expansion signal detection | RealizationAgent (rules) | No | Yes | No |

### 5.2 Agent Specifications

#### DiscoveryAgent

**Purpose**: Generate speculative hypotheses from account context

**Input**:
- Account (domain, industry, ARR)
- Opportunity (stage, context)
- Ground Truth MCP query results (EDGAR, benchmarks)

**Output**:
- ValueHypothesis[] (status = 'speculative')
- Evidence[] (linked to hypotheses)
- ReasoningTrace (optional)

**Deterministic Constraints**:
- Evidence tier classification must follow rules (EDGAR → platinum, etc.)
- Confidence score algorithm (if auto-assigned)

**Failure Modes**:
- No ground truth data available → generate with low confidence, flag for manual enrichment
- LLM produces non-falsifiable claims → validation error, retry with constraints

#### ModelingAgent

**Purpose**: Structure financial models from validated hypotheses

**Input**:
- ValueHypothesis[] (status = 'validated')
- Assumption[]
- Economic Kernel (calculation engine)

**Output**:
- CashFlowProjection (structured, not calculated)
- AssumptionSensitivity[] (which assumptions drive variance)
- ScenarioDefinition[] (conservative/base/upside parameters)

**Handoff to Economic Kernel**:
```
ModelingAgent proposes structure →
Parser validates (assumptions exist, no new variables) →
Economic Kernel computes NPV/IRR/ROI/payback →
ModelingAgent receives results →
Generates BusinessCase with scenarios
```

**Deterministic Constraints**:
- All assumption references must resolve
- No new assumptions introduced in projection
- Scenario parameters must be within sensitivity bounds

#### IntegrityAgent

**Purpose**: Govern claim maturity transitions with veto authority

**Input**:
- BusinessCase (draft)
- ValueHypothesis[] (linked)
- Evidence[] (linked)
- Assumption[] (linked)

**Output**:
- IntegrityOutput:
  - `pass`: boolean
  - `score`: integrity_score
  - `defense_readiness`: defense_readiness_score
  - `violations`: Violation[]
  - `remediation_instructions`: string[]

**Veto Protocol**:
```
IF integrity_score < 0.6 → VETO
IF open critical violations exist → VETO
IF defense_readiness < 0.8 AND status = 'in_review' → WARNING (not veto, but flagged)

On VETO:
1. Block transition to 'in_review'
2. Provide specific remediation instructions
3. Log veto with full context
4. Allow human override with escalation (dual approval + justification)
```

**Deterministic Constraints**:
- Score formulas are fixed (until calibrated)
- Violation taxonomy is rule-based
- No LLM reasoning in veto decision itself

#### CommitmentAgent

**Purpose**: Convert models to contractual commitments with stakeholder approval

**Input**:
- BusinessCase (status = 'approved')
- Stakeholder selections
- Historical commitment patterns (optional ML guidance)

**Output**:
- ValueCommitment (draft)
- CommitmentMilestone[]
- CommitmentMetric[] (KPIs to track)

**Human Gates**:
- Stakeholder approval required for commitment activation
- Legal review required if `committed_value_high > $1M`
- Finance approval required if `timeframe_months > 36`

**Deterministic Constraints**:
- Commitment values must fall within business case ranges
- Milestones must sum to total timeframe
- Metrics must be measurable (have unit, data source identified)

#### RealizationAgent

**Purpose**: Track committed value vs. realized outcomes

**Input**:
- ValueCommitment (active)
- Telemetry data (from data sources)
- Historical realization patterns

**Output**:
- RealizationProof[]
- VarianceReport
- InterventionRecommendation[] (if variance > thresholds)
- ExpansionSignal[] (if realization > 110%)

**Telemetry Hierarchy (Priority)**:
1. Native API integration (Salesforce, ERP) → highest confidence
2. Customer-provided data feed (CSV, webhook) → medium confidence
3. Proxy data (UsageSummary, AssetAction) → "Proof-Lite" mode, medium confidence
4. Manual entry by CSM → lower confidence
5. Customer self-reported → lowest confidence, flagged

**Deterministic Constraints**:
- Variance calculation formula fixed
- Thresholds trigger specific responses (20% → intervention, etc.)
- Expansion signal at 110% (threshold provisional)

#### NarrativeAgent (Extension)

**Purpose**: Compose customer-facing business case documents

**Input**:
- BusinessCase (validated)
- Template selection
- Audience specification (executive, technical, finance)

**Output**:
- NarrativeDraft (structured content)
- ExportArtifact (PDF/PPTX)

**Deterministic Constraints**:
- Only validated hypotheses included
- Financial numbers must match Economic Kernel outputs exactly
- Source citations required for all claims

**Human Review**:
- Optional for internal drafts
- Required for customer-facing exports (legal/compliance)

### 5.3 Economic Kernel

**Purpose**: Deterministic financial calculations eliminating LLM hallucination

**Implementation**:
- Decimal.js for all monetary values (no floating-point)
- Immutable calculation records
- Full audit trail: inputs, formula version, timestamp

**Functions**:
```typescript
calculateNPV(cashFlows: Decimal[], discountRate: Decimal): Decimal
calculateIRR(cashFlows: Decimal[]): Decimal | null  // iterative solver
calculateROI(totalInvestment: Decimal, totalReturn: Decimal): Decimal
calculatePayback(cashFlows: Decimal[]): number  // months

// Sensitivity analysis
generateScenarios(
  baseAssumptions: Assumption[],
  sensitivityRanges: Map<UUID, [Decimal, Decimal]>
): ScenarioResult[]  // conservative, base, upside
```

**Validation**:
- Input schema validation before calculation
- Result bounds checking (flag if outside reasonable range)
- Cross-check: NPV(IRR) ≈ 0 (validation, not enforcement)

### 5.4 Human Review Gates

| Gate | Trigger | Approver | Override Possible? | Escalation Path |
|------|---------|----------|-------------------|-----------------|
| Assumption validation | source = 'customer_stated' | Value engineer | No (must review) | N/A |
| Hypothesis confidence > 0.7 | Confidence calculation | Value engineer | Yes (with justification) | Manager approval |
| Business case approval | Status = 'in_review' | Sales manager + value lead | Partial (integrity veto stands) | Executive override with audit |
| Commitment activation | Status transition | Stakeholder + legal (if >$1M) | No (contractual) | N/A |
| Narrative export | Customer-facing | Legal/compliance review | Yes (with redlines) | Risk acceptance documented |
| Realization dispute | is_disputed = true | Customer success + finance | Resolution negotiation | Arbitration process |

---

## 6. Current-State Audit

### 6.1 Capability Reality Matrix

| Capability | Target State | Current Reality | Gap Severity | Blocking? |
|------------|--------------|-----------------|--------------|-----------|
| **Value Case Creation** | Dashboard "Go" → creates Opportunity + initial Discovery | Dashboard "Go" button dead; Opportunities page works | **Critical** | Yes - primary entry point blocked |
| **AI Hypothesis Generation** | DiscoveryAgent generates evidence-linked hypotheses | OpportunityAgent exists; AgentThread hardcoded; no streaming | **Major** | Yes - core value proposition non-functional |
| **Financial Modeling** | ModelingAgent + Economic Kernel generates scenarios | ModelStage entirely hardcoded; no API integration | **Critical** | Yes - deterministic calculations not connected |
| **Integrity Validation** | IntegrityAgent scores + gates lifecycle transitions | IntegrityAgent implemented; stage hardcoded; no enforcement | **Major** | Yes - governance mechanism decorative |
| **Business Case Narrative** | NarrativeAgent generates PDF/PPTX exports | No NarrativeAgent exists; export panel non-functional | **Critical** | Yes - customer-facing artifact missing |
| **Value Commitment Tracking** | CommitmentAgent creates trackable promises | TargetAgent exists; not wired to commitment workflow | **Major** | Partial - backend logic exists, not connected |
| **Realization Tracking** | RealizationAgent pulls telemetry, calculates variance | RealizationAgent exists; no telemetry integrations | **Major** | Yes - "Truthful Telemetry" differentiator broken |
| **Agent Streaming UI** | Real-time hypothesis generation feedback | AgentThread hardcoded; no WebSocket streaming | **Moderate** | No - UX degradation, not functional blocker |
| **CRM Integration** | Bi-directional Salesforce sync | Integrations page decorative; no OAuth/API connection | **Moderate** | No - limits enterprise adoption |
| **Settings Persistence** | User preferences saved to backend | Settings UI exists; no persistence | **Minor** | No - friction, not blocking |
| **Version History** | Full case versioning with rollback | Version concept in schema; no implementation | **Moderate** | No - audit requirement not met |
| **Evidence Drawer** | Browse and manage evidence library | Schema exists; no UI implementation | **Minor** | No - trust mechanism incomplete |

### 6.2 Agent Implementation Status

| Agent | Exists? | Functional? | Wired to UI? | Production-Credible? |
|-------|---------|-------------|--------------|---------------------|
| OpportunityAgent | Yes | Partial | No | No |
| FinancialModelingAgent | Yes | Partial | No | No |
| TargetAgent | Yes | Partial | No | No |
| IntegrityAgent | Yes | Partial | No | No |
| RealizationAgent | Yes | Partial | No | No |
| ExpansionAgent | Yes | Partial | No | No |
| ComplianceAuditorAgent | Yes | Stub | No | No |
| **NarrativeAgent** | **No** | **N/A** | **N/A** | **No** |

### 6.3 Technical Debt Assessment

| Debt Item | Severity | Impact | Resolution Estimate | Owner |
|-----------|----------|--------|---------------------|-------|
| Hardcoded ModelStage | Critical | Core value proposition mocked | 12 hrs | Full-stack |
| AgentThread mocking | Major | Real-time UX broken | 16 hrs | Backend |
| Missing NarrativeAgent | Critical | Customer artifact missing | 16-24 hrs | Backend |
| No telemetry integrations | Critical | Differentiator broken | 24-40 hrs | Backend |
| Integrity gate not enforced | Major | Governance mechanism decorative | 8 hrs | Full-stack |
| CRM integrations decorative | Moderate | Enterprise adoption blocked | 16 hrs | Backend |
| No version history implementation | Moderate | Audit requirement unmet | 16 hrs | Full-stack |
| Settings not persisted | Minor | UX friction | 4 hrs | Frontend |

---

## 7. Risk & Failure Modes

### 7.1 Failure Mode Analysis

| Scenario | Failure Point | Consequence | Mitigation | Detection |
|----------|---------------|-------------|------------|-----------|
| **Telemetry Never Arrives** | RealizationAgent has no data source | RealizationProof cannot be created; commitments remain unproven; "Truthful Telemetry" claim broken | Proof-Lite mode: proxy data from Salesforce; manual entry workflow; customer attestation with reduced confidence | Monitoring: % commitments with data_source_type = null; Alert if >20% stale |
| **Evidence Mostly Silver-Tier** | Low-quality evidence for high-confidence claims | Integrity scores artificially low; sales blocked; or integrity threshold lowered, credibility risk | Tier upgrade workflow; manual evidence enrichment; confidence ceiling per tier | Evidence tier distribution dashboard; Alert if >30% high-confidence with silver-only |
| **High Hypothesis Confidence, Weak Assumptions** | LLM overconfident; grounding score high but assumptions untested | Claims presented as validated but fail realization; customer trust erosion; churn | Assumption sensitivity analysis; Monte Carlo validation; human review gate for all assumptions | Variance analysis: compare predicted vs realized by assumption source |
| **Realization Measured Against Wrong Case Version** | BusinessCase regenerated; commitment linked to old version; realization applied to new | Variance calculation meaningless; customer disputes; legal exposure | Frozen context snapshots; version linking; explicit case version in commitment | Audit query: commitment.business_case_version vs realization.case_version |
| **Customer Disputes Measurement Method** | Different calculation methodology; metric definition ambiguity | Relationship conflict; realization status unclear; expansion signal false | Pre-negotiated metric definitions; explicit measurement method documentation; dispute workflow | Dispute tracking: is_disputed flag; resolution time; escalation rate |
| **Sales Team Rejects Integrity Veto** | Rep has $2M deal; IntegrityAgent blocks; quarter-end pressure | Workaround creation; shadow processes; data integrity erosion; system abandonment | Escalation workflow; override with dual approval; executive risk acceptance; explicit remediation instructions | Override tracking: % vetoes overridden; reason distribution; correlation with deal outcomes |
| **Integrity Score Formula Miscalibrated** | Thresholds don't predict customer acceptance | False positives (good deals blocked); false negatives (bad deals approved); loss of trust in system | Quarterly calibration; outcome tracking; A/B testing; score versioning | Calibration dashboard: score correlation with acceptance; threshold optimization suggestions |
| **LLM Hallucination in Cash Flow Structure** | ModelingAgent invents assumptions not in system | Economic Kernel calculates from bad inputs; financial numbers wrong; credibility kill | Schema validation; assumption reference checking; human review for structure changes | Structure audit: assumptions_used vs system assumptions; flag new assumption introduction |
| **Data Decay (6-Month Dropoff)** | Customer stops providing telemetry after initial enthusiasm | Realization tracking stops; commitments drift; renewal risk | Automated reminder workflows; CSM alerts; contract terms requiring data sharing; Proof-Lite mode | Telemetry recency dashboard; Alert if >30 days since last proof |
| **Bitemporal Complexity Overwhelms Team** | valid_from/to handling errors; temporal queries wrong | Historical reconstruction fails; audit queries incorrect; compliance risk | Start with hooks only; explicit temporal query patterns; automated testing | Temporal query test suite; data quality checks; reconciliation reports |
| **Decimal.js Serialization Errors** | API converts Decimal to float; precision lost | Financial calculations use corrupted values; silent errors | Schema enforcement; API validation; type checking at all boundaries | Serialization test suite; integration tests with known decimal values |
| **Assumption Supersedes Without Propagation** | Assumption updated; old hypothesis not marked superseded | Multiple conflicting claims active; BusinessCase includes stale data | Supersession workflow; cascade updates; version linking | Active assumption count per hypothesis; supersession audit |

### 7.2 Risk Severity Matrix

| Risk | Likelihood | Impact | Risk Level | Owner |
|------|------------|--------|------------|-------|
| Telemetry never arrives | High | Critical | **Severe** | Product |
| Sales rejects integrity veto | High | High | **Severe** | Sales Enablement |
| Evidence mostly silver-tier | Medium | High | **Major** | Data Science |
| Customer disputes measurement | Medium | High | **Major** | Customer Success |
| LLM hallucination in structure | Medium | Critical | **Major** | Engineering |
| Integrity score miscalibrated | Medium | High | **Major** | Data Science |
| Data decay (6-month dropoff) | High | Medium | **Major** | Customer Success |
| Realization against wrong version | Low | Critical | **Moderate** | Engineering |
| High confidence, weak assumptions | Medium | Medium | **Moderate** | Value Engineering |
| Decimal.js serialization | Low | Critical | **Moderate** | Engineering |
| Bitemporal complexity | Medium | Low | **Minor** | Engineering |

---

## 8. Migration Plan

### 8.1 Phase 1: Honest Demo (Immediate - 1 Week)

**Goal**: Close most embarrassing gaps for credible demos

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|---------------------|
| Wire Dashboard "Go" button to `useCreateCase()` | 2 hrs | Frontend | Button creates opportunity, navigates to discovery |
| Add "API Unavailable" fallbacks where hardcoded | 4 hrs | Frontend | User sees clear status when backend not connected |
| Implement basic NarrativeAgent | 16 hrs | Backend | Generates Executive Summary PDF from BusinessCase |
| Create `/api/v1/cases/:id/narrative/run` endpoint | 4 hrs | Backend | Returns PDF URL; includes error handling |
| Fix lint/tsc errors blocking build | 2 hrs | Frontend | Clean build; no blocking errors |

**Exit Criteria**: All major buttons have real handlers; no dead UI elements; demo can flow end-to-end with real API calls (even if backend partially stubbed).

### 8.2 Phase 2: Beta-Ready (Weeks 2-4)

**Goal**: Close P0 and P1 gaps for closed beta

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|---------------------|
| ModelStage real API: GET/POST financial models | 12 hrs | Full-stack | UI shows real Economic Kernel outputs; no hardcoded data |
| IntegrityStage real API: GET integrity status | 8 hrs | Full-stack | Integrity scores calculated from real evidence/assumptions |
| AgentThread WebSocket streaming | 16 hrs | Backend | Real-time hypothesis generation visible in UI |
| Settings persistence | 4 hrs | Frontend | User preferences survive page reload |
| CRM integration actual wiring (Salesforce OAuth) | 16 hrs | Backend | OAuth flow complete; can query Salesforce data |
| Implement Proof-Lite mode (Salesforce proxy data) | 8 hrs | Backend | RealizationAgent pulls from AssetAction/UsageSummary |
| Implement integrity_score < 0.6 enforcement | 4 hrs | Full-stack | Stage transition blocked; remediation shown |

**Exit Criteria**: 3-5 customers can use system end-to-end; all core flows functional; no mocked data in critical paths.

### 8.3 Phase 3: Production-Credible (Weeks 4-6)

**Goal**: Audit-ready, enterprise-deployable

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|---------------------|
| Version history with rollback | 16 hrs | Full-stack | Can view prior versions; restore if needed |
| Evidence drawer with browsing | 8 hrs | Frontend | Can view, filter, manage evidence library |
| Complete audit trail | 8 hrs | Backend | All entity changes logged with actor/timestamp |
| RLS policy audit and fixes | 4 hrs | Backend | Security review passed; no data leakage |
| Performance optimization (query indexing) | 8 hrs | Backend | Complex lineage queries < 10s |
| Implement bitemporal tracking (basic) | 12 hrs | Backend | valid_from/to populated; queries respect temporal filters |
| Scoring formula calibration (baseline) | 8 hrs | Data Science | Initial calibration data collected; methodology documented |

**Exit Criteria**: Production release with enterprise security review passed; SOC 2 readiness demonstrated.

### 8.4 Phase 4: Differentiated (Weeks 6-10)

**Goal**: Unrivaled capabilities; category leadership

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|---------------------|
| Ontology-agent integration (competitive context) | 24 hrs | Full-stack | Account competitive analysis auto-populated |
| Full bitemporal implementation | 16 hrs | Backend | Historical queries work; audit reconstruction possible |
| Synthetic data generation for testing | 16 hrs | Backend | Can generate realistic test scenarios without customer data |
| Advanced realization analytics | 16 hrs | Backend | Trend analysis; prediction; cohort comparison |
| Scoring formula auto-calibration | 16 hrs | Data Science | Quarterly rebalancing based on outcomes |
| Expansion signal automation | 8 hrs | Backend | >110% realization auto-creates expansion opportunity |
| Multi-tenant performance isolation | 12 hrs | Backend | Noisy neighbor elimination; resource quotas |

**Exit Criteria**: Category-leading value orchestration platform; G2/Forrester recognition; reference customers willing to speak.

### 8.5 Validation Milestones

| Phase | Validation Criteria | Measurement Method |
|-------|---------------------|-------------------|
| Phase 1 | Demo completion rate > 90% | Demo session recordings; completion tracking |
| Phase 2 | Beta customer activation > 80% | Onboarding funnel; first-value-time |
| Phase 2 | Integrity score correlation > 0.5 | Score vs customer acceptance correlation (baseline) |
| Phase 3 | Security audit passed | Third-party penetration test; SOC 2 readiness |
| Phase 3 | Query performance < 10s | Load testing; query timing logs |
| Phase 4 | Realization tracking coverage > 80% | % commitments with data_source_type ≠ null |
| Phase 4 | Model-to-reality accuracy > 70% | Realized value within committed range |
| Phase 4 | Customer NPS > 50 | Quarterly survey; reference willingness |

---

## 9. Appendices

### Appendix A: JSON Schema (ValueHypothesis - Canonical)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valynt.io/schemas/ValueHypothesis.json",
  "title": "ValueHypothesis",
  "description": "A testable claim about business value creation with explicit maturity state",
  "type": "object",
  "required": [
    "id", "organization_id", "opportunity_id", "description",
    "category", "estimated_value_low", "estimated_value_high",
    "value_unit", "timeframe_months", "confidence", "status",
    "created_by_agent", "valid_from"
  ],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "organization_id": { "type": "string", "format": "uuid" },
    "opportunity_id": { "type": "string", "format": "uuid" },
    "description": {
      "type": "string",
      "minLength": 10,
      "maxLength": 2000,
      "description": "Falsifiable claim statement with measurable metric"
    },
    "category": {
      "type": "string",
      "enum": ["revenue_growth", "cost_reduction", "risk_mitigation", "capital_efficiency"]
    },
    "estimated_value_low": {
      "type": "string",
      "pattern": "^-?\\d+(\\.\\d+)?$",
      "description": "Decimal as string to preserve precision"
    },
    "estimated_value_high": {
      "type": "string",
      "pattern": "^-?\\d+ (\\.\\d+)?$",
      "description": "Decimal as string; must be > estimated_value_low"
    },
    "value_unit": {
      "type": "string",
      "enum": ["usd", "percent", "hours", "headcount", "days"]
    },
    "timeframe_months": { "type": "integer", "minimum": 1, "maximum": 120 },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "status": {
      "type": "string",
      "enum": ["proposed", "under_review", "validated", "rejected", "superseded"]
    },
    "created_by_agent": { "type": "string" },
    "reasoning_trace_id": { "type": "string", "format": "uuid" },
    "valid_from": { "type": "string", "format": "date-time" },
    "valid_to": { "type": "string", "format": "date-time" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

### Appendix B: SQL DDL (Core Tables)

```sql
-- Core entities with constraints
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    primary_domain VARCHAR(255) NOT NULL,
    industry_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, primary_domain)
);

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id),
    name VARCHAR(255) NOT NULL,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('discovery', 'modeling', 'targeting', 'validating', 'composing', 'committing', 'realizing', 'expansion', 'archived')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'on_hold', 'closed_won', 'closed_lost')),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    expected_close_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE value_hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id),
    description TEXT NOT NULL CHECK (LENGTH(description) >= 10),
    category VARCHAR(50) NOT NULL CHECK (category IN ('revenue_growth', 'cost_reduction', 'risk_mitigation', 'capital_efficiency')),
    estimated_value_low DECIMAL(19,4) NOT NULL,
    estimated_value_high DECIMAL(19,4) NOT NULL,
    value_unit VARCHAR(20) NOT NULL,
    timeframe_months INTEGER NOT NULL CHECK (timeframe_months BETWEEN 1 AND 120),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    status VARCHAR(50) NOT NULL CHECK (status IN ('proposed', 'under_review', 'validated', 'rejected', 'superseded')),
    created_by_agent VARCHAR(100) NOT NULL,
    reasoning_trace_id UUID,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (estimated_value_low < estimated_value_high)
);

-- RLS policies (tenant isolation)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_accounts ON accounts
    USING (organization_id = current_setting('app.current_tenant')::UUID);

-- Indexes for performance
CREATE INDEX idx_opportunities_account ON opportunities(account_id);
CREATE INDEX idx_hypotheses_opportunity ON value_hypotheses(opportunity_id);
CREATE INDEX idx_hypotheses_status ON value_hypotheses(status);
CREATE INDEX idx_hypotheses_valid_time ON value_hypotheses(valid_from, valid_to);
```

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Claim Maturity** | The progression of a value claim through speculative → validated → committed → proven states |
| **Defense Readiness Score** | Measures auditability of value case data; weighted average of assumption validation and evidence quality |
| **Economic Kernel** | Deterministic calculation engine for NPV, IRR, ROI, payback using Decimal.js |
| **Evidence Tier** | Classification of evidence quality: silver (internal), gold (attributed third-party), platinum (audited) |
| **Integrity Score** | Composite measure of claim validity; gates lifecycle transitions |
| **IntegrityAgent** | System component with veto authority over claim maturity transitions |
| **Proof-Lite Mode** | Fallback telemetry using proxy data (Salesforce usage) when native ERP integration unavailable |
| **RealizationProof** | Record of actual value measured against committed target |
| **Speculative Claim** | Initial AI-generated hypothesis without human validation |
| **Truthful Telemetry** | Core differentiator: value claims connected to actual customer outcomes via external system data |
| **ValueCommitment** | Contractual promise derived from validated business case |
| **ValueHypothesis** | Falsifiable claim about economic value creation |

---

**Document Classification**: Architecture Review Memo with Claim Audit  
**Recommended Review Cadence**: Quarterly (or when claim status changes significantly)  
**Distribution**: Engineering, Product, Data Science, Executive Leadership  

---

*This document explicitly separates what exists, what is designed, what is hypothesized, and what is marketed. All claims are auditable.*
