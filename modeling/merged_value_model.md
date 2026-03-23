# Valynt Value Model: Merged & Right-Sized Architecture

## Executive Summary

This document synthesizes ~10 methodologies, ontologies, and research sources into a unified, production-credible value orchestration model. It prioritizes **honest assessment** over aspirational vision, **right-sized complexity** over overengineering, and **unrivaled differentiation** through three core innovations:

1. **Truthful Telemetry**: Value claims must connect to actual customer outcomes or be explicitly labeled speculative
2. **Economic Kernel**: Deterministic financial calculations (ROI, NPV, IRR) with full audit trails
3. **Integrity-First Flow**: No value proposition reaches a customer without passing evidence-based validation

### Honest Assessment of Current State

Per the Capability Audit (`cpability-to-Implementation.md`), the current system presents production features that are demo-grade:

| Capability | Frontend Claim | Backend Reality | Honest Status |
|------------|----------------|-----------------|---------------|
| Value Case Creation | Working QuickStart | Opportunities page works; Dashboard "Go" button dead | Partial |
| AI Hypothesis Generation | Agent streaming UI | OpportunityAgent exists; AgentThread hardcoded | Disconnected |
| Financial Modeling | Editable value tree | ModelStage entirely hardcoded | Mocked |
| Integrity Verification | Live claims queue | IntegrityAgent exists; stage hardcoded | Disconnected |
| Narrative Generation | Export panel | No NarrativeAgent exists | Missing |
| Realization Tracking | KPI progress | RealizationAgent exists; stage hardcoded | Disconnected |
| CRM Integration | Connected status | Integrations page decorative | Mocked |

**Verdict**: The product is demo-ready but not production-credible. This model provides the architectural blueprint to close these gaps systematically.

---

## 1. Core Ontology: Unified Entity Model

### 1.1 The Irreducible Core

For value orchestration to work, only **7 entities** are mandatory. All others are optimizations or extensions.

```
Account ──► Opportunity ──► ValueHypothesis ──► BusinessCase ──► ValueCommitment
                │                                    │                  │
                ▼                                    ▼                  ▼
           Assumption ◄─────────────────────► Evidence ◄────────── RealizationProof
```

### 1.2 Canonical Entity Definitions

#### Account (Customer)
```typescript
interface Account {
  id: UUID;                    // Immutable
  organization_id: UUID;       // Tenant isolation
  name: string;                // Legal entity name
  domain: string;              // Primary domain (deduplication key)
  industry: string;            // Sector classification (NAICS/SIC)
  arr_usd: number;             // Annual recurring revenue
  employee_count: number;      // Headcount band
  
  // Hook for B: Competitive Intelligence
  competitive_context?: CompetitiveProfile;  // From ontology-agent
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### Opportunity (Value Engagement)
```typescript
interface Opportunity {
  id: UUID;
  organization_id: UUID;
  account_id: UUID;            // N:1 Account
  
  name: string;               // Engagement identifier
  
  // Lifecycle (drives agent routing)
  stage: 'discovery' | 'modeling' | 'targeting' | 'validating' | 
         'composing' | 'committing' | 'realizing' | 'expansion' | 'archived';
  
  status: 'active' | 'on_hold' | 'closed_won' | 'closed_lost';
  
  close_date?: ISO8601Date;   // Expected close (forecasting)
  
  // Hook for B: Domain Intelligence
  domain_pack_id?: UUID;      // Industry-specific KPI templates
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### ValueHypothesis (Testable Claim)
```typescript
interface ValueHypothesis {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;        // N:1 Opportunity
  
  description: string;         // Falsifiable claim (min 10 chars)
  
  // Classification
  category: 'revenue_growth' | 'cost_reduction' | 
            'risk_mitigation' | 'capital_efficiency';
  
  // Quantified Value Range (must be range, never point)
  estimated_value: {
    low: number;              // Conservative (P10)
    high: number;             // Optimistic (P90)
    unit: 'usd' | 'percent' | 'hours' | 'headcount' | 'days';
    timeframe_months: number; // Over what period
  };
  
  // Confidence & Status
  confidence: number;          // 0.0 - 1.0 (agent-assigned)
  status: 'proposed' | 'under_review' | 'validated' | 'rejected' | 'superseded';
  
  // Evidence linkage (integrity mechanism)
  evidence_ids: UUID[];       // Supporting evidence items
  
  // Hook for B: Reasoning transparency
  reasoning_trace_id?: UUID;  // Link to step-by-step LLM reasoning
  
  // Provenance
  created_by_agent: string;    // Which agent generated this
  hallucination_check: boolean; // secureInvoke validation passed
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### Assumption (Auditable Input)
```typescript
interface Assumption {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;
  hypothesis_id: UUID | null;  // Null = applies to entire opportunity
  
  name: string;               // Short label (e.g., "Average deal size")
  description?: string;        // Longer explanation
  
  value: number;              // The numeric value
  unit: string;               // USD, %, days, FTE, etc.
  
  source: 'edgar' | 'gartner' | 'industry_benchmark' | 'customer_stated' | 
          'internal_estimate' | 'calculated';
  
