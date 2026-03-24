# Valynt Model Creation MVP: Critical Path

**Scope**: Discovery → Modeling → Narrative (Outcome Validation = v2)  
**Goal**: Working model creation in < 5 minutes  
**Success**: Demo-complete, customer-ready proposals  

---

## In Scope (MVP)

| Component | Must Deliver | Success Criteria |
|-----------|--------------|------------------|
| **DiscoveryAgent** | Generate evidence-linked hypotheses | 3-5 hypotheses in < 30s; silver+ evidence attached |
| **FinancialModelingAgent** | Real API with Economic Kernel | Deterministic calculations (no hardcoded data); scenarios generated |
| **IntegrityAgent** | Scoring + enforcement | integrity_score ≥ 0.6 blocks advancement; remediation shown |
| **NarrativeAgent** | PDF generation | Executive summary PDF from BusinessCase; < 5s generation |
| **Dashboard UI** | "Go" button wired | Creates opportunity; navigates to discovery |
| **ModelStage UI** | Real API integration | Shows actual kernel outputs; editable assumptions |
| **Export UI** | Working narrative export | Downloads PDF; not hardcoded |

## Out of Scope (v2)

| Component | Deferred To | Why |
|-----------|-------------|-----|
| RealizationAgent | v2 | Outcome validation requires telemetry not available at model creation |
| Telemetry integrations | v2 | ERP/CRM APIs for actuals tracking |
| Outcome Validation Pairs | v2 | "Commit vs Actual" ledger requires v2 infrastructure |
| Lifecycle Reasoning | v2 | Stage-aware prompting requires CRM integration |
| ValueCommitment tracking | v2 | Post-sale commitment management |
| RealizationProof | v2 | Actual outcome measurement |

---

## Critical Path: Model Creation Flow

### Step 1: Dashboard Entry (P0)

**Current**: "Go" button dead  
**Target**: Creates Opportunity → Navigates to Discovery  

**Implementation**:
```typescript
// Dashboard.tsx
const handleCreateCase = async () => {
  const opportunity = await api.opportunities.create({
    name: `Value Case - ${new Date().toLocaleDateString()}`,
    stage: 'discovery'
  });
  router.push(`/discover/${opportunity.id}`);
};
```

**Effort**: 2 hrs  
**Blocking**: Nothing (can mock opportunity creation if API incomplete)

---

### Step 2: Discovery Agent (P0)

**Current**: AgentThread hardcoded; no streaming  
**Target**: Streaming hypothesis generation with evidence linking  

**Implementation**:
```typescript
// OpportunityAgent.ts (renamed DiscoveryAgent)
class DiscoveryAgent {
  async generateHypotheses(opportunityId: string): Promise<AgentOutput> {
    // 1. Fetch account context
    const opportunity = await this.fetchOpportunity(opportunityId);
    const groundTruth = await this.queryGroundTruthMCP(opportunity.industry);
    
    // 2. Generate with LLM (streaming)
    const stream = await this.secureInvoke({
      schema: ValueHypothesisSchema,
      prompt: this.buildPrompt(opportunity, groundTruth),
      streaming: true
    });
    
    // 3. Store hypotheses
    const hypotheses = await this.persistHypotheses(stream.output, opportunityId);
    
    // 4. Link evidence
    await this.linkEvidence(hypotheses, groundTruth);
    
    return {
      hypotheses,
      uiSections: this.buildUISections(hypotheses),
      traceId: stream.traceId
    };
  }
}
```

**Key Fixes**:
- Wire AgentThread to real API (not hardcoded)
- Enable WebSocket streaming for real-time UI updates
- Ground Truth MCP query (can be stubbed initially)
- Evidence linking to hypotheses

**Effort**: 16 hrs  
**Blocking**: ModelStage hardcoded data (can mock initially)

---

### Step 3: ModelStage Real API (P0)

**Current**: Hardcoded financial model; no API  
**Target**: Real Economic Kernel integration  

