# Valynt Strategic Framework: The Cognitive Harness Architecture

**Document Type**: Strategic Positioning & Product Architecture  
**Version**: v1.0-SF  
**Date**: 2026-03-23  
**Status**: Strategic Framework (Integration with ARM v2.0)  

---

## Executive Summary

### The Strategic Reframe

Valynt is not an ROI calculator. Valynt is the **Industrial Intelligence Stack for Business Value**—a cognitive harness that makes abstract AI cognition legible to the CFO.

### The Paradigm Shift

Current AI value demonstration relies on **heroics**: clever prompting, one-off scripts, manual spreadsheet reconciliation. Valynt introduces **abundance** through predictable, deterministic economic routing.

### The Core Market Promise

POCs are easy; CFO-defensible ROI is hard. Valynt closes this gap by treating value as a **computable, auditable, and trackable artifact**.

### The End Game

By tracking "Commit vs. Actual" through Outcome Validation Pairs, Valynt becomes the **trusted third-party ledger** enabling software vendors to guarantee results. This unlocks outcome-based contracts as a new pricing model.

### Strategic Claim Audit (Preliminary)

| Claim | Type | Evidence | Risk | Status |
|-------|------|----------|------|--------|
| "Industrial Intelligence Stack for Business Value" | Positioning | Category creation narrative | Market education burden; category timing | **Marketing** |
| "Heroics → Abundance" paradigm shift | Positioning | Contrast with current practice | Requires behavior change; adoption friction | **Marketing** |
| "CFO-defensible ROI" | Product | Economic Kernel + telemetry validation | Telemetry integrations missing; "defensible" unproven | **Partially Supported** |
| "Trusted third-party ledger" | Vision | Blockchain-style trust model suggested | Centralized platform, not distributed ledger; trust model unspecified | **Aspirational** |
| "Outcome-based contracts" | Market | Trend in SaaS pricing | Requires customer willingness; legal complexity; precedent limited | **Hypothesis** |

---

## 1. Strategic Positioning: The Harness Builder

### 1.1 Market Category Definition

**Current Category**: Value Selling Tools / ROI Calculators / Sales Enablement  
**Proposed Category**: Industrial Intelligence Stack for Business Value  

**Category Components**:
1. **Cognitive Harness**: Structures LLM reasoning into deterministic outputs
2. **Economic Kernel**: Audit-grade financial calculation engine
3. **Domain Ecosystem**: Semantic routing for industry-specific vocabulary
4. **Integration Layer**: Feedback loops from systems of record

### 1.2 Competitive Positioning Matrix

| Approach | Heroics Required? | Deterministic? | CFO-Defensible? | Current Players |
|----------|-------------------|----------------|-----------------|-----------------|
| Manual ROI spreadsheets | High (craftsmanship) | No | No | Sales consultants |
| Traditional value calculators | Medium (configuration) | Partial | Weak | Value selling tools (ValueSelling, etc.) |
| Generic LLM prompts | High (prompt engineering) | No | No | ChatGPT, Claude direct use |
| **Valynt (proposed)** | Low (harness-guided) | Yes | Designed | **None directly** |

### 1.3 Value Proposition Hierarchy

**For the Sales Rep**:
- 5-minute value case creation (vs. hours of spreadsheet work)
- Automatic evidence linking (no manual research)
- Integrity-gated proposals (no bad deals advance)

**For the Value Engineer**:
- Deterministic financial calculations (no formula errors)
- Audit-grade lineage (every number traceable)
- Scenario comparison (conservative/base/upside)

**For the CFO**:
- Truthful telemetry (claims validated against actuals)
- Outcome tracking (realized vs. committed)
- Risk-adjusted projections (sensitivity analysis)

**For the Software Vendor**:
- Valynt Verified program (third-party validation)
- Outcome-based pricing enablement (guarantee results)
- Churn reduction (proof of continuous value)

---

## 2. Product Architecture: The Cognitive Harness

### 2.1 Architecture Mapping (Strategic → Technical)