  // Confidence interval for sensitivity
  sensitivity_range?: [number, number];  // Multipliers on value (e.g., [0.8, 1.2] = ±20%)
  
  // Human validation gate
  human_reviewed: boolean;    // Required for customer-facing outputs
  reviewed_by?: UUID;         // User who validated
  reviewed_at?: ISO8601;
  
  // Hook for B: Temporal tracking
  valid_from?: ISO8601;       // Bitemporal: when true in reality
  valid_to?: ISO8601;         // Bitemporal: when no longer true
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### Evidence (Verifiable Support)
```typescript
interface Evidence {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;
  hypothesis_id?: UUID;         // Null = opportunity-level evidence
  
  title: string;              // Short label (e.g., "Q3 DSO from ERP export")
  content: string;            // Full evidence content
  
  // Quality tier (enforcement mechanism)
  tier: 'silver' | 'gold' | 'platinum';
  // Silver: internal estimate, unverified
  // Gold: third-party data with attribution
  // Platinum: audited financial or contractual data
  
  // Provenance
  provenance: 'edgar_filing' | 'industry_report' | 'customer_interview' | 
              'system_of_record' | 'agent_calculated' | 'contractual_commitment';
  
  source_url?: string;        // Required for gold/platinum
  
  // LLM grounding score (hallucination detection)
  grounding_score?: number;   // 0.0 - 1.0 from secureInvoke
  
  // Hook for B: Synthetic data for testing
  is_synthetic?: boolean;     // Mark if generated for validation/testing
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### BusinessCase (Customer-Facing Artifact)
```typescript
interface BusinessCase {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;       // 1:1 with Opportunity (enforces single case per opp)
  
  title: string;              // Customer-facing title
  status: 'draft' | 'in_review' | 'approved' | 'presented' | 'archived';
  
  // Included hypotheses (must be validated status)
  hypothesis_ids: UUID[];      // Min 1, all must have status='validated'
  
  // Computed Financial Summary (from Economic Kernel)
  financial_summary: {
    total_value_low: number;   // Sum of hypothesis lows
    total_value_high: number;  // Sum of hypothesis highs
    roi: number;               // 3-year ROI
    npv: number;               // Net present value
    irr: number;               // Internal rate of return
    payback_months: number;    // Payback period
    
    // Scenario breakdown
    scenarios: {
      conservative: ScenarioSnapshot;
      base: ScenarioSnapshot;
      upside: ScenarioSnapshot;
    };
  };
  
  // Integrity scores (computed, not stored as editable)
  defense_readiness_score: number;  // 0.0 - 1.0 (formula below)
  integrity_score: number;         // 0.0 - 1.0 (formula below)
  
  // Versioning
  version: number;            // Incremented on each regeneration
  
  // Ownership
  owner_id: UUID;             // Presenting user
  
  // Hook for B: Export tracking
  export_history?: ExportRecord[];
  
  created_at: ISO8601;
  updated_at: ISO8601;
}

// Supporting types
interface ScenarioSnapshot {
  total_npv: number;
  total_roi: number;
  year_1_value: number;
  year_2_value: number;
  year_3_value: number;
}

interface ExportRecord {
  format: 'pdf' | 'pptx' | 'docx';
  generated_at: ISO8601;
  generated_by: UUID;
  stakeholder_view_id?: UUID;
}
```

#### ValueCommitment (Contractual Promise)
```typescript
interface ValueCommitment {
  id: UUID;
  organization_id: UUID;
  opportunity_id: UUID;
  business_case_id: UUID;      // Which case this commits to
  
  title: string;              // Commitment name
  description?: string;
  
  commitment_type: 'financial' | 'operational' | 'strategic' | 'compliance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // The promise
  financial_impact: {
    value_low: number;
    value_high: number;
    currency: 'USD';
  };
  
  // Timeline
  timeframe_months: number;   // 1-120 months
  committed_at: ISO8601;
  target_completion_date: ISO8601;
  actual_completion_date?: ISO8601;
  
  // Progress tracking
  status: 'draft' | 'active' | 'at_risk' | 'fulfilled' | 'cancelled';
  progress_percentage: number;  // 0.0 - 100.0
  
