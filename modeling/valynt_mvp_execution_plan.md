# Assessment: KIMI K2.5 Swarm vs. Model Creation MVP

**Executive Summary:** The KIMI K2.5 multi-agent ("swarm") approach is **overkill** for the straightforward Model Creation MVP. This MVP is essentially an engineering implementation task with clear acceptance criteria, not a complex reasoning problem. Key "keep" strategies include **working backwards from the value harness** and automated testing. However, much of the swarm's complexity (planner/coder/executor, GRPO, extensive diagrams, citation token rules) can be replaced by standard agile engineering practices. We recommend a lean implementation loop with defined "done" criteria and CI/CD validation, as shown below.

## Useful Concepts (Keep)

- **Work Backwards from Harness:** Start with the end criteria in mind (e.g. "model creation in <5 min"). Amazon famously writes a mock press release first. By defining acceptance (harness) outputs upfront, development stays focused on delivering them.
- **Test Harness:** Automate end-to-end tests to catch "works on my machine" issues. For example, create a script that runs the Dashboard → modeling agents → Economic Kernel → PDF export and verifies the output. This echoes the advice "Before you ship an AI agent, ship its test harness".
- **Validation Gates:** Introduce automated checks at key points (e.g. require an integrity score or test pass rate). For instance, an integrity check (≥0.6) could block merges, ensuring regressions are caught early. This aligns with CI/CD best practices (automated testing on every build).
- **Synthetic Data:** Use generated or mock data to test edge cases without sensitive production data. For example, feed known inputs into the Economic Kernel (where 0.1+0.2 should not equal 0.30000000000000004) to verify numerical stability.

## Over-Engineered Components (Skip or Simplify)

- **Full Swarm Architecture (Planner→Coder→Executor→Validator→Grapher):** Orchestrating five agents for just 7 concrete tasks is unnecessary. Instead, do direct implementation of each component (Economic Kernel, Dashboard, etc.) per the critical path, without extra coordination overhead.
- **GRPO Self-Correction:** Merging multiple LLM-generated drafts is overkill when this is a code project. Use code reviews, unit tests, and CI pipelines instead of complex LLM ensembling.
- **Mermaid for Every Iteration:** Continuous diagramming adds documentation overhead. Only update architecture diagrams after major milestones, not every minor change.
- **External Citation Tokens:** Tokens like 【90†L885-L893】 or references to ARTEMIS-DA are from KIMI docs and not relevant to your codebase. In practice, use your real files and docs (e.g. the MVP critical path, agent code, migration scripts) rather than preserving those tokens.
- **Academic Techniques (RLHF, Self-Consistency):** These are research-level methods, not needed for MVP engineering. Stick to practical testing frameworks (e.g. Jest, PyTest, etc.).

## Simplified Implementation Loop

For each component on the critical path, follow a concise CI-driven loop:

1. **Define "Done" (Harness Output):** Specify acceptance for the component. *Example:* Economic Kernel must compute NPV/IRR/ROI accurately (correct to ±0.01%). NarrativeAgent must produce a coherent report section. Total pipeline (Dash→PDF) runs <5 minutes.
2. **Implement:** Write code with TODOs noted. Keep it simple and modular.
3. **Unit Test:** Write tests with known inputs → expected outputs. Check for edge cases (e.g. floating-point quirks).
4. **Integration Test:** Ensure it works with adjacent pieces. *Example:* Run ModelingAgent + EconomicKernel with sample data to verify end-to-end flow.
5. **Acceptance Check:** Run the entire user flow (if applicable). Measure runtime (should meet the <5 min criterion). Check that PDF export matches requirements.
6. **Commit & Document:** Submit a PR, update the MVP tracker, and note any open issues.

```markdown
## Development Loop (Per Task)

1. **Define Exit Criteria (harness).** e.g. Economic Kernel returns correct results (Decimal precision).
2. **Code.** Write implementation with inline tests/todos.
3. **Unit Test.** Validate against known cases.
4. **Integration Test.** Component works end-to-end in context.
5. **Acceptance Test.** End-to-end pipeline times and correctness (<5min).
6. **Review & Merge.** Peer review (not LLM review); update documentation.
```