**Implementation**:
```typescript
// ModelStage.tsx
const loadFinancialModel = async (opportunityId: string) => {
  // Currently hardcoded - replace with:
  const model = await api.financialModels.getOrCreate(opportunityId);
  setFinancialModel(model);
};

// FinancialModelingAgent.ts
class FinancialModelingAgent {
  async generateModel(opportunityId: string): Promise<FinancialModel> {
    // 1. Fetch validated hypotheses
    const hypotheses = await this.fetchValidatedHypotheses(opportunityId);
    
    // 2. Load assumptions
    const assumptions = await this.fetchAssumptions(opportunityId);
    
    // 3. Build cash flow structure (LLM proposes, schema validates)
    const structure = await this.proposeStructure(hypotheses, assumptions);
    
    // 4. Economic Kernel calculates
    const kernel = new EconomicKernel();
    const results = kernel.calculate({
      cashFlows: structure.cashFlows,
      assumptions,
      discountRate: structure.discountRate
    });
    
    // 5. Generate scenarios
    const scenarios = kernel.generateScenarios(assumptions);
    
    // 6. Persist and return
    return this.persistModel({
      opportunityId,
      structure,
      results,
      scenarios,
      kernelVersion: kernel.version
    });
  }
}
```

**Key Fixes**:
- Replace hardcoded data with real API calls
- Economic Kernel integration (Decimal.js)
- Scenario generation (conservative/base/upside)
- Assumption editing with sensitivity recalculation

**Effort**: 12 hrs  
**Blocking**: NarrativeAgent (can proceed in parallel)

---

### Step 4: Economic Kernel Integration (P0)

**Current**: Formulas defined; Decimal.js not integrated  
**Target**: Deterministic calculations with full precision  

**Implementation**:
```typescript
// EconomicKernel.ts
import Decimal from 'decimal.js';

class EconomicKernel {
  version = '1.0.0';
  
  calculateNPV(cashFlows: Decimal[], discountRate: Decimal): Decimal {
    return cashFlows.reduce((npv, cf, t) => {
      const denominator = new Decimal(1).plus(discountRate).pow(t);
      return npv.plus(cf.dividedBy(denominator));
    }, new Decimal(0));
  }
  
  calculateIRR(cashFlows: Decimal[]): Decimal | null {
    // Newton-Raphson iterative solver
    // Returns null if no solution found
  }
  
  calculateROI(investment: Decimal, returns: Decimal): Decimal {
    return returns.minus(investment).dividedBy(investment).times(100);
  }
  
  calculatePayback(cashFlows: Decimal[]): number {
    // Months to cumulative positive
  }
  
  generateScenarios(
    baseAssumptions: Assumption[],
    sensitivityRanges: Map<string, [Decimal, Decimal]>
  ): ScenarioResult[] {
    // Conservative (P10), Base (P50), Upside (P90)
  }
}
```

**API Contract**:
```typescript
// POST /api/v1/financial-models/:id/calculate
{
  "assumptions": [...],
  "hypothesisIds": [...]
}

// Response
{
  "npv": "1234567.89",
  "irr": "0.2345",
  "roi": "156.78",
  "paybackMonths": 14,
  "scenarios": {
    "conservative": { "npv": "...", ... },
    "base": { "npv": "...", ... },
    "upside": { "npv": "...", ... }
  },
  "calculationLog": [...]  // For audit
}
```

**Effort**: 8 hrs  
**Blocking**: ModelStage API (depends on this)

---

### Step 5: IntegrityAgent Enforcement (P0)

**Current**: Logic implemented; not wired to transitions  
**Target**: Veto gate blocking advancement  

**Implementation**:
```typescript
// IntegrityAgent.ts
class IntegrityAgent {
  async evaluateBusinessCase(caseId: string): Promise<IntegrityResult> {
    const businessCase = await this.fetchCase(caseId);
    const hypotheses = await this.fetchHypotheses(caseId);
    const evidence = await this.fetchEvidence(caseId);
    const assumptions = await this.fetchAssumptions(caseId);
    
    // Calculate scores
    const defenseReadiness = this.calculateDefenseReadiness(assumptions, evidence);
    const integrityScore = this.calculateIntegrityScore(defenseReadiness, hypotheses);
    
    // Check violations
    const violations = this.detectViolations(hypotheses, evidence, assumptions);
    
    return {
      pass: integrityScore >= 0.6 && !violations.some(v => v.severity === 'critical'),
      integrityScore,
      defenseReadiness,
      violations,
      remediationInstructions: this.generateRemediation(violations)
    };
  }
}

// Stage transition enforcement
const advanceStage = async (opportunityId: string, targetStage: Stage) => {
  if (targetStage === 'in_review') {
    const integrity = await integrityAgent.evaluateBusinessCase(caseId);
    if (!integrity.pass) {
      // Block transition
      return {
        success: false,
        error: 'Integrity check failed',
        remediation: integrity.remediationInstructions
      };
    }
  }
  // Proceed with transition
};
```