| Strategic Layer | Technical Component | ARM Section | Status |
|-----------------|---------------------|-------------|--------|
| **Layer 1: Value Kernel** | Economic Kernel + Financial Ground Truth + Value Reasoning Traces | 3.2 (entities), 5.3 (kernel) | Partially implemented |
| **Layer 2: Domain Ecosystem** | Persona Maps + Industry Templates + Economic Narrative | Not in ARM (new concept) | **Conceptual** |
| **Layer 3: Integration Layer** | Lifecycle Reasoning + Outcome Validation Pairs | 5.2 (RealizationAgent), 3.2 (RealizationProof) | Partially implemented |

### 2.2 Layer 1: The Value Kernel (Invariant Core)

**Purpose**: Deterministic math engine that LLMs cannot alter—only feed variables into.

**Components**:

#### Financial Ground Truth Database
```typescript
interface FinancialGroundTruth {
  id: UUID;
  metric_name: string;           // "Labor Rate", "Error Rate", "OEE Baseline"
  metric_value: Decimal;         // Exact figure
  unit: string;                  // "USD/hr", "%", "hours"
  source: GroundTruthSource;     // BLS | Gartner | Industry Association | Customer Stated
  domain: string;                // "manufacturing", "saas", "healthcare"
  valid_from: Date;
  valid_to: Date | null;
  confidence_tier: EvidenceTier;  // gold | platinum
}
```

**Constraint on LLM**: All value calculations must reference entries in this database. The LLM cannot invent figures.

#### Value Reasoning Traces

**Required JSON Schema Output** (LLM must conform):

```typescript
interface ValueReasoningTrace {
  trace_id: UUID;
  opportunity_id: UUID;
  
  // Cognitive chain (enforced structure)
  pain_statement: string;        // Customer's stated problem
  capability_mapping: string;      // How product solves it
  outcome_prediction: string;      // Measurable business outcome
  kpi_definition: string;        // Specific metric and unit
  financial_impact: FinancialCalculation;  // References Ground Truth
  
  // Validation
  ground_truth_refs: UUID[];     // Must reference >= 1 FinancialGroundTruth
  confidence_score: number;      // 0.0-1.0 (enforced ceiling per evidence tier)
  
  // Provenance
  generated_by: string;            // Agent/model identifier
  generated_at: Timestamp;
  human_reviewed: boolean;
}
```

**Harness Action**: The LLM is forced through this cognitive chain. It cannot skip from "pain" directly to "financial impact" without defining the intermediate steps.

**Mapping to ARM**:
- `ValueReasoningTrace` → extends `ValueHypothesis` (adds structured reasoning)
- `FinancialGroundTruth` → extends `Evidence` (adds domain-specific baselines)
- Enforcement → `IntegrityAgent` validation (new rule: all calculations must reference Ground Truth)

### 2.3 Layer 2: The Domain Ecosystem (Extensible Layer)

**Purpose**: Semantic routing layer that gives LLM correct vocabulary without rewriting core software.

**Components**:

#### Persona & Industry Maps

```typescript
interface DomainPersonaMap {
  id: UUID;
  domain: string;                // "manufacturing", "saas", "healthcare"
  persona: string;               // "VP Engineering", "CFO", "CIO"
  
  // Vocabulary injection
  priority_metrics: string[];    // What this persona cares about
  template_phrases: string[];    // Language they use
  risk_language: string[];     // How they talk about uncertainty
  
  // Narrative structure
  executive_summary_template: string;  // Markdown with placeholders
  financial_summary_template: string;
  risk_discussion_template: string;
}
```

**Example: Manufacturing VP of Engineering**
```yaml
domain: manufacturing
persona: vp_engineering
priority_metrics:
  - OEE (Overall Equipment Effectiveness)
  - Cycle Time
  - Yield Rate
  - Downtime Reduction
template_phrases:
  - "Production throughput"
  - "Line efficiency"
  - "Quality control"
risk_language:
  - "Implementation risk"
  - "Change management"
  - "Integration complexity"
```

**Example: SaaS CFO**
```yaml
domain: saas
persona: cfo
priority_metrics:
  - EBITDA Impact
  - CAC Efficiency
  - Net Revenue Retention
  - Payback Period
template_phrases:
  - "Bottom line impact"
  - "Cash flow optimization"
  - "Capital efficiency"
risk_language:
  - "Margin compression"
  - "Forecast variance"
  - "Implementation cost"
```