**Coordination:** Two engineers in parallel:

- **Track A:** Economic Kernel (8h) → NarrativeAgent (16h) → Export UI (4h).
- **Track B:** Dashboard (2h) → Discovery Agent (16h) → ModelStage API (12h) → Integrity Wiring (8h).

Daily stand-ups and a shared task board suffice for coordination. Rely on code reviews and automated tests instead of formal multi-agent governance.

## Critical Path Tasks

The MVP's critical path consists of **8 tasks** totaling ~70 hours:

| # | Task | Hours | Blockers |
|---|------|-------|----------|
| 0 | **Data Model Validation** | 4 | None — validates schemas before implementation |
| 1 | Economic Kernel calculation | 8 | None |
| 2 | Dashboard "Go" | 2 | None |
| 3 | Discovery Agent | 16 | Mockable ModelStage |
| 4 | NarrativeAgent | 16 | Economic Kernel |
| 5 | ModelStage API | 12 | Economic Kernel, Data Model |
| 6 | Integrity Wiring | 8 | ModelStage API, Data Model |
| 7 | Export UI | 4 | NarrativeAgent |

### Task 0: Data Model Validation (4 hours)

**Purpose**: Verify existing Zod schemas in `packages/shared/src/domain/` support all MVP critical path requirements before implementation begins.

**Validation Checklist**:
```typescript
// Required for ModelStage API (assumption editing)
AssumptionSchema: {
  id: string,
  name: string,
  value: string,           // String to preserve precision
  unit: string,
  sensitivity_low?: string, // For scenario generation
  sensitivity_high?: string,
  version: number,          // For tracking edits
  organization_id: string   // Tenant isolation
}

// Required for Integrity Wiring
BusinessCaseSchema: {
  id: string,
  integrity_score: number,  // 0-1 score for gating
  integrity_check_passed: boolean,
  integrity_evaluated_at: string, // ISO timestamp
  veto_reason?: string      // If blocked
}

// Required for Economic Kernel → Narrative flow
ValueHypothesisSchema: {
  id: string,
  financial_summary: {
    npv: string,           // Decimal as string
    irr: string,
    roi: string,
    payback_months: number,
    scenarios: { conservative, base, upside }
  }
}

// Required for Opportunity lifecycle
OpportunitySchema: {
  id: string,
  stage: enum,             // discovery → modeling → review → etc.
  can_advance_stage(): boolean  // Method checking integrity_score >= 0.6
}
```

**Acceptance Criteria**:
- [ ] All required fields present in domain schemas
- [ ] Tenant isolation (`organization_id`) on every entity
- [ ] Financial precision uses `string` (Decimal) not `number`
- [ ] Assumption schema supports version tracking and sensitivity ranges
- [ ] BusinessCase schema includes integrity gating fields
- [ ] Migration strategy documented if schema changes needed

**Sign-off**: Data model review with Engineer + Architect before Task 1-7 implementation

---

### Task 1: Economic Kernel (8 hours)

- **Work Backwards:** Define final criteria first, then build toward them.
- **Automated Tests:** Implement CI tests and a test harness early.
- **Straightforward Process:** Use agile practices (daily standups, CI/CD) instead of research-level chains.
- **Skip Overhead:** Avoid LLM self-correction for code tasks; rely on conventional engineering workflows.

## Test Implementation & Acceptance Criteria

### End-to-End Test Harness

**Purpose**: Automated validation that model creation completes within 5 minutes with correct outputs.

**Implementation**:
```typescript
// test/harness/model-creation.e2e.test.ts
describe('Model Creation MVP Harness', () => {
  it('completes end-to-end in < 5 minutes', async () => {
    const startTime = Date.now();

    // 1. Dashboard: Create opportunity
    const opportunity = await createTestOpportunity();

    // 2. Discovery: Generate hypotheses
    const hypotheses = await runDiscoveryAgent(opportunity.id);
    expect(hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(hypotheses.length).toBeLessThanOrEqual(5);

    // 3. Modeling: Calculate financials
    const model = await runModelingAgent(opportunity.id);
    expect(model.npv).toBeDefined();
    expect(model.irr).toBeDefined();
    expect(model.roi).toBeDefined();

    // 4. Integrity: Pass validation
    const integrity = await runIntegrityCheck(opportunity.id);
    expect(integrity.pass).toBe(true);
    expect(integrity.integrityScore).toBeGreaterThanOrEqual(0.6);

    // 5. Narrative: Generate PDF
    const pdf = await generateNarrative(opportunity.id);
    expect(pdf).toBeDefined();
    expect(pdf.length).toBeGreaterThan(0);

    // 6. Verify timing
    const elapsedMs = Date.now() - startTime;
    expect(elapsedMs).toBeLessThan(5 * 60 * 1000); // 5 minutes
  });
});
```