  // Realization tracking
  overall_realization_rate?: number;  // 0.0-2.0 (1.0 = on target)
  
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

#### RealizationProof (Actual vs. Committed)
```typescript
interface RealizationProof {
  id: UUID;
  organization_id: UUID;
  commitment_id: UUID;        // Which commitment this proves
  
  // The KPI being measured
  metric_name: string;
  unit: string;
  
  // Values
  committed_target: number;   // What was promised
  actual_value: number;       // What was measured
  
  // Variance analysis
  variance_percentage: number;  // ((actual - committed) / committed) * 100
  direction: 'above_target' | 'on_target' | 'below_target' | 'at_risk';
  
  // Telemetry source
  data_source: string;        // System that provided the measurement
  measurement_method: string;   // How it was calculated
  measured_at: ISO8601;
  
  // Hook for B: Intervention tracking
  intervention_id?: UUID;     // If intervention triggered by this variance
  
  created_at: ISO8601;
}
```

### 1.3 Score Calculation Formulas (Deterministic)

All scores are computed deterministically from underlying data:

#### Defense Readiness Score
```
defense_readiness_score = 
  0.6 * assumption_validation_rate + 
  0.4 * mean_evidence_grounding_score

Where:
  assumption_validation_rate = 
    count(assumptions with human_reviewed=true) / total_assumptions
    
  mean_evidence_grounding_score = 
    AVG(evidence.grounding_score for evidence in case)

Presentation-ready threshold: ≥ 0.8
Unvalidated warning threshold: < 0.4
```

#### Integrity Score
```
integrity_score = 
  0.5 * defense_readiness_score +
  0.5 * (1 - Σ violation_penalties)

Where violation penalties:
  critical: 0.20
  warning: 0.05
  info: 0.01
  dismissed_critical: 0.05 (transparency penalty)
  dismissed_warning: 0.01

Clamp to [0, 1]

Gate: integrity_score < 0.6 with open critical violations → 
      blocks status advance to 'in_review'
```

---

## 2. Implementation Matrix: Honest Assessment

### 2.1 Gap Closure Priority

| Priority | Gap | Effort | Owner | Production Impact |
|----------|-----|--------|-------|-------------------|
| **P0** | Dashboard "Go" button handler | 2 hrs | Frontend | Unlocks primary entry point |
| **P0** | ModelStage API wiring | 8 hrs | Full-stack | Core value proposition |
| **P0** | IntegrityStage API wiring | 6 hrs | Full-stack | Trust mechanism |
| **P0** | NarrativeAgent implementation | 16 hrs | Backend | Missing entirely |
| **P1** | AgentThread real streaming | 12 hrs | Backend | Production realism |
| **P1** | CRM integration actual wiring | 8 hrs | Backend | Enterprise readiness |
| **P1** | Settings persistence | 4 hrs | Frontend | Basic functionality |
| **P2** | Version history real data | 8 hrs | Full-stack | Audit requirement |
| **P2** | Evidence drawer browsing | 6 hrs | Frontend | Trust mechanism |

### 2.2 Agent Fabric: Current vs. Target

#### Current State (8 Agents)

```
OpportunityAgent ──► FinancialModelingAgent ──► TargetAgent
      │                                            │
      ▼                                            ▼
Hypothesis outputs                        ValueCommitment created
      │                                            │
      ▼                                            ▼
IntegrityAgent ◄──────────────────────────────── RealizationAgent
(Veto gate)                                      (Proof points)
      │                                            │
      ▼                                            ▼
NarrativeAgent (MISSING)                ExpansionAgent
(Business case doc)                     (Growth signals)
```

#### Target State (Right-Sized: 5 Core + 2 Extension)

**Core 5 (Required for Production)**:

| Agent | Responsibility | Current Status | Gap |
|-------|---------------|----------------|-----|
| **DiscoveryAgent** | Hypothesis generation | OpportunityAgent exists | Rename, tighten scope |
| **ModelingAgent** | Financial calculations | FinancialModelingAgent exists | Integrate Economic Kernel |
| **IntegrityAgent** | Validation & veto | Exists, disconnected | Wire to UI |
| **CommitmentAgent** | Target setting | TargetAgent exists | Rename, add milestone logic |
| **RealizationAgent** | Proof point tracking | Exists, disconnected | Wire telemetry, add expansion signals |

**Extension 2 (Hooks for B)**:

| Agent | Responsibility | Status | Hook |
|-------|---------------|--------|------|
| **NarrativeAgent** | Business case composition | **MISSING** | Priority P0 |
| **ExpansionAgent** | Growth opportunity detection | Exists | Enhance with competitive intelligence |

**Deprecated**:
- ComplianceAuditorAgent → Merge into IntegrityAgent as validation mode

### 2.3 Honest Capability Roadmap

```
Sprint N (Immediate):      P0 gaps closed → Demo-credible
Sprint N+1 (2 weeks):      P1 gaps closed → Beta-ready
Sprint N+2 (4 weeks):      P2 gaps closed → Production-credible
Sprint N+3 (6 weeks):      NarrativeAgent complete → Customer-facing
Sprint N+4 (8 weeks):      Competitive intelligence hooks → Differentiated
```

---

## 3. Value Flow Architecture

### 3.1 End-to-End Data Flow (Honest Version)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VALUE FLOW v2.0                                 │
│                     (Production-Credible Architecture)                        │
└─────────────────────────────────────────────────────────────────────────────┘

[DISCOVERY]                          [MODELING]                         [TARGETING]
     │                                    │                                  │
     ▼                                    ▼                                  ▼
┌──────────┐                     ┌─────────────┐                    ┌──────────────┐
│ Discovery│  ─────────────────►  │  Modeling   │  ───────────────►  │  Commitment  │
│  Agent   │  Hypotheses        │   Agent     │  Financial Model   │   Agent      │
│          │  (with Evidence)   │             │  (3 scenarios)     │              │
└────┬─────┘                     └──────┬──────┘                    └──────┬───────┘
     │                                  │                                  │
     │     hypothesis_outputs           │     financial_model_snapshots    │   value_commitments
     │     evidence (linked)              │     scenarios                    │   commitment_milestones
     │                                  │                                  │   commitment_metrics
     │                                  │                                  │
     ▼                                  ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VALIDATION GATE                                  │
│                                                                               │
│   ┌─────────────┐                                                            │
│   │ Integrity   │  Pass? ──► Continue to Composing                           │
│   │   Agent     │  Veto? ──► Return to Modeling (with violations)             │
│   └─────────────┘                                                            │
│                                                                               │
│   Output: integrity_outputs (violations, scores)                              │
│                                                                               │
│   Gate: integrity_score ≥ 0.6 AND no critical open violations                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
[COMPOSING]                      [COMMITTING]                     [REALIZING]
     │                                │                                │
     ▼                                ▼                                ▼
┌──────────┐                   ┌──────────┐                   ┌──────────────┐
│ Narrative│  ───────────────► │ Business │  ─────────────► │ Realization  │
│  Agent   │  Executive Summary│   Case   │  Presented to │    Agent     │
│          │  (PDF/PPTX)       │  Status: │  Customer     │              │
│          │                   │ presented│               │              │
└──────────┘                   └────┬─────┘                   └──────┬───────┘
                                    │                                │
                                    │   business_case (v1, v2...)    │   realization_reports
                                    │   stakeholder_views              │   realization_proofs
                                    │                                │
                                    ▼                                ▼
                           ┌─────────────────────────────────────────────────┐
                           │              EXPANSION SIGNALS                 │
                           │                                                │
                           │   If realization_rate > 110%:                  │
                           │   ──► Trigger ExpansionAgent                     │
                           │   ──► Create new Opportunity (linked)            │
                           │                                                │
                           │   Output: expansion_opportunities               │
                           └─────────────────────────────────────────────────┘
```

### 3.2 Telemetry Gaps (Honest Assessment)

| Data Needed | Current Source | Gap | Resolution |
|-------------|----------------|-----|------------|
| Actual KPI values | Customer systems (ERP, CRM) | No integration | Manual import API; CSV upload; future: native connectors |
| Industry benchmarks | Gartner, Forrester | Hardcoded | Integrate Ground Truth MCP |
| Financial ground truth | EDGAR, company filings | Partial | Enhance MCP with real-time feed |
| Competitive intelligence | Manual research | Manual only | Hook: ontology-agent integration |

### 3.3 Integrity Enforcement Points

```
Checkpoint 1: Hypothesis Generation
├── Evidence tier check: Gold/Platinum required for high-confidence claims
├── Grounding score > 0.7 for agent-generated evidence
└── Falsifiability: description must contain measurable metric

Checkpoint 2: Financial Modeling
├── Assumption source validation: EDGAR/Gartner preferred
├── Human review gate: customer-stated assumptions require explicit approval
└── Sensitivity range required: all assumptions must have bounds

Checkpoint 3: Business Case Approval
├── Defense readiness ≥ 0.8 for presentation
├── Integrity score ≥ 0.6 for in_review status
└── All hypotheses validated status

Checkpoint 4: Realization Tracking
├── Variance > 20% triggers intervention workflow
├── Variance > 10% below target: at_risk flag
└── Realization > 110%: expansion signal
```

---

## 4. Differentiation Strategy: What Makes This Unrivaled

### 4.1 Core Differentiation vs. Alternatives

| Competitor Approach | Valynt Differentiation |
|--------------------|----------------------|
| **Generic AI sales tools** (Gong, Chorus) | Value orchestration, not just conversation intelligence |
| **Static ROI calculators** (ValueSelling, MHI Research) | AI-generated, dynamic models with real-time integrity checks |
| **Value consulting services** (McKinsey, Bain) | Democratized value engineering at software margins |
| **Tech Mahindra ValueOS** (name collision) | B2B SaaS-native, not enterprise IT governance; agent-orchestrated, not framework-driven |
| **CRM value modules** (Salesforce Einstein) | Cross-platform, evidence-based, with realization tracking |

### 4.2 Three Unrivaled Capabilities

#### 1. Truthful Telemetry Architecture

**The Problem**: Every value platform claims to "prove ROI." Almost none connect to actual customer outcomes.

**Our Approach**:
- Explicitly label claims as **speculative** (hypothesis), **committed** (contractual), or **proven** (realized)
- RealizationProof entities require external telemetry (ERP, CRM data), not self-reported surveys
- Variance analysis with automatic intervention triggers

**Evidence Tier Enforcement**:
```
Claim Type         Required Evidence Tier     Validation
─────────────────────────────────────────────────────────────
$500K savings      Platinum (audited)       Contractual terms
                   OR Gold + human_reviewed   Customer attestation
                   OR Silver + 3x confidence   Conservative range

30% efficiency     Gold (industry benchmark)  Gartner/IDC citation
gain               OR Silver + grounding>0.8  Agent-generated

"Transform your     N/A (marketing)           Excluded from 
business"                                     BusinessCase math
```

#### 2. Economic Kernel: Deterministic Financial Calculations

**The Problem**: LLMs hallucinate financial math.

**Our Approach**:
- **Decimal.js** for all monetary calculations (no floating-point errors)
- Deterministic formulas with full audit trails:
  ```typescript
  // From packages/backend/src/domain/economic/EconomicKernel.ts
  calculateNPV(cashFlows: Decimal[], discountRate: Decimal): Decimal
  calculateIRR(cashFlows: Decimal[]): Decimal | null
  calculateROI(totalInvestment: Decimal, totalReturn: Decimal): Decimal
  calculatePayback(cashFlows: Decimal[]): number // months
  ```
- Sensitivity analysis: NPV at ±20% assumption variance
- Scenario modeling: conservative/base/upside with explicit probability weights

#### 3. Integrity-First Flow: Evidence-Based Validation Gates

**The Problem**: Sales teams present unvalidated claims to customers.

**Our Approach**:
- **IntegrityAgent** has veto power over lifecycle transitions
- Business cases cannot advance to `in_review` with:
  - `integrity_score < 0.6`
  - Open critical violations
  - Assumptions lacking human review
- Real-time integrity queue in dashboard (not hardcoded)
- Defense readiness score visible to customer (transparency as feature)

### 4.3 Hooks for B (Future Extensions)

| Hook | Current State | Future Extension |
|------|---------------|------------------|
| `Account.competitive_context` | Schema field exists | Integrate ontology-agent for competitive analysis |
| `Opportunity.domain_pack_id` | Schema field exists | Expand to full industry KPI library |
| `Evidence.is_synthetic` | Schema field exists | Generate synthetic datasets for model validation |
| `Assumption.valid_from/to` | Schema fields exist | Full bitemporal tracking for audit compliance |
| `ReasoningTrace` | Not implemented | Capture step-by-step LLM reasoning for transparency |
| `ExpansionOpportunity.competitive_intelligence` | Not implemented | Auto-detect competitor displacement opportunities |

---

## 5. Data Science Contracts: Machine-Readable Schemas

### 5.1 Dataset Inventory

| Dataset | SQL Query | Grain | Update Frequency | Retention |
|---------|-----------|-------|-------------------|-----------|
| `cases` | `SELECT * FROM value_cases WHERE deleted_at IS NULL` | 1 row per engagement | Real-time | 7 years |
| `hypotheses` | `SELECT * FROM hypothesis_outputs` | 1 row per hypothesis | On agent run | 7 years |
| `assumptions` | `SELECT * FROM assumptions` | 1 row per assumption | On change | 7 years |
| `financial_models` | `SELECT * FROM financial_model_snapshots` | 1 row per model | On modeling | 7 years |
| `scenarios` | `SELECT * FROM scenarios` | 3 rows per model | On modeling | 7 years |
| `integrity_checks` | `SELECT * FROM integrity_outputs` | 1 row per validation | On validation | 2 years |
| `commitments` | `SELECT * FROM value_commitments` | 1 row per promise | On commit | 7 years |
| `realization_proofs` | `SELECT * FROM realization_proofs` | 1 row per measurement | Weekly/batch | 7 years |
| `evidence` | `SELECT * FROM evidence` | 1 row per evidence item | On discovery | 7 years |

### 5.2 JSON Schema: ValueHypothesis (Canonical)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valynt.io/schemas/ValueHypothesis.json",
  "title": "ValueHypothesis",
  "description": "A testable claim about business value creation",
  "type": "object",
  "required": [
    "id", "organization_id", "opportunity_id", "description",
    "category", "estimated_value", "confidence", "status"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Immutable identifier"
    },
    "organization_id": {
      "type": "string",
      "format": "uuid",
      "description": "Tenant isolation key"
    },
    "opportunity_id": {
      "type": "string",
      "format": "uuid",
      "description": "Parent engagement"
    },
    "description": {
      "type": "string",
      "minLength": 10,
      "maxLength": 2000,
      "description": "Falsifiable claim statement"
    },
    "category": {
      "type": "string",
      "enum": [
        "revenue_growth",
        "cost_reduction",
        "risk_mitigation",
        "capital_efficiency"
      ],
      "description": "Economic value driver taxonomy"
    },
    "estimated_value": {
      "type": "object",
      "required": ["low", "high", "unit", "timeframe_months"],
      "properties": {
        "low": {
          "type": "number",
          "description": "Conservative estimate (P10)"
        },
        "high": {
          "type": "number",
          "description": "Optimistic estimate (P90)"
        },
        "unit": {
          "type": "string",
          "enum": ["usd", "percent", "hours", "headcount", "days"]
        },
        "timeframe_months": {
          "type": "integer",
          "minimum": 1,
          "maximum": 120
        }
      }
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Agent-assigned confidence score"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "under_review",
        "validated",
        "rejected",
        "superseded"
      ]
    },
    "evidence_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid"
      }
    },
    "hallucination_check": {
      "type": "boolean",
      "description": "secureInvoke validation passed"
    },
    "created_by_agent": {
      "type": "string",
      "description": "Agent that generated this hypothesis"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### 5.3 Lineage Query: Trace a Dollar

```sql
-- Trace a specific value commitment from hypothesis to realization
WITH value_lineage AS (
  SELECT 
    vc.id as commitment_id,
    vc.financial_impact->>'value_low' as committed_low,
    vc.financial_impact->>'value_high' as committed_high,
    vc.status as commitment_status,
    
    -- Hypothesis origin
    h.id as hypothesis_id,
    h.description as hypothesis_claim,
    h.confidence as hypothesis_confidence,
    h.category as value_driver,
    
    -- Financial model
    fms.npv as model_npv,
    fms.roi as model_roi,
    fms.models->>'cash_flows' as cash_flows_json,
    
    -- Key assumptions
    jsonb_agg(DISTINCT jsonb_build_object(
      'name', a.name,
      'value', a.value,
      'unit', a.unit,
      'source', a.source,
      'human_reviewed', a.human_reviewed
    )) as assumptions,
    
    -- Evidence quality
    jsonb_agg(DISTINCT jsonb_build_object(
      'tier', e.tier,
      'provenance', e.provenance,
      'grounding_score', e.grounding_score
    )) as evidence_summary,
    
    -- Integrity
    io.integrity_score,
    io.defense_readiness_score,
    io.violation_count,
    
    -- Realization
    rp.actual_value,
    rp.variance_percentage,
    rp.direction
    
  FROM value_commitments vc
  LEFT JOIN hypothesis_outputs h ON h.case_id = vc.id
  LEFT JOIN financial_model_snapshots fms ON fms.case_id = vc.id
  LEFT JOIN assumptions a ON a.case_id = vc.id
  LEFT JOIN evidence e ON e.hypothesis_id = h.id
  LEFT JOIN integrity_outputs io ON io.case_id = vc.id
  LEFT JOIN realization_proofs rp ON rp.commitment_id = vc.id
  
  WHERE vc.id = 'uuid-here'
  GROUP BY vc.id, h.id, fms.id, io.id, rp.id
)
SELECT * FROM value_lineage;
```

---

## 6. Migration Path: Current State → Target

### 6.1 Phase 1: Honest Demo (Immediate)

**Goal**: Fix the most embarrassing gaps for credible demos.

| Task | Effort | Owner |
|------|--------|-------|
| Wire Dashboard "Go" button to `useCreateCase()` | 2 hrs | Frontend |
| Add "API Unavailable" fallbacks where hardcoded | 4 hrs | Frontend |
| Implement NarrativeAgent (basic version) | 16 hrs | Backend |
| Create `/api/v1/cases/:id/narrative/run` endpoint | 4 hrs | Backend |

**Deliverable**: Demo where all major buttons have real handlers, even if backend is partial.

### 6.2 Phase 2: Beta-Ready (2-4 weeks)

**Goal**: Close P0 and P1 gaps.

| Task | Effort | Owner |
|------|--------|-------|
| ModelStage real API: GET/POST financial models | 12 hrs | Full-stack |
| IntegrityStage real API: GET integrity status | 8 hrs | Full-stack |
| AgentThread WebSocket streaming | 16 hrs | Backend |
| Settings persistence | 4 hrs | Frontend |
| CRM integration actual wiring (Salesforce OAuth) | 16 hrs | Backend |

**Deliverable**: Closed beta with 3-5 customers, all core flows functional.

### 6.3 Phase 3: Production-Credible (4-6 weeks)

**Goal**: Audit-ready, enterprise-deployable.

| Task | Effort | Owner |
|------|--------|-------|
| Version history with rollback | 16 hrs | Full-stack |
| Evidence drawer with browsing | 8 hrs | Frontend |
| Complete audit trail | 8 hrs | Backend |
| RLS policy audit and fixes | 4 hrs | Backend |
| Performance optimization (query indexing) | 8 hrs | Backend |

**Deliverable**: Production release with enterprise security review passed.

### 6.4 Phase 4: Differentiated (6-8 weeks)

**Goal**: Unrivaled capabilities.

| Task | Effort | Owner |
|------|--------|-------|
| Ontology-agent integration for competitive context | 24 hrs | Full-stack |
| Bitemporal assumption tracking | 16 hrs | Backend |
| Synthetic data generation for testing | 16 hrs | Backend |
| Advanced realization analytics | 16 hrs | Backend |

**Deliverable**: Category-leading value orchestration platform.

### 6.5 Schema Migration Scripts

```sql
-- Migration: Add missing FK constraints for data integrity
-- Issue: Orphaned assumptions possible with no FK

-- Add to 20260XXX_add_value_constraints.sql

ALTER TABLE assumptions
  ADD CONSTRAINT fk_assumptions_case
  FOREIGN KEY (case_id) REFERENCES value_cases(id)
  ON DELETE CASCADE;

ALTER TABLE scenarios
  ADD CONSTRAINT fk_scenarios_case
  FOREIGN KEY (case_id) REFERENCES value_cases(id)
  ON DELETE CASCADE;

-- Add materialized integrity_score column for queryability
ALTER TABLE value_cases
  ADD COLUMN integrity_score NUMERIC(3,2)
  CHECK (integrity_score >= 0 AND integrity_score <= 1);

-- Create index for DS queries
CREATE INDEX idx_value_cases_integrity 
  ON value_cases(organization_id, integrity_score)
  WHERE integrity_score IS NOT NULL;
```

---

## 7. Agent Evolution: From 8 to 5 Core

### 7.1 Agent Consolidation Rationale

Current 8 agents have overlapping responsibilities. Consolidation reduces complexity without losing capability.

| Current Agent | Consolidated Into | Reasoning |
|---------------|-------------------|-----------|
| OpportunityAgent | **DiscoveryAgent** | Tighten scope: generate hypotheses with evidence |
| FinancialModelingAgent | **ModelingAgent** | Integrate Economic Kernel for deterministic math |
| TargetAgent | **CommitmentAgent** | Expand: not just targets but full commitment lifecycle |
| RealizationAgent | **RealizationAgent** | Keep: but add expansion signal detection |
| IntegrityAgent | **IntegrityAgent** | Keep: core differentiation, add ComplianceAuditor functions |
| NarrativeAgent | **NarrativeAgent** | **NEW**: Business case composition, missing entirely |
| ExpansionAgent | **RealizationAgent** | Merge: expansion is extension of realization |
| ComplianceAuditorAgent | **IntegrityAgent** | Merge: compliance is subset of integrity validation |

### 7.2 Core 5 Agent Specifications

#### DiscoveryAgent

**Purpose**: Generate testable value hypotheses from account context.

**Input**: `Account`, `Opportunity`, domain context
**Output**: `ValueHypothesis[]` + `Evidence[]`

**Process**:
1. Query Ground Truth MCP (EDGAR, industry benchmarks)
2. LLM generates hypotheses via `secureInvoke`
3. Auto-attach evidence with tier classification
4. Compute confidence scores

**Validation**:
- All hypotheses have falsifiable descriptions
- High-confidence claims have gold+ evidence
- `hallucination_check: true` from secureInvoke

#### ModelingAgent

**Purpose**: Build auditable financial models from hypotheses.

**Input**: `ValueHypothesis[]`, `Assumption[]`
**Output**: `FinancialModelSnapshot` + 3 `Scenario`s

**Process**:
1. Retrieve hypotheses from memory
2. LLM structures cash flow projections (years 1-3)
3. **Economic Kernel** computes:
   - NPV (discounted cash flows)
   - IRR (iterative solver)
   - ROI (total return / investment)
   - Payback (cumulative cash flow break-even)
4. Generate conservative/base/upside scenarios
5. Sensitivity analysis (±20% assumption variance)

**Validation**:
- All assumptions have sources (EDGAR/Gartner preferred)
- Customer-stated assumptions flagged for review
- Decimal.js prevents floating-point errors

#### IntegrityAgent

**Purpose**: Validate value claims with veto power over lifecycle.

**Input**: `BusinessCase`, `ValueHypothesis[]`, `Evidence[]`
**Output**: `IntegrityOutput` (pass/veto + violations + scores)

**Process**:
1. Evaluate evidence tiers against claim confidence
2. Check assumption human_reviewed status
3. Calculate defense_readiness_score
4. Calculate integrity_score
5. Generate violations (critical/warning/info)

**Authority**:
- `integrity_score < 0.6` → Block `in_review` transition
- Open critical violations → Require dismissal with justification
- No override: veto stands until violations resolved

**Validation**:
- Deterministic score calculations
- All violations have remediation paths
- Audit trail of dismissals

#### CommitmentAgent

**Purpose**: Convert models to contractual value commitments.

**Input**: `BusinessCase`, stakeholder selections
**Output**: `ValueCommitment` + `CommitmentMilestone[]` + `CommitmentMetric[]`

**Process**:
1. Present financial model to stakeholders
2. LLM recommends KPI targets with confidence intervals
3. Stakeholder approval (human-in-the-loop)
4. Create commitment with milestones and metrics
5. Publish to realization tracking system

**Validation**:
- All commitments have measurable metrics
- Target values within model ranges
- Stakeholder accountability assigned

#### RealizationAgent

**Purpose**: Track committed value vs. actual outcomes.

**Input**: `ValueCommitment`, telemetry data (ERP, CRM)
**Output**: `RealizationProof[]` + interventions/expansion signals

**Process**:
1. Retrieve committed KPIs from memory
2. Query telemetry systems for actual values
3. Calculate variance and direction
4. Generate proof points
5. Trigger interventions if variance > 20%
6. Flag expansion signals if realization > 110%

**Validation**:
- Telemetry source documented
- Measurement method explicit
- Variance calculations auditable

#### NarrativeAgent (Extension)

**Purpose**: Compose customer-facing business case documents.

**Input**: `BusinessCase`, template selection
**Output**: `NarrativeDraft` (exportable PDF/PPTX)

**Process**:
1. Retrieve validated business case
2. LLM generates executive summary
3. Structure impact cascade
4. Build stakeholder map
5. Generate export artifacts

**Validation**:
- Only validated hypotheses included
- Financial numbers match model exactly
- Source citations for all claims

### 7.3 Agent Orchestration Flow

```
Opportunity Created
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Discovery   │ ──► │   Modeling   │ ──► │  Integrity   │
│    Agent     │     │    Agent     │     │    Agent     │
└──────────────┘     └──────────────┘     └──────┬───────┘
      Hypotheses          Financial Model         │ Pass?
                                                  │
                                              Veto? ──► Return
                                                  │
                                                  ▼
                                            ┌──────────────┐
                                            │   Narrative  │
                                            │    Agent     │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │  Commitment  │
                                            │    Agent     │
                                            └──────┬───────┘
                                                   │
                     ┌─────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  Realization │
              │    Agent     │
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Interventions  On Target   Expansion Signals
   (variance     (continue)  (realization > 110%)
   >20%)                      │
                              ▼
                    ┌─────────────────┐
                    │  New Discovery  │
                    │  (linked opp)   │
                    └─────────────────┘
```

---

## 8. Decision Log: Why This, Not That

### 8.1 System 2 Reasoning Trace

**Step 1: Decomposition**
- Identified irreducible core: 7 entities (not 15+ in some ontologies)
- Distinguished mandatory from optional
- Separated production requirements from vision extensions

**Step 2: Semantic Grounding**
- Anchored in B2B value storytelling (Architecture of Economic Impact)
- Every entity connects to provable economic outcome
- Rejected abstract business ontology in favor of concrete value orchestration

**Step 3: Self-Correction**
- Initial thought: Keep all 8 agents
- Correction: Consolidate to 5 core, merge overlapping responsibilities
- Validation: No capability lost, complexity reduced

**Step 4: Validation**
- Checked against capability audit: addresses all P0/P1 gaps
- Checked against differentiation: 3 unrivaled capabilities defined
- Checked against DS readiness: clear lineage, JSON schemas, query examples

### 8.2 Key Decisions

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| 7 core entities | 15+ entity ontology | Right-sized for implementation |
| 5 agents | 8 agents (current) | Consolidate overlap, reduce complexity |
| Evidence tiers (silver/gold/platinum) | Binary (verified/unverified) | Graduated trust enables nuanced validation |
| Economic Kernel (deterministic) | LLM-generated financials | Eliminates hallucination in critical calculations |
| Integrity veto power | Advisory warnings only | Enforcement differentiates from generic suggestion tools |
| RealizationProof (external telemetry) | Self-reported surveys | Truthful telemetry, not biased feedback |
| Bitemporal schema hooks | Single timestamp | Future audit compliance without current overhead |
| Synthetic data hooks | Production-only testing | Testability without privacy/legal constraints |

### 8.3 Intentionally Deferred

| Capability | Reason | Hook for Future |
|------------|--------|-----------------|
| Full ontology-agent integration | Adjacent to core value loop | `Account.competitive_context` field ready |
| IP strategy automation | Legal process, not value orchestration | Separate workflow |
| Compliance documentation | Subset of integrity validation | `IntegrityAgent` validation modes |
| Polyglot persistence | PostgreSQL sufficient at current scale | Schema supports future extensions |
| Graph neural networks | Overkill for current data volumes | `value_graph_edges` table ready |

---

## 9. Summary: The Merged Model

### 9.1 One-Page Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VALYNT VALUE ORCHESTRATION                    │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │Discovery│  │ Modeling│  │Integrity│  │Commitment│ │Realization│ │
│  │  Agent  │─►│  Agent  │─►│  Agent  │─►│   Agent   │─►│   Agent   │ │
│  └─────────┘  └─────────┘  └────┬────┘  └─────────┘  └────┬───┘ │
│       │                          │                        │    │
│       ▼                          ▼                        ▼    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     CORE ONTOLOGY (7 entities)               ││
│  │  Account → Opportunity → ValueHypothesis → BusinessCase       ││
│  │       ↓         ↓              ↓            ↓                ││
│  │  Assumption ◄───► Evidence   ValueCommitment → RealizationProof│
│  └─────────────────────────────────────────────────────────────┘│
│       ▲                                                          │
│       │                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              ECONOMIC KERNEL (Deterministic Math)            ││
│  │  NPV • IRR • ROI • Payback • Sensitivity Analysis           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Differentiation: Truthful Telemetry • Evidence Tiers • Integrity Gates
│  Hooks for B: Competitive Intelligence • Bitemporal • Synthetic Data
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Value case creation (end-to-end) | < 5 minutes | Time from company name to first hypothesis |
| Integrity score accuracy | > 90% | Correlation with customer validation |
| Realization tracking coverage | > 80% | % of commitments with telemetry linkage |
| Demo-to-reality gap | 0 P0 items | Capability audit score |
| DS queryability | < 10s | Complex lineage query execution time |

### 9.3 Final Assessment

**What This Is**:
- Honest assessment of current state with clear migration path
- Right-sized ontology (7 entities) for production implementation
- Consolidated agent fabric (5 core) reducing complexity
- Three unrivaled differentiators: Truthful Telemetry, Economic Kernel, Integrity-First Flow
- Machine-readable contracts for DS consumption
- Hooks for future extension without scope creep

**What This Is Not**:
- Overengineered enterprise architecture
- Vision document disconnected from implementation reality
- Competitive intelligence platform (ontology-agent is hook, not core)
- Replacement for existing value consulting services (software margin play)
- Tech Mahindra ValueOS clone (differentiated positioning)

---

**Document Version**: Merged v1.0  
**Date**: 2026-03-22  
**Source Materials**: 10+ methodologies consolidated  
**Scope**: Option A (Core Value Orchestration) with Hooks for B  
**Status**: Ready for implementation planning