**Harness Action**: When user selects domain + persona, system injects corresponding map into LLM context. Narrative generation uses domain-specific templates.

**Gap from ARM**: This is a new concept not present in the current architecture. Requires:
- New entity: `DomainPersonaMap`
- Modified `NarrativeAgent` to accept persona parameter
- Template management system
- UI: persona/domain selector

#### Economic Narrative Generation

**Process**:
1. Value Kernel outputs: `(metric_value, ground_truth_refs, sensitivity_range)`
2. Domain Ecosystem injects: `(persona_template, priority_metrics, risk_language)`
3. NarrativeAgent combines into: `ExecutiveSummary` tailored to persona

**Example Transformation**:

**Kernel Output**:
```json
{
  "metric": "Labor Savings",
  "value": "$673,000/year",
  "basis": "Labor Rate $65/hr × 10,346 hrs saved",
  "sensitivity": "±15% based on actual hours"
}
```

**Narrative (VP Engineering)**:
> "This initiative directly addresses your OEE improvement target by eliminating 10,346 hours of manual intervention annually—equivalent to 5.2 FTEs redeployed to higher-value production tasks. Based on validated industry labor rates, this represents $673K in recoverable capacity."

**Narrative (CFO)**:
> "This initiative delivers $673K annual EBITDA impact through labor cost avoidance. At current margins, this represents 2.3% operating leverage improvement with 15% variance tolerance based on conservative assumptions."

**Same math, different story**.

### 2.4 Layer 3: The Integration Layer (Reality Check)

**Purpose**: Feedback loops from systems of record that validate commitments against actuals.

**Components**:

#### Lifecycle Reasoning

**CRM Stage Integration**:

| CRM Stage | Harness Trigger | LLM Action | Output |
|-----------|---------------|------------|--------|
| Discovery | Opportunity created | Generate initial hypotheses (speculative) | ValueHypothesis[] |
| Proposal | Business case presentation | Lock case version; generate commitment terms | ValueCommitment |
| Closed Won | Contract signed | Activate realization tracking | Tracking setup |
| QBR (Quarterly) | Scheduled review | Compare committed vs. actual; generate variance report | RealizationProof + InterventionRec |
| Renewal | 90 days before expiry | Summarize realized value; expansion recommendations | Renewal narrative |

**Gap from ARM**: ARM mentions CRM integration but doesn't specify this stage-aware prompting. Requires:
- CRM webhook/event integration
- Stage detection logic
- Prompt template per stage

#### Outcome Validation Pairs

```typescript
interface OutcomeValidationPair {
  id: UUID;
  commitment_id: UUID;
  
  // The commitment
  committed_metric: string;      // KPI that was promised
  committed_value: Decimal;      // Target value
  committed_timeframe: DateRange;
  
  // The validation
  actual_value: Decimal;         // Measured value
  data_source: string;           // ERP, MES, Salesforce
  measurement_method: string;  // SQL query, API call
  variance_percentage: Decimal;  // ((actual - committed) / committed)
  
  // The judgment
  validation_status: ValidationStatus;  // validated | disputed | adjusted
  
  measured_at: Timestamp;
}
```

**The "Commit vs. Actual" Ledger**:

| Metric | Committed | Actual | Variance | Source | Status |
|--------|-----------|--------|----------|--------|--------|
| Labor Savings | $450K/year | $388K/year | -13.8% | ERP payroll export | Validated |
| Error Reduction | 35% improvement | 28% improvement | -20% | MES quality logs | Disputed |
| Throughput Gain | 12% increase | 15% increase | +25% | Production system | Validated |

**Gap from ARM**: ARM has `RealizationProof` but doesn't emphasize this "pair" framing. The "trusted ledger" concept requires explicit commitment/actual linkage.

---

## 3. UX/UI Execution: "Blow Them Away" Mechanics

### 3.1 The Instant Translation

**Feature**: Audience toggle (VP Engineering ↔ CFO)  
**Interaction**: Single click switches entire proposal narrative  
**Harness Action**:
1. UI sends: `setPersona('cfo')`
2. System loads: `DomainPersonaMap` for current domain + CFO
3. NarrativeAgent regenerates: Executive summary using CFO template
4. Kernel holds: Same financial calculations (invariant)
5. UI updates: All text sections, priority metrics highlighted