---

### Component-Specific Test Specifications

#### 1. Economic Kernel (8 hours)

**Unit Tests**:
```typescript
// packages/backend/src/lib/economic-kernel/__tests__/kernel.test.ts
describe('EconomicKernel', () => {
  describe('calculateNPV', () => {
    it('computes correctly with known inputs', () => {
      const cashFlows = ['-1000', '300', '400', '400', '300'].map(Decimal);
      const rate = new Decimal('0.1');
      const npv = kernel.calculateNPV(cashFlows, rate);
      expect(npv.toString()).toBe('178.29'); // Known correct value
    });

    it('uses Decimal precision (no floating point errors)', () => {
      const result = new Decimal('0.1').plus('0.2');
      expect(result.toString()).toBe('0.3'); // Not 0.30000000000000004
    });
  });

  describe('calculateIRR', () => {
    it('returns null for unsolvable cash flows', () => {
      const flows = ['100', '100'].map(Decimal); // No investment, all positive
      expect(kernel.calculateIRR(flows)).toBeNull();
    });

    it('converges within 100 iterations', () => {
      const flows = ['-1000', '300', '400', '400', '300'].map(Decimal);
      const irr = kernel.calculateIRR(flows);
      expect(irr).toBeDefined();
      expect(irr!.toNumber()).toBeGreaterThan(0.14);
      expect(irr!.toNumber()).toBeLessThan(0.15);
    });
  });

  describe('generateScenarios', () => {
    it('produces conservative < base < upside', () => {
      const scenarios = kernel.generateScenarios(baseAssumptions, ranges);
      expect(scenarios.conservative.npv).toBeLessThan(scenarios.base.npv);
      expect(scenarios.base.npv).toBeLessThan(scenarios.upside.npv);
    });
  });
});
```

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] NPV/IRR calculations match Excel/Google Sheets to ±0.01%
- [ ] Decimal precision verified (0.1 + 0.2 = 0.3 exactly)
- [ ] Scenario generation produces 3 valid scenarios
- [ ] Calculation time < 100ms for 10-year cash flow

---

#### 2. Dashboard "Go" Button (2 hours)

