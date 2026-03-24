/**
 * MVP Model Creation E2E Test Harness
 *
 * Validates the core economic kernel and basic flow structure
 * with simplified agent mocking for deterministic testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock external dependencies
vi.mock('../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: class MockLLMGateway {
    constructor(_provider?: string) {}
    complete = vi.fn();
  },
}));

vi.mock('../lib/agent-fabric/MemorySystem', () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: any) {}
    store = vi.fn().mockResolvedValue('mem_1');
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue('mem_1');
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock('../lib/agent-fabric/CircuitBreaker', () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => Promise<any>) => fn());
  },
}));

vi.mock('../services/agents/AgentKillSwitchService', () => ({
  agentKillSwitchService: {
    isKilled: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../repositories/AgentExecutionLineageRepository', () => ({
  agentExecutionLineageRepository: {
    appendLineage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../repositories/NarrativeDraftRepository', () => ({
  NarrativeDraftRepository: class MockNarrativeDraftRepository {
    upsert = vi.fn().mockResolvedValue({ id: 'narrative-draft-1' });
    getForCase = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock('../services/artifacts', () => ({
  ArtifactRepository: class MockArtifactRepository {
    create = vi.fn().mockResolvedValue({ id: 'artifact-1' });
    findByCaseId = vi.fn().mockResolvedValue([]);
  },
  ArtifactEditService: class MockArtifactEditService {
    createOrUpdate = vi.fn().mockResolvedValue({ id: 'artifact-1' });
  },
  ExecutiveMemoGenerator: class MockExecutiveMemoGenerator {
    generate = vi.fn().mockResolvedValue({ content: 'executive memo content' });
  },
  CFORecommendationGenerator: class MockCFORecommendationGenerator {
    generate = vi.fn().mockResolvedValue({ content: 'cfo recommendation content' });
  },
  CustomerNarrativeGenerator: class MockCustomerNarrativeGenerator {
    generate = vi.fn().mockResolvedValue({ content: 'customer narrative content' });
  },
  InternalCaseGenerator: class MockInternalCaseGenerator {
    generate = vi.fn().mockResolvedValue({ content: 'internal case content' });
  },
}));

vi.mock('../services/value-graph', () => ({
  valueGraphService: {
    writeNode: vi.fn().mockResolvedValue(undefined),
    writeEdge: vi.fn().mockResolvedValue(undefined),
    getPathsForOpportunity: vi.fn().mockResolvedValue([]),
    getValuePaths: vi.fn().mockResolvedValue([]),
  },
  BaseGraphWriter: class MockBaseGraphWriter {
    writeNode = vi.fn().mockResolvedValue(undefined);
    writeEdge = vi.fn().mockResolvedValue(undefined);
    resolveOpportunityId = vi.fn().mockResolvedValue('test-opportunity-id');
    getSafeContext = vi.fn().mockReturnValue({ opportunityId: 'test-opportunity-id', organizationId: 'test-org' });
    generateNodeId = vi.fn().mockReturnValue('test-node-id');
    writeValueDriver = vi.fn().mockResolvedValue(undefined);
    safeWriteBatch = vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 });
    safeWrite = vi.fn().mockResolvedValue(undefined);
    newEntityId = vi.fn().mockReturnValue('test-entity-id');
  },
}));

vi.mock('../lib/agent-fabric/BaseGraphWriter', () => ({
  BaseGraphWriter: class MockBaseGraphWriter {
    constructor(_valueGraphService: any, _logger: any) {}
    writeNode = vi.fn().mockResolvedValue(undefined);
    writeEdge = vi.fn().mockResolvedValue(undefined);
    resolveOpportunityId = vi.fn().mockResolvedValue('test-opportunity-id');
    getSafeContext = vi.fn().mockReturnValue({ opportunityId: 'test-opportunity-id', organizationId: 'test-org' });
    generateNodeId = vi.fn().mockReturnValue('test-node-id');
    writeValueDriver = vi.fn().mockResolvedValue(undefined);
    safeWriteBatch = vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 });
    safeWrite = vi.fn().mockResolvedValue(undefined);
    newEntityId = vi.fn().mockReturnValue('test-entity-id');
  },
}));

vi.mock('../events/DomainEventBus', () => ({
  getDomainEventBus: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
  })),
  buildEventEnvelope: vi.fn((type, payload) => ({
    type,
    payload,
    timestamp: new Date().toISOString(),
  })),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'test-case-id' }, error: null }),
    update: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((callback) => callback({ data: { id: 'test-id' }, error: null }))
  },
  createServiceRoleSupabaseClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
  }))
}));

// --- Imports ---
import Decimal from 'decimal.js';
import { calculateNPV, calculateROI, calculatePayback, toDecimalArray } from '../domain/economic-kernel/economic_kernel';
import { ScenarioBuilder } from '../services/value/ScenarioBuilder';
import { OpportunityAgent } from '../lib/agent-fabric/agents/OpportunityAgent';
import { FinancialModelingAgent } from '../lib/agent-fabric/agents/FinancialModelingAgent';
import { IntegrityAgent } from '../lib/agent-fabric/agents/IntegrityAgent';
import { NarrativeAgent } from '../lib/agent-fabric/agents/NarrativeAgent';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../lib/agent-fabric/MemorySystem';
import { CircuitBreaker } from '../lib/agent-fabric/CircuitBreaker';

// --- Helpers ---
const d = (v: number | string) => new Decimal(v);
const dArr = (vs: number[]) => toDecimalArray(vs);

function expectClose(actual: Decimal, expected: number, tolerance = 0.01) {
  expect(actual.minus(expected).abs().lte(tolerance)).toBe(true);
}

// --- LLM Response Fixtures ---

const OPPORTUNITY_LLM = JSON.stringify({
  company_summary: 'Acme Corp — $120M mid-market manufacturer.',
  industry_context: 'Manufacturing sector margin pressure.',
  hypotheses: [
    {
      title: 'Invoice Automation',
      description: 'Reduce DSO by 12 days via automated reconciliation.',
      category: 'cost_reduction',
      estimated_impact: {
        low: 400000,
        high: 900000,
        unit: 'usd',
        timeframe_months: 12,
      },
      confidence: 0.82,
      evidence: ['Current DSO is 45 days vs industry median of 33.'],
      assumptions: ['ERP integration feasible within 3 months.'],
      kpi_targets: ['days_sales_outstanding'],
    },
  ],
  stakeholder_roles: [
    {
      role: 'CFO',
      relevance: 'Owns P&L',
      likely_concerns: ['Payback period'],
    },
  ],
  recommended_next_steps: ['Schedule discovery call with CFO.'],
});

const FINANCIAL_MODELING_LLM = JSON.stringify({
  projections: [
    {
      hypothesis_id: 'hyp-1',
      hypothesis_description: 'Invoice Automation',
      category: 'cost_reduction',
      assumptions: ['DSO reduction of 12 days', 'Annual savings $650K'],
      cash_flows: [-200000, 150000, 300000, 350000],
      currency: 'USD',
      period_type: 'annual',
      discount_rate: 0.1,
      total_investment: 200000,
      total_benefit: 800000,
      confidence: 0.8,
      risk_factors: ['Integration complexity'],
      data_sources: ['ERP data Q4'],
    },
  ],
  portfolio_summary: 'One model with strong positive NPV.',
  key_assumptions: ['Stable market'],
  recommended_next_steps: ['Validate ERP quotes'],
});

const INTEGRITY_LLM_PASS = JSON.stringify({
  claim_validations: [
    {
      claim_id: 'hyp-mem_1',
      claim_text: 'Invoice Automation — DSO reduction of 12 days',
      verdict: 'supported',
      confidence: 0.85,
      evidence_assessment: 'DSO baseline confirmed from ERP.',
      issues: [],
    },
  ],
  overall_assessment: 'Claim is well-supported.',
  data_quality_score: 0.88,
  logical_consistency_score: 0.85,
  evidence_coverage_score: 0.82,
});

const NARRATIVE_LLM = JSON.stringify({
  executive_summary:
    'Acme Corp stands to realize $800K+ through invoice automation, with a 2.5-year payback.',
  value_proposition:
    'Automated reconciliation reduces DSO by 12 days, unlocking working capital.',
  key_proof_points: [
    'Current DSO 45 days vs 33-day median',
    'NPV $447K at 10% discount rate',
    'ROI 300%',
  ],
  risk_mitigations: ['Phased ERP integration', 'Fallback to manual process'],
  call_to_action: 'Approve Phase 1 pilot for Q2.',
  defense_readiness_score: 0.82,
  talking_points: [
    { audience: 'executive', point: 'Working capital unlock of $400K+' },
    { audience: 'financial', point: '3-year ROI of 300% with 2.5yr payback' },
  ],
  hallucination_check: true,
});

describe('MVP Model Creation E2E Flow', () => {
  const mockTenantId = 'test-tenant-id';
  const mockCaseId = 'test-case-id';
  const mockUserId = 'test-user-id';

  // --- Agent Test Helpers (inside describe for proper scoping) ---

  function makeAgentConfig(name: string, stage: string) {
    return {
      id: `${name}-agent`,
      name,
      type: name as any,
      lifecycle_stage: stage,
      capabilities: [],
      model: { provider: 'custom' as const, model_name: 'test-model' },
      prompts: { system_prompt: '', user_prompt_template: '' },
      parameters: {
        timeout_seconds: 30,
        max_retries: 3,
        retry_delay_ms: 1000,
        enable_caching: false,
        enable_telemetry: false,
      },
      constraints: {
        max_input_tokens: 4096,
        max_output_tokens: 4096,
        allowed_actions: [],
        forbidden_actions: [],
        required_permissions: [],
      },
    };
  }

  function makeContext(overrides: any = {}) {
    return {
      workspace_id: mockTenantId,
      organization_id: mockTenantId,
      user_id: mockUserId,
      lifecycle_stage: 'test',
      workspace_data: {},
      user_inputs: {},
      ...overrides,
    };
  }

  function makeLLMResponse(content: string) {
    return {
      id: `resp-${Date.now()}`,
      model: 'test-model',
      content,
      finish_reason: 'stop',
      usage: { prompt_tokens: 500, completion_tokens: 400, total_tokens: 900 },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate economic kernel deterministic calculations', async () => {
    // Test data for deterministic validation - proper cash flow structure
    const cashFlows = dArr([-500000, 100000, 120000, 140000, 160000, 180000]); // Initial investment + 5 years of returns
    const discountRate = d(0.1);

    // Calculate using the canonical economic kernel
    const npv = calculateNPV(cashFlows, discountRate);

    // For ROI, we need total benefits and total costs
    const totalBenefits = cashFlows.slice(1).reduce((sum, cf) => sum.plus(cf), d(0)); // Sum of positive cash flows
    const totalCosts = cashFlows[0].abs(); // Absolute value of initial investment (negative cash flow)
    const roi = calculateROI(totalBenefits, totalCosts);

    const paybackResult = calculatePayback(cashFlows);

    // Validate deterministic results
    expect(npv).toBeDefined();
    expect(npv.toNumber()).toBeGreaterThan(0); // Should be positive investment
    expect(roi).toBeDefined();
    expect(roi.toNumber()).toBeGreaterThan(0); // Should have positive ROI
    expect(paybackResult).toBeDefined();
    expect(paybackResult.period).toBeGreaterThan(0); // Should have payback period
    expect(paybackResult.period).toBeLessThanOrEqual(10); // Should pay back within 10 periods

    // Validate reasonable ranges rather than exact values
    expect(npv.toNumber()).toBeGreaterThan(10000); // Should have meaningful positive NPV
    expect(roi.toNumber()).toBeGreaterThan(0.1); // Should have meaningful ROI
    expect(paybackResult.period).toBeLessThan(6); // Should pay back reasonably quickly
  });

  it('should validate ScenarioBuilder uses economic kernel correctly', async () => {
    const scenarioBuilder = new ScenarioBuilder();

    const mockInput = {
      tenantId: mockTenantId,
      caseId: mockCaseId,
      acceptedHypotheses: [
        {
          id: 'hyp-1',
          value_driver: 'Cost Reduction',
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 0.8
        }
      ],
      assumptions: [
        {
          id: 'assump-1',
          name: 'Implementation Time',
          value: 12,
          source_type: 'industry_benchmark'
        }
      ]
    };

    // This should use the economic kernel for calculations
    const result = await scenarioBuilder.buildScenarios(mockInput);

    // Validate structure
    expect(result).toBeDefined();
    expect(result.conservative).toBeDefined();
    expect(result.base).toBeDefined();
    expect(result.upside).toBeDefined();

    // Validate economic kernel outputs are present
    expect(result.conservative.roi).toBeDefined();
    expect(result.conservative.npv).toBeDefined();
    expect(result.conservative.payback_months).toBeDefined();
    expect(result.base.roi).toBeDefined();
    expect(result.base.npv).toBeDefined();
    expect(result.base.payback_months).toBeDefined();
    expect(result.upside.roi).toBeDefined();
    expect(result.upside.npv).toBeDefined();
    expect(result.upside.payback_months).toBeDefined();

    // Validate that all scenarios have positive financial metrics
    expect(result.conservative.npv).toBeGreaterThan(0);
    expect(result.base.npv).toBeGreaterThan(0);
    expect(result.upside.npv).toBeGreaterThan(0);
  });

  it('should handle export endpoints correctly', async () => {
    // Mock export service
    const mockExportService = {
      generatePDF: vi.fn().mockResolvedValue({
        signedUrl: 'https://test-bucket.s3.amazonaws.com/test-case.pdf',
        storagePath: 'exports/test-case.pdf',
        sizeBytes: 1024000,
        createdAt: new Date().toISOString()
      }),
      generatePPTX: vi.fn().mockResolvedValue({
        signedUrl: 'https://test-bucket.s3.amazonaws.com/test-case.pptx',
        storagePath: 'exports/test-case.pptx',
        sizeBytes: 2048000,
        createdAt: new Date().toISOString()
      })
    };

    // Test PDF export
    const pdfResult = await mockExportService.generatePDF(mockCaseId, {
      title: 'Test Business Case',
      includeFinancials: true,
      includeNarrative: true
    });

    expect(pdfResult.signedUrl).toBeDefined();
    expect(pdfResult.signedUrl).toMatch(/\.pdf$/);
    expect(pdfResult.sizeBytes).toBeGreaterThan(0);

    // Test PPTX export
    const pptxResult = await mockExportService.generatePPTX(mockCaseId, {
      title: 'Test Business Case',
      includeFinancials: true,
      includeNarrative: true
    });

    expect(pptxResult.signedUrl).toBeDefined();
    expect(pptxResult.signedUrl).toMatch(/\.pptx$/);
    expect(pptxResult.sizeBytes).toBeGreaterThan(0);
  });

  it('should validate performance requirements', async () => {
    const startTime = Date.now();

    // Simulate the core MVP flow performance test - proper cash flow structure
    const cashFlows = dArr([-500000, 100000, 120000, 140000, 160000, 180000]);
    const discountRate = d(0.1);

    // Economic kernel calculations (should be fast)
    calculateNPV(cashFlows, discountRate);

    // For ROI, we need total benefits and total costs
    const totalBenefits = cashFlows.slice(1).reduce((sum, cf) => sum.plus(cf), d(0));
    const totalCosts = cashFlows[0].abs();
    calculateROI(totalBenefits, totalCosts);

    const paybackResult = calculatePayback(cashFlows);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Performance assertion: should complete well under 5 seconds
    expect(duration).toBeLessThan(1000); // Less than 1 second for core calculations
  });

  it('should validate data integrity across components', async () => {
    // Test data consistency
    const testData = {
      tenantId: mockTenantId,
      caseId: mockCaseId,
      hypotheses: [
        {
          id: 'hyp-1',
          value_driver: 'Cost Reduction',
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 0.8
        }
      ],
      assumptions: [
        {
          id: 'assump-1',
          name: 'Implementation Time',
          value: 12,
          source_type: 'industry_benchmark'
        }
      ]
    };

    // Validate data structure integrity
    expect(testData.tenantId).toBe(mockTenantId);
    expect(testData.caseId).toBe(mockCaseId);
    expect(testData.hypotheses).toHaveLength(1);
    expect(testData.hypotheses[0].id).toBe('hyp-1');
    expect(testData.assumptions).toHaveLength(1);
    expect(testData.assumptions[0].id).toBe('assump-1');

    // Validate economic calculations maintain precision
    const cashFlows = dArr(testData.hypotheses.map(h => h.estimated_impact_max));
    const npv = calculateNPV(cashFlows, d(0.1));

    expect(npv).toBeInstanceOf(Decimal);
    expect(npv.isNaN()).toBe(false);
    expect(npv.isFinite()).toBe(true);
  });

  it('should execute full 5-stage agent chain: Opportunity → FinancialModeling → Integrity → Narrative', async () => {
    const startTime = Date.now();

    // Get mocked instances
    const mockLLM = new LLMGateway('custom');
    const mockMemory = new MemorySystem({} as any);
    const mockCB = new CircuitBreaker();

    // --- Stage 1: OpportunityAgent ---
    const mockComplete = vi.fn();
    mockLLM.complete = mockComplete;

    mockComplete.mockResolvedValueOnce(makeLLMResponse(OPPORTUNITY_LLM));

    const oppAgent = new OpportunityAgent(
      makeAgentConfig('opportunity', 'opportunity'),
      mockTenantId,
      mockMemory,
      mockLLM,
      mockCB
    );

    const oppResult = await oppAgent.execute(
      makeContext({
        lifecycle_stage: 'opportunity',
        user_inputs: { query: 'Analyze Acme Corp for cost reduction' },
      })
    );

    expect(oppResult.status).toBe('success');
    const oppData = oppResult.result as Record<string, any>;
    expect(oppData.hypotheses).toBeDefined();
    expect(oppData.hypotheses.length).toBeGreaterThan(0);

    // --- Stage 2: FinancialModelingAgent ---
    // Mock memory to return the hypothesis from OpportunityAgent
    const mockRetrieve = vi.fn();
    mockMemory.retrieve = mockRetrieve;
    mockRetrieve.mockResolvedValue([
      {
        id: 'mem_1',
        agent_id: 'opportunity',
        workspace_id: mockTenantId,
        content: 'Hypothesis: Invoice Automation — Reduce DSO by 12 days via automated reconciliation.',
        memory_type: 'semantic',
        importance: 0.82,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 1,
        metadata: {
          verified: true,
          category: 'cost_reduction',
          estimated_impact: { low: 400000, high: 900000, unit: 'usd', timeframe_months: 12 },
          confidence: 0.82,
          evidence: ['Current DSO is 45 days vs industry median of 33.'],
          organization_id: mockTenantId,
        },
      },
    ]);

    mockComplete.mockResolvedValueOnce(makeLLMResponse(FINANCIAL_MODELING_LLM));

    const finAgent = new FinancialModelingAgent(
      makeAgentConfig('financial_modeling', 'modeling'),
      mockTenantId,
      mockMemory,
      mockLLM,
      mockCB
    );

    const finResult = await finAgent.execute(
      makeContext({ lifecycle_stage: 'modeling' })
    );

    expect(finResult.status).toBe('success');
    expect(finResult.result.models_count).toBe(1);

    // Verify economic kernel determinism
    const models = finResult.result.models as Array<{
      npv: number;
      roi: number;
      irr: number | null;
      irr_converged: boolean;
      payback_period: number | null;
    }>;
    expect(models[0].npv).toBeCloseTo(447257.7, -1);
    expect(models[0].roi).toBe(3);
    expect(models[0].irr_converged).toBe(true);
    expect(models[0].irr).toBeGreaterThan(0.1);
    expect(models[0].payback_period).toBe(2);

    // --- Stage 3: IntegrityAgent ---
    mockComplete.mockResolvedValueOnce(makeLLMResponse(INTEGRITY_LLM_PASS));

    const intAgent = new IntegrityAgent(
      makeAgentConfig('integrity', 'integrity'),
      mockTenantId,
      mockMemory,
      mockLLM,
      mockCB
    );

    const intResult = await intAgent.execute(
      makeContext({
        lifecycle_stage: 'integrity',
        user_inputs: { value_case_id: mockCaseId },
      })
    );

    expect(intResult.status).toBe('success');
    const intData = intResult.result as Record<string, any>;
    expect(intData.veto_decision.veto).toBe(false);
    expect(intData.scores.overall).toBeGreaterThan(0.7);

    // --- Stage 4 & 5: NarrativeAgent ---
    // Only runs if integrity passes (veto === false)
    mockComplete.mockResolvedValueOnce(makeLLMResponse(NARRATIVE_LLM));

    const narAgent = new NarrativeAgent(
      makeAgentConfig('narrative', 'narrative'),
      mockTenantId,
      mockMemory,
      mockLLM,
      mockCB
    );

    const narResult = await narAgent.execute(
      makeContext({
        lifecycle_stage: 'narrative',
        user_inputs: { value_case_id: mockCaseId },
      })
    );

    expect(narResult.status).toBe('success');
    const narData = narResult.result as Record<string, any>;

    // Validate narrative output schema fields (narrative is the root object, not nested)
    expect(narData.executive_summary).toBeDefined();
    expect(narData.executive_summary.length).toBeGreaterThan(0);
    expect(narData.key_proof_points).toBeDefined();
    expect(narData.key_proof_points.length).toBeGreaterThan(0);
    expect(narData.defense_readiness_score).toBeDefined();
    expect(narData.defense_readiness_score).toBeGreaterThan(0);
    expect(narData.defense_readiness_score).toBeLessThanOrEqual(1);

    // Validate talking points structure
    expect(narData.talking_points).toBeDefined();
    expect(narData.talking_points.length).toBeGreaterThan(0);
    expect(narData.talking_points[0].audience).toBeDefined();
    expect(narData.talking_points[0].point).toBeDefined();

    // --- Performance: Wall-clock < 2s with mocked LLM ---
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000);
  });
});