**Technical Implementation**:
```typescript
// API endpoint
POST /api/v1/cases/:id/narrative/regenerate
{
  "persona": "cfo",
  "preserve_calculations": true  // Kernel output locked
}

// Response
{
  "narrative": "This initiative delivers $673K annual EBITDA impact...",
  "kernel_checksum": "a1b2c3d4...",  // Verification that math unchanged
  "template_used": "saas_cfo_executive_summary_v2"
}
```

### 3.2 The Auditable Dollar

**Feature**: Click any number → side panel with full provenance  
**Interaction**: User clicks "$673K/yr savings"  
**Panel Content**:
1. **Value Reasoning Trace** (cognitive chain)
2. **Kernel Calculation** (formula, inputs, outputs)
3. **Ground Truth Citations** (source, date, confidence)
4. **Assumption Sensitivity** (what happens at 80% vs 100% adoption)

**Technical Implementation**:
```typescript
// UI component
<AuditableNumber 
  value={savingsEstimate}
  traceId={reasoningTraceId}
  onClick={() => openSidePanel(traceId)}
/>

// Side panel content structure
{
  "trace": {
    "pain": "Manual inventory tracking causing stockouts",
    "capability": "Automated RFID tracking",
    "outcome": "95% inventory accuracy",
    "kpi": "Stockout reduction",
    "financial": "$673K/year"
  },
  "kernel_calculation": {
    "formula": "stockouts_before × cost_per_stockout - stockouts_after × cost_per_stockout",
    "inputs": {
      "stockouts_before": 47,
      "stockouts_after": 2,
      "cost_per_stockout": "$15,000 (Gartner 2024)"
    },
    "output": "$673,000/year"
  },
  "ground_truth": [
    {
      "metric": "Cost per stockout",
      "value": "$15,000",
      "source": "Gartner Supply Chain Report 2024",
      "tier": "gold"
    }
  ]
}
```

### 3.3 The "What-If" Slider

**Feature**: Drag slider to adjust assumption → real-time recalculation  
**Interaction**: User drags "Adoption Rate" from 80% → 60%  
**Harness Action**:
1. UI sends: `updateAssumption('adoption_rate', 0.6)`
2. Kernel recalculates: Full financial model deterministically
3. LLM regenerates: Risk summary based on new boundaries
4. Charts update: Sensitivity visualization

**Technical Implementation**:
```typescript
// Real-time calculation
const handleSliderChange = async (assumptionId: string, newValue: number) => {
  // 1. Update assumption
  await updateAssumption(caseId, assumptionId, newValue);
  
  // 2. Kernel recalculation (< 100ms target)
  const newModel = await economicKernel.recalculate(caseId);
  
  // 3. LLM risk summary (streaming)
  const riskStream = await narrativeAgent.generateRiskSummary(caseId, {
    sensitivity: newModel.sensitivity_analysis,
    scenario: 'conservative'
  });
  
  // 4. UI updates
  updateCharts(newModel.scenarios);
  streamText(riskStream);
};
```

**Performance Requirements**:
- Kernel recalculation: < 100ms
- Narrative generation: < 3s (streaming)
- Total UX latency: < 3.5s

---

## 4. Go-to-Market & Institutionalization

### 4.1 Target Market Prioritization

#### Target Market 1: Manufacturing, Robotics, & IoT

**Why First?**
- **Measurable unit economics**: Physical metrics (OEE, yield, downtime) directly translate to dollars
- **High impact**: 1% improvement = millions in savings
- **AI feasibility alignment**: Infrastructure costs (edge compute, latency) fit Valynt's strict modeling
- **Buyer sophistication**: Engineers understand measurable outcomes

**Entry Verticals** (prioritized):
1. **Automotive manufacturing**: High volume, tight margins, proven ROI culture
2. **Semiconductor fabrication**: Extreme precision, high cost of defects
3. **Industrial robotics**: OEE-focused, hardware/software integration

**Domain-Specific Ground Truth Requirements**:
- OEE baselines by equipment type
- Labor rates by region and skill level
- Downtime cost models
- Quality defect cost curves

#### Target Market 2: Enterprise SaaS