**Unit Tests**:
```typescript
// apps/ValyntApp/src/components/dashboard/__tests__/Dashboard.test.tsx
describe('Dashboard Create Case', () => {
  it('creates opportunity on button click', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByText('Go'));

    await waitFor(() => {
      expect(mockCreateOpportunity).toHaveBeenCalled();
    });
  });

  it('navigates to discovery after creation', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByText('Go'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/discover/'));
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Button click creates opportunity via API
- [ ] Navigation to `/discover/:id` occurs within 2 seconds
- [ ] Opportunity has correct initial stage ('discovery')
- [ ] Error handling for API failure (retry or message shown)

---

#### 3. Discovery Agent (16 hours)

**Unit Tests**:
```typescript
// packages/backend/src/lib/agent-fabric/agents/__tests__/DiscoveryAgent.test.ts
describe('DiscoveryAgent', () => {
  it('generates 3-5 hypotheses', async () => {
    const output = await agent.execute({ opportunityId: 'test-opp' });
    expect(output.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(output.hypotheses.length).toBeLessThanOrEqual(5);
  });

  it('attaches silver+ evidence to each hypothesis', async () => {
    const output = await agent.execute({ opportunityId: 'test-opp' });

    for (const h of output.hypotheses) {
      const evidence = await fetchEvidence(h.id);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence.some(e => ['silver', 'gold', 'platinum'].includes(e.tier))).toBe(true);
    }
  });

  it('completes in < 30 seconds', async () => {
    const start = Date.now();
    await agent.execute({ opportunityId: 'test-opp' });
    expect(Date.now() - start).toBeLessThan(30000);
  });

  it('produces valid ValueHypothesis schema', async () => {
    const output = await agent.execute({ opportunityId: 'test-opp' });

    for (const h of output.hypotheses) {
      expect(() => ValueHypothesisSchema.parse(h)).not.toThrow();
    }
  });
});
```

**Integration Tests**:
```typescript
describe('DiscoveryAgent Integration', () => {
  it('streams real-time updates to UI', async () => {
    const stream = await agent.executeStreaming({ opportunityId: 'test-opp' });
    const updates: any[] = [];

    for await (const update of stream) {
      updates.push(update);
    }

    expect(updates.length).toBeGreaterThan(1); // Multiple streaming updates
    expect(updates[updates.length - 1].complete).toBe(true);
  });
});
```

**Acceptance Criteria**:
- [ ] Generates 3-5 hypotheses per opportunity
- [ ] Each hypothesis has attached evidence (silver tier minimum)
- [ ] Execution completes in < 30 seconds
- [ ] Outputs pass Zod schema validation
- [ ] Streaming updates reach UI in real-time
- [ ] AgentThread not hardcoded (uses real API)

---

#### 4. NarrativeAgent (16 hours)

**Unit Tests**:
```typescript
// packages/backend/src/lib/agent-fabric/agents/__tests__/NarrativeAgent.test.ts
describe('NarrativeAgent', () => {
  it('generates PDF from BusinessCase', async () => {
    const pdf = await agent.generateExecutiveSummary(caseId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000); // Non-empty PDF
  });

  it('includes financial numbers from kernel', async () => {
    const pdf = await agent.generateExecutiveSummary(caseId);
    const text = await extractPdfText(pdf);

    expect(text).toContain(model.npv.toString());
    expect(text).toContain(model.irr.toString());
    expect(text).toContain(model.roi.toString());
  });

  it('completes in < 5 seconds', async () => {
    const start = Date.now();
    await agent.generateExecutiveSummary(caseId);
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('produces valid PDF structure', async () => {
    const pdf = await agent.generateExecutiveSummary(caseId);
    expect(isValidPdf(pdf)).toBe(true);
  });
});
```

**Acceptance Criteria**:
- [ ] PDF generation completes in < 5 seconds
- [ ] PDF contains financial numbers matching Economic Kernel output
- [ ] PDF structure valid (can be opened in standard readers)
- [ ] Executive summary section present
- [ ] File size reasonable (< 5MB for typical case)

---

#### 5. ModelStage API (12 hours)

**Unit Tests**:
```typescript
// packages/backend/src/api/modelStage/__tests__/modelStage.test.ts
describe('ModelStage API', () => {
  it('returns real financial model (not hardcoded)', async () => {
    const response = await request(app)
      .get(`/api/v1/opportunities/${oppId}/financial-model`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.npv).not.toBe(123456); // Not a hardcoded value
    expect(response.body.calculatedAt).toBeDefined(); // Has timestamp
  });

  it('recalculates when assumptions change', async () => {
    const before = await getModel(oppId);

    // Update assumption
    await updateAssumption(oppId, assumptionId, { value: '100' });

    const after = await getModel(oppId);
    expect(after.npv).not.toBe(before.npv); // Recalculated
  });

  it('returns scenarios (conservative/base/upside)', async () => {
    const response = await request(app)
      .get(`/api/v1/opportunities/${oppId}/financial-model`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.body.scenarios).toBeDefined();
    expect(response.body.scenarios.conservative).toBeDefined();
    expect(response.body.scenarios.base).toBeDefined();
    expect(response.body.scenarios.upside).toBeDefined();
  });

  it('handles edit assumptions via API', async () => {
    const response = await request(app)
      .patch(`/api/v1/opportunities/${oppId}/assumptions/${assumptionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '150' });

    expect(response.status).toBe(200);
    expect(response.body.assumption.value).toBe('150');
  });
});
```

**Acceptance Criteria**:
- [ ] API returns real Economic Kernel calculations (no hardcoded data)
- [ ] Assumption updates trigger recalculation
- [ ] Scenarios (conservative/base/upside) included in response
- [ ] Edit assumptions endpoint functional
- [ ] Response time < 1 second for model fetch
- [ ] UI shows actual kernel outputs (not mock data)

---

#### 6. Integrity Wiring (8 hours)

**Unit Tests**:
```typescript
// packages/backend/src/api/integrity/__tests__/integrity.test.ts
describe('IntegrityAgent Enforcement', () => {
  it('blocks advancement if integrity_score < 0.6', async () => {
    // Setup case with low score
    await createCaseWithLowIntegrity(oppId);

    const response = await request(app)
      .post(`/api/v1/opportunities/${oppId}/advance-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStage: 'in_review' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Integrity check failed');
    expect(response.body.remediation).toBeDefined();
  });

  it('allows advancement if integrity_score >= 0.6', async () => {
    // Setup case with passing score
    await createCaseWithPassingIntegrity(oppId);

    const response = await request(app)
      .post(`/api/v1/opportunities/${oppId}/advance-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStage: 'in_review' });

    expect(response.status).toBe(200);
  });

  it('returns remediation instructions on failure', async () => {
    const response = await request(app)
      .post(`/api/v1/opportunities/${oppId}/advance-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStage: 'in_review' });

    expect(response.body.remediationInstructions).toBeInstanceOf(Array);
    expect(response.body.remediationInstructions.length).toBeGreaterThan(0);
  });

  it('logs all integrity evaluations', async () => {
    await request(app)
      .post(`/api/v1/opportunities/${oppId}/advance-stage`)
      .set('Authorization', `Bearer ${token}`);

    const logs = await fetchIntegrityLogs(oppId);
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

**Acceptance Criteria**:
- [ ] integrity_score < 0.6 blocks stage advancement (HTTP 403)
- [ ] integrity_score >= 0.6 allows stage advancement
- [ ] Remediation instructions provided on failure
- [ ] UI shows "Next" button disabled when score insufficient
- [ ] All evaluations logged with full context
- [ ] Stage transition API enforces integrity check

---

#### 7. Export UI (4 hours)

**Unit Tests**:
```typescript
// apps/ValyntApp/src/components/export/__tests__/ExportPanel.test.tsx
describe('Export UI', () => {
  it('downloads PDF on button click', async () => {
    const user = userEvent.setup();
    render(<ExportPanel caseId="test-case" />);

    await user.click(screen.getByText('Download Executive Summary PDF'));

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/test-case/narrative/download'),
        '_blank'
      );
    });
  });

  it('disables button when integrity check not passed', () => {
    render(<ExportPanel caseId="test-case" integrityCheckPassed={false} />);

    expect(screen.getByText('Download Executive Summary PDF')).toBeDisabled();
  });

  it('shows loading state during generation', async () => {
    const user = userEvent.setup();
    render(<ExportPanel caseId="test-case" />);

    await user.click(screen.getByText('Download Executive Summary PDF'));

    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });
});
```

**Acceptance Criteria**:
- [ ] Button click triggers PDF download
- [ ] Button disabled when integrity check not passed
- [ ] Loading state shown during generation
- [ ] Error handling for generation failure
- [ ] Opens download in new tab/window

---

### Synthetic Test Data Specification

**Purpose**: Enable testing without production data or external APIs.

```typescript
// test/fixtures/synthetic-data.ts
export const syntheticOpportunity = {
  id: 'test-opp-001',
  name: 'Test Manufacturing Value Case',
  accountId: 'test-account-001',
  industry: 'manufacturing',
  stage: 'discovery',
  context: {
    employees: 500,
    annualRevenue: 50000000,
    currentOEE: 0.65,
    targetOEE: 0.75
  }
};

export const syntheticAssumptions = [
  {
    id: 'assumption-001',
    name: 'Labor Rate',
    value: '65.00',
    unit: 'USD/hr',
    source: 'industry_benchmark',
    validFrom: '2024-01-01',
    validTo: null
  },
  {
    id: 'assumption-002',
    name: 'OEE Improvement',
    value: '0.10',
    unit: 'percentage_points',
    source: 'calculated',
    sensitivityLow: '0.8',
    sensitivityHigh: '1.2'
  }
];

export const syntheticHypotheses = [
  {
    id: 'hypothesis-001',
    description: 'Reduce downtime by 15% through predictive maintenance',
    category: 'cost_reduction',
    estimatedValueLow: '450000',
    estimatedValueHigh: '600000',
    confidence: 0.75,
    status: 'validated'
  }
];

export const expectedKernelOutput = {
  npv: '523456.78',
  irr: '0.2345',
  roi: '156.78',
  paybackMonths: 14,
  scenarios: {
    conservative: { npv: '398765.43', irr: '0.1892' },
    base: { npv: '523456.78', irr: '0.2345' },
    upside: { npv: '698123.45', irr: '0.2891' }
  }
};
```

---

### Completion Gates

Each component must pass its acceptance criteria before proceeding:

| Gate | Criteria | Sign-off |
|------|----------|----------|
| **Data Model Validated** | Schemas support assumptions, integrity gating, financial precision; tenant isolation verified; migration plan ready | Engineer + Architect |
| **Economic Kernel Complete** | All unit tests pass; NPV matches Excel ±0.01%; Decimal precision verified; < 100ms calc time | Engineer + Code Review |
| **Dashboard Complete** | E2E test passes; button creates opportunity; navigation works; < 2s total | Engineer + QA |
| **Discovery Complete** | Generates 3-5 hypotheses; silver+ evidence; < 30s; streaming works; schema valid | Engineer + Product |
| **ModelStage Complete** | Real API (no hardcoded); scenarios present; assumption edit works; < 1s response | Engineer + QA |
| **Integrity Complete** | Veto blocks < 0.6; passes >= 0.6; remediation shown; logs written | Engineer + Product |
| **Narrative Complete** | PDF < 5s; contains correct numbers; valid structure | Engineer + QA |
| **Export Complete** | Download works; respects integrity check; loading state | Engineer + QA |
| **MVP Complete** | Full E2E harness passes; < 5 minutes; all gates passed | Team Lead + Demo |

---

### Regression Prevention

**CI/CD Pipeline**:
```yaml
# .github/workflows/mvp-tests.yml
name: MVP Test Harness
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Economic Kernel Tests
        run: pnpm test packages/backend/src/lib/economic-kernel
      - name: Run Agent Tests
        run: pnpm test packages/backend/src/lib/agent-fabric
      - name: Run API Tests
        run: pnpm test packages/backend/src/api
      - name: Run E2E Harness
        run: pnpm test test/harness/model-creation.e2e.test.ts
      - name: Performance Check
        run: pnpm test test/performance/model-creation-timing.test.ts
```

**Pre-commit Hooks**:
```json
// .husky/pre-commit
{
  "*.ts": ["eslint", "prettier --check"],
  "*.{test,spec}.ts": ["vitest run --related"]
}
```

---

### Progress Tracker

| Component | Est. Hours | Status | Tests Pass | E2E Pass | Notes |
|-----------|------------|--------|------------|----------|-------|
| Data Model Validation | 4 | ⬜ Not Started | ⬜ | ⬜ | Prerequisite for all tasks |
| Economic Kernel | 8 | ⬜ Not Started | ⬜ | ⬜ | Foundation |
| Dashboard "Go" | 2 | ⬜ Not Started | ⬜ | ⬜ | Quick win |
| Discovery Agent | 16 | ⬜ Not Started | ⬜ | ⬜ | Can mock ModelStage |
| ModelStage API | 12 | ⬜ Not Started | ⬜ | ⬜ | Needs Economic Kernel |
| Integrity Wiring | 8 | ⬜ Not Started | ⬜ | ⬜ | Needs ModelStage |
| NarrativeAgent | 16 | ⬜ Not Started | ⬜ | ⬜ | Needs Economic Kernel |
| Export UI | 4 | ⬜ Not Started | ⬜ | ⬜ | Needs NarrativeAgent |
| **Full E2E** | — | ⬜ Not Started | ⬜ | ⬜ | < 5 min target |

Update this tracker as components complete.