**Key Fixes**:
- Wire IntegrityAgent to stage transitions
- Block advancement if integrity_score < 0.6
- Show remediation instructions in UI
- Log all evaluations for audit

**Effort**: 8 hrs  
**Blocking**: ModelStage working (needs case to evaluate)

---

### Step 6: NarrativeAgent (P0)

**Current**: Does not exist  
**Target**: PDF generation from BusinessCase  

**Implementation**:
```typescript
// NarrativeAgent.ts
class NarrativeAgent {
  async generateExecutiveSummary(caseId: string): Promise<PDFBuffer> {
    const businessCase = await this.fetchCase(caseId);
    const hypotheses = await this.fetchHypotheses(caseId);
    const model = await this.fetchFinancialModel(caseId);
    
    // 1. Generate narrative sections with LLM
    const sections = await this.generateSections({
      executiveSummary: this.llmGenerate('executive_summary', businessCase),
      financialOverview: this.llmGenerate('financial_overview', model),
      valueDrivers: this.llmGenerate('value_drivers', hypotheses),
      riskDiscussion: this.llmGenerate('risks', model.scenarios)
    });
    
    // 2. Compile into PDF
    const pdf = await this.compilePDF(sections, {
      template: 'executive_summary',
      branding: await this.fetchBranding(businessCase.organizationId)
    });
    
    return pdf;
  }
}

// API endpoint
// POST /api/v1/cases/:id/narrative/generate
// Returns: { downloadUrl: string }
```

**Technical Stack**:
- PDF generation: `pdfmake` or `puppeteer` + HTML template
- Template system: Handlebars or React-PDF
- Storage: S3/Supabase Storage with presigned URLs

**Effort**: 16 hrs  
**Blocking**: ModelStage API (needs financial data)

---

### Step 7: Export UI (P0)

**Current**: Export panel non-functional  
**Target**: Download PDF button working  

**Implementation**:
```typescript
// ExportPanel.tsx
const ExportPanel = ({ caseId }: { caseId: string }) => {
  const [generating, setGenerating] = useState(false);
  
  const handleExport = async () => {
    setGenerating(true);
    try {
      const response = await api.narrative.generate(caseId);
      // Trigger download
      window.open(response.downloadUrl, '_blank');
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <Button 
      onClick={handleExport}
      loading={generating}
      disabled={!integrityCheckPassed}
    >
      Download Executive Summary PDF
    </Button>
  );
};
```

**Effort**: 4 hrs  
**Blocking**: NarrativeAgent API

---

## Implementation Order (Dependencies)

```
Week 1:
├── Economic Kernel (8 hrs) ─┐
├── Dashboard "Go" (2 hrs)   │ Parallel
└── Export UI (4 hrs) ───────┘ (after NarrativeAgent)

Week 2:
├── Discovery Agent (16 hrs)
│   └── Depends on: Nothing (can mock ModelStage initially)
│
└── NarrativeAgent (16 hrs)
    └── Depends on: Economic Kernel

Week 3:
├── ModelStage Real API (12 hrs)
│   └── Depends on: Economic Kernel, Discovery Agent
│
└── IntegrityAgent Wiring (8 hrs)
    └── Depends on: ModelStage
```

**Total MVP Effort**: ~66 hours  
**Buffer**: +20% = ~80 hours  
**Team**: 2 engineers → ~1 week (parallel) or ~2.5 weeks (serial)

---

## Acceptance Criteria (MVP Complete)

| Test | Expected Result |
|------|-----------------|
| Dashboard "Go" button | Creates opportunity, navigates to discovery |
| Discovery | Generates 3-5 hypotheses with evidence in < 30s |
| ModelStage | Shows real NPV/IRR/ROI (not hardcoded); editable assumptions |
| What-If | Changing assumption recalculates model in < 1s |
| Integrity | Score < 0.6 blocks "Next" button; shows remediation |
| Export | Downloads PDF with executive summary in < 5s |
| End-to-End | Dashboard → Discovery → Model → Narrative in < 5 minutes |

---

## v2 Scope (Post-MVP)

**Outcome Validation Features**:
- RealizationAgent implementation
- Telemetry integrations (ERP, CRM APIs)
- ValueCommitment tracking post-sale
- Outcome Validation Pairs ("Commit vs Actual")
- RealizationProof with data source attribution
- Lifecycle Reasoning (CRM stage-aware prompting)
- Variance analysis and intervention workflows
- Expansion signal detection

**Timeline**: Weeks 8-16 (after model creation MVP stable)

---

**Focus**: Model creation only. Outcome validation = v2.