**Why Second?**
- **Market timing**: Shift from "growth at all costs" to efficiency
- **Churn urgency**: Vendors need proof of value to prevent churn
- **Metric availability**: SaaS metrics (CAC, NRR, LTV) are standardized

**Entry Verticals**:
1. **Revenue Operations**: Direct ownership of SaaS metrics
2. **Customer Success**: Churn prevention mandate
3. **Finance**: Cost optimization pressure

**Domain-Specific Ground Truth Requirements**:
- CAC benchmarks by company size and growth rate
- NRR targets by industry
- Implementation cost models
- Time-to-value benchmarks

### 4.2 The "Valynt Verified" Program

**Program Concept**: Third-party validation seal for software vendors using Valynt platform

**Mechanics**:

#### Phase 1: Proposal Validation
- Vendor uses Valynt to generate business case
- Valynt IntegrityAgent scores case (defense_readiness, integrity_score)
- Cases scoring ≥ 0.8 defense readiness receive "Valynt Verified Proposal" badge
- Badge links to audit trail (customer can verify)

#### Phase 2: Commitment Validation
- Vendor and customer agree on ValueCommitment via Valynt
- Terms locked in platform with digital signatures
- Contract includes telemetry sharing clause

#### Phase 3: Realization Validation
- Valynt pulls actual telemetry (ERP, CRM, etc.)
- RealizationProof generated with variance analysis
- If realized ≥ 90% of committed: "Valynt Verified Outcome" badge
- If realized < 90%: Escalation and remediation workflow

**Program Benefits**:

**For Software Vendors**:
- Differentiation in competitive deals
- Faster sales cycles (trust acceleration)
- Outcome-based pricing enablement
- Churn reduction (proof of value)

**For Buyers**:
- Reduced vendor evaluation risk
- Audit trail of claims
- Post-purchase protection (if outcome not realized, contract terms trigger)
- Industry benchmark access

**For Valynt**:
- Network effects (more vendors → more buyers → more data)
- Data moat (outcome database enables benchmarking)
- Platform stickiness (verified vendors don't switch)

### 4.3 Outcome-Based Pricing Enablement

**Traditional Pricing**: Per-seat, per-usage, or flat fee  
**Outcome-Based Pricing**: Fee contingent on realized value

**Valynt Enables This By**:
1. **Pre-sale**: Vendor generates "Valynt Verified Proposal" with committed outcomes
2. **Contract**: Outcome terms embedded in contract (e.g., "$50K base + 10% of realized savings")
3. **Post-sale**: Valynt tracks actuals via Outcome Validation Pairs
4. **Billing**: Invoice amount calculated from realized value (via API to billing system)
5. **Dispute resolution**: Audit trail provides neutral ground truth

**Example Contract Terms**:

```
Base Fee: $50,000/year
Variable Fee: 10% of realized labor savings, capped at $100,000/year

Commitment (Valynt Verified):
- Labor savings: $400,000-$500,000/year
- Realization timeline: 6 months

Measurement:
- Source: Customer ERP payroll export
- Method: Pre/post FTE comparison
- Validation: Quarterly Valynt reconciliation

Trigger: If realized savings < $300,000 by month 9, base fee reduced 50%
```

**Legal and Financial Complexity**:
- Requires customer data sharing agreement
- Baseline measurement methodology must be agreed
- Dispute resolution process (who decides if measurement valid?)
- Insurance/escrow for variable fee uncertainty

**Status**: Conceptual. Requires legal framework development and pilot customers.

---

## 5. Strategic-Technical Gap Analysis

### 5.1 What's New vs. ARM

| Strategic Concept | ARM Equivalent | Gap |
|-------------------|----------------|-----|
| Value Kernel | Economic Kernel + Evidence | + Value Reasoning Traces (structured) |
| Financial Ground Truth | Evidence (industry benchmarks) | + Domain-specific database + mandatory citation |
| Domain Ecosystem | Not present | **New major component**: Persona Maps, Industry Templates |
| Persona & Industry Maps | Not present | **New**: Domain vocabulary injection |
| Economic Narrative | NarrativeAgent | + Persona-specific templates |
| Integration Layer | RealizationAgent + CRM sync | + Lifecycle-aware prompting |
| Outcome Validation Pairs | RealizationProof | + Explicit "pair" framing with commitment linkage |
| Valynt Verified | Integrity scoring | + Third-party validation program + badge system |
| Outcome-Based Pricing | ValueCommitment | + Contract integration + billing API linkage |

### 5.2 Implementation Requirements (New Work)

#### Domain Ecosystem (Highest Effort)

**New Entities**:
- `DomainPersonaMap` (domain, persona, templates, vocabulary)
- `IndustryTemplate` (vertical-specific hypothesis templates)
- `GroundTruthLibrary` (curated benchmarks with versioning)

**Modified Agents**:
- `DiscoveryAgent`: Load industry templates on domain selection
- `NarrativeAgent`: Accept persona parameter, use templates
- `IntegrityAgent`: Validate Ground Truth citations

**New UI Components**:
- Domain selector (manufacturing, SaaS, healthcare)
- Persona toggle (VP Eng, CFO, etc.)
- Template preview/editor

**Estimated Effort**: 80-120 hours (full vertical coverage)

#### UX Mechanics (Medium Effort)

**New Components**:
- `AuditableNumber` component with side panel
- `PersonaToggle` with real-time regeneration
- `WhatIfSlider` with streaming narrative updates
- `GroundTruthCitation` inline component

**API Modifications**:
- `POST /narrative/regenerate` (persona switch)
- `GET /trace/:id` (full provenance)
- WebSocket streaming for real-time updates

**Performance Work**:
- Kernel calculation optimization (< 100ms)
- Narrative streaming implementation
- Caching for Ground Truth lookups

**Estimated Effort**: 40-60 hours

#### Valynt Verified Program (Medium Effort)

**New Entities**:
- `VerifiedProposal` (badge, audit trail link)
- `VerifiedOutcome` (post-realization badge)
- `VendorProfile` (participating vendors)

**New Processes**:
- Badge issuance workflow
- Public audit trail pages (read-only, anonymized)
- Dispute resolution workflow

**Estimated Effort**: 40-60 hours

#### Outcome-Based Pricing (High Complexity, Pilot Only)

**New Integrations**:
- Contract management system (Ironclad, etc.)
- Billing system (Stripe, custom)
- Escrow/insurance provider APIs

**Legal Framework**:
- Standard contract templates
- Dispute resolution procedures
- Data sharing agreements

**Estimated Effort**: 120-200 hours (including legal)

### 5.3 Critical Path Dependencies

**Blocking**: Domain Ecosystem
- Cannot deliver "CFO narrative" without Persona Maps
- Cannot enforce Ground Truth citation without Ground Truth Library

**Blocking**: Integration Layer
- Cannot deliver "Commit vs. Actual" without CRM lifecycle integration
- Cannot deliver Outcome Validation Pairs without ERP/MES connections

**Independent**: UX Mechanics
- Auditable numbers, sliders, toggles can be built with mock data
- But full value requires Domain Ecosystem + Integration Layer

---

## 6. Epistemic Discipline: Strategic Claims Audit

### 6.1 Claim Classification

| Strategic Claim | Type | Support | Risk | Recommended Classification |
|-----------------|------|---------|------|---------------------------|
| "Industrial Intelligence Stack" creates new category | Positioning | No direct competitors with harness architecture | Category education burden; timing risk | **Marketing** |
| "Heroics → Abundance" paradigm shift | Positioning | Contrast valid; behavior change required | Adoption friction; resistance from heroes | **Marketing** |
| "CFO-defensible ROI" | Product | Economic Kernel deterministic; Ground Truth citations | "Defensible" unproven; legal standards unclear | **Partially Supported** |
| "5-minute value case" | UX | Workflow optimized; template-driven | Assumes single-pass generation; may need iteration | **Target** |
| "Trusted third-party ledger" | Vision | Outcome Validation Pairs create traceability | Centralized, not distributed; trust model unspecified | **Aspirational** |
| "Outcome-based contracts" enablement | Market | Valynt Verified program structure | Legal complexity; customer willingness untested; precedent limited | **Hypothesis** |
| "Valynt Verified" badge accelerates sales | Product | Integrity scoring exists; badge adds trust signal | Network effects require scale; chicken-egg problem | **Hypothesis** |
| Manufacturing → SaaS market sequencing | Strategy | Manufacturing measurability; SaaS timing | Market entry timing; competitive response | **Hypothesis** |
| Domain Ecosystem reduces narrative generation time | Product | Template approach sound | Template quality critical; coverage gaps possible | **Partially Supported** |
| Persona toggle preserves calculation integrity | Architecture | Kernel isolated from narrative | User testing required; perception of manipulation risk | **Designed** |

### 6.2 Critical Uncertainties

1. **Will customers share telemetry data?**
   - Required for: Outcome Validation Pairs, Valynt Verified program, outcome-based pricing
   - Uncertainty: High (data sharing is friction)
   - Mitigation: Proof-Lite mode; contract terms; gradual trust building

2. **Will vendors tolerate Valynt's integrity gates?**
   - Required for: Valynt Verified program credibility
   - Uncertainty: High (vendors may prefer less rigorous validation)
   - Mitigation: Tiered verification (basic vs. premium); voluntary participation

3. **Can Domain Ecosystem achieve sufficient coverage?**
   - Required for: "Abundance" promise (low heroics)
   - Uncertainty: Medium (template quality and coverage)
   - Mitigation: Start with 2-3 verticals; community contribution model

4. **Is outcome-based pricing legally viable?**
   - Required for: End game vision
   - Uncertainty: High (contract complexity, dispute resolution)
   - Mitigation: Pilot with friendly customers; legal framework development

---

## 7. Integration Roadmap: Strategy → Implementation

### Phase 1: Foundation (Weeks 1-4)
**Goal**: Technical architecture from ARM working end-to-end

**From ARM**:
- Close P0 gaps (ModelStage, AgentThread, NarrativeAgent)
- Economic Kernel integration
- IntegrityAgent enforcement

**Strategic Additions**:
- None (focus on technical foundation)

### Phase 2: Domain Ecosystem MVP (Weeks 5-8)
**Goal**: Single vertical (Manufacturing) + 2 personas (VP Eng, CFO)

**From ARM**:
- Evidence tier validation
- Basic narrative generation

**Strategic Additions**:
- Ground Truth Library (manufacturing baselines)
- Persona Maps (VP Eng, CFO)
- Domain selector UI
- Persona toggle with narrative regeneration

### Phase 3: UX Differentiation (Weeks 9-12)
**Goal**: "Blow Them Away" mechanics functional

**From ARM**:
- RealizationAgent basic telemetry

**Strategic Additions**:
- Auditable Number component
- What-If Slider
- Real-time narrative streaming
- Side panel provenance display

### Phase 4: Integration Layer (Weeks 13-16)
**Goal**: Lifecycle reasoning + Outcome Validation Pairs

**From ARM**:
- CRM sync
- RealizationProof with data sources

**Strategic Additions**:
- Lifecycle-aware prompting
- Outcome Validation Pair UI
- Commit vs. Actual dashboard
- QBR automation

### Phase 5: Institutionalization Pilot (Weeks 17-24)
**Goal**: Valynt Verified program with 3-5 vendors

**From ARM**:
- Integrity scoring stable
- Audit trail complete

**Strategic Additions**:
- Verified Proposal badge
- Public audit trail pages
- Vendor onboarding workflow
- Outcome-based pricing pilot (1-2 customers)

---

## 8. Success Metrics by Phase

| Phase | Technical Metrics | Strategic Metrics |
|-------|-------------------|-------------------|
| 1 | All P0 gaps closed; demo completion rate > 90% | Internal team confident in demo |
| 2 | Manufacturing vertical coverage > 80% | Persona toggle usage > 50% of demos |
| 3 | UX latency < 3.5s; slider usage > 3x per session | "Auditable number" clicked > 70% of sessions |
| 4 | Realization tracking coverage > 60%; CRM sync stable | Customer telemetry sharing rate > 40% |
| 5 | Verified vendor count = 5; outcome validation pairs > 10 | Vendor-reported sales cycle reduction; customer NPS |

---

**Document Status**: Strategic Framework (Integrates with ARM v2.0)  
**Key Gap**: Domain Ecosystem is new major component requiring 80-120 hours  
**Critical Uncertainty**: Customer willingness to share telemetry data  
**Biggest Strategic Bet**: Outcome-based pricing as end game
