/**
 * Integration Tests for Advanced Agent Features
 * 
 * Tests the 3 new capabilities:
 * 1. Value Driver Taxonomy v2
 * 2. Multi-agent adversarial reasoning
 * 3. Retrieval-conditioned agents
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdversarialChallengeAgent,
  AdversarialReasoningOrchestrator,
  ChallengeInput,
  ExtractionInput,
  ReconciliationAgent,
  ReconciliationInput,
  ValueDriverExtractionAgent
} from '../../../src/lib/agent-fabric/agents/AdversarialReasoningAgents';
import {
  RetrievalConditionedAgent,
  RetrievalConfig,
  RetrievalEngine
} from '../../../src/lib/agent-fabric/RetrievalEngine';
import { ValueDriver } from '../../../src/types/valueDriverTaxonomy';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';
import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { AgentConfig } from '../../../src/types/agent';

// =====================================================
// TEST SETUP
// =====================================================

const mockSupabase = createBoltClientMock();
const mockLLMGateway = {
  complete: vi.fn(),
  generateEmbedding: vi.fn()
} as unknown as LLMGateway;

const mockMemorySystem = new MemorySystem(mockSupabase, mockLLMGateway);

const agentConfig: AgentConfig = {
  agentId: 'test-agent',
  llmGateway: mockLLMGateway,
  memorySystem: mockMemorySystem,
  auditLogger: { logActivity: vi.fn() } as any
};

// =====================================================
// VALUE DRIVER TAXONOMY V2 TESTS
// =====================================================

describe('ValueDriverExtractionAgent', () => {
  let agent: ValueDriverExtractionAgent;

  beforeEach(() => {
    agent = new ValueDriverExtractionAgent(agentConfig);
    vi.clearAllMocks();
  });

  it('should extract structured value drivers from discovery sources', async () => {
    const mockLLMResponse = {
      content: JSON.stringify({
        drivers: [
          {
            category: 'revenue',
            subcategory: 'conversion_rate',
            name: 'Lead Conversion Optimization',
            description: 'Improve lead-to-customer conversion through better qualification',
            economic_mechanism: 'ratio',
            confidence_score: 0.85,
            evidence: [
              {
                source_id: 'src_1',
                source_type: 'transcript',
                text: 'Our current conversion rate is 2.5%, industry average is 5%',
                relevance: 0.9,
                sentiment: 'neutral'
              }
            ],
            baseline_value: 2.5,
            baseline_unit: 'percent',
            target_value: 5.0,
            target_unit: 'percent',
            expected_delta: 2.5,
            delta_unit: 'percent',
            timeframe_months: 12,
            financial_impact: {
              annual_value: 250000,
              currency: 'USD',
              calculation_method: '1000 leads/mo * 2.5% increase * $10k ACV',
              confidence: 0.75
            }
          }
        ],
        extraction_confidence: 0.8,
        reasoning: 'Strong evidence from interview, clear baseline/target, industry benchmark available'
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const input: ExtractionInput = {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      discovery_sources: [
        {
          id: 'src_1',
          type: 'transcript',
          content: 'Interview excerpt: "Our current conversion rate is 2.5%, but we see competitors at 5%. If we could improve qualification..."'
        }
      ],
      context: {
        industry: 'B2B SaaS',
        company_size: '50-200 employees'
      }
    };

    const result = await agent.execute('session_1', input);

    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0].category).toBe('revenue');
    expect(result.drivers[0].subcategory).toBe('conversion_rate');
    expect(result.drivers[0].confidence_score).toBe(0.85);
    expect(result.drivers[0].evidence).toHaveLength(1);
    expect(result.extraction_confidence).toBe(0.8);
  });

  it('should generate unique driver IDs', async () => {
    const mockLLMResponse = {
      content: JSON.stringify({
        drivers: [
          { category: 'cost', subcategory: 'cycle_time', name: 'Driver 1', confidence_score: 0.7 },
          { category: 'risk', subcategory: 'compliance_violation', name: 'Driver 2', confidence_score: 0.6 }
        ],
        extraction_confidence: 0.65,
        reasoning: 'Test'
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const input: ExtractionInput = {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      discovery_sources: [{ id: 'src_1', type: 'document', content: 'Test content' }]
    };

    const result = await agent.execute('session_1', input);

    expect(result.drivers[0].id).toMatch(/^vd_\d+_[a-z0-9]{9}$/);
    expect(result.drivers[1].id).toMatch(/^vd_\d+_[a-z0-9]{9}$/);
    expect(result.drivers[0].id).not.toBe(result.drivers[1].id);
  });

  it('should store extraction in semantic memory', async () => {
    const mockLLMResponse = {
      content: JSON.stringify({
        drivers: [{ category: 'revenue', name: 'Test Driver', confidence_score: 0.8 }],
        extraction_confidence: 0.75,
        reasoning: 'Test'
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);
    const storeSemanticMemorySpy = vi.spyOn(mockMemorySystem, 'storeSemanticMemory');

    const input: ExtractionInput = {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      discovery_sources: [{ id: 'src_1', type: 'email', content: 'Test' }]
    };

    await agent.execute('session_1', input);

    expect(storeSemanticMemorySpy).toHaveBeenCalledWith(
      'session_1',
      'test-agent',
      expect.stringContaining('Extracted 1 value drivers'),
      expect.objectContaining({ extraction_confidence: 0.75 })
    );
  });
});

// =====================================================
// ADVERSARIAL REASONING TESTS
// =====================================================

describe('AdversarialChallengeAgent', () => {
  let agent: AdversarialChallengeAgent;

  beforeEach(() => {
    agent = new AdversarialChallengeAgent(agentConfig);
    vi.clearAllMocks();
  });

  it('should identify validation issues in value drivers', async () => {
    const mockLLMResponse = {
      content: JSON.stringify({
        validations: [
          {
            driver_id: 'vd_123',
            is_valid: false,
            validation_issues: [
              'Baseline value not supported by direct evidence',
              'Target assumes 100% adoption without change management considerations'
            ],
            supporting_evidence_count: 1,
            contradicting_evidence_count: 2,
            benchmark_alignment: 'above',
            final_confidence: 0.55,
            recommendations: [
              'Lower target from 5% to 4%',
              'Add adoption curve assumption (ramp over 6 months)'
            ]
          }
        ],
        overall_assessment: 'moderate',
        reasoning: 'Driver has merit but estimates are optimistic given contradicting evidence'
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const testDriver: ValueDriver = {
      id: 'vd_123',
      organization_id: 'org_123',
      value_case_id: 'case_456',
      category: 'revenue',
      subcategory: 'conversion_rate',
      name: 'Test Driver',
      description: 'Test',
      economic_mechanism: 'ratio',
      confidence_score: 0.85,
      evidence: [],
      baseline_value: 2.5,
      baseline_unit: 'percent',
      target_value: 5.0,
      target_unit: 'percent',
      expected_delta: 2.5,
      delta_unit: 'percent',
      timeframe_months: 12,
      financial_impact: {
        annual_value: 250000,
        currency: 'USD',
        calculation_method: 'test',
        confidence: 0.75
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const input: ChallengeInput = {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      drivers: [testDriver],
      discovery_sources: [
        { id: 'src_1', type: 'transcript', content: 'Contradicting evidence here...' }
      ]
    };

    const result = await agent.execute('session_1', input);

    expect(result.validations).toHaveLength(1);
    expect(result.validations[0].is_valid).toBe(false);
    expect(result.validations[0].validation_issues).toHaveLength(2);
    expect(result.validations[0].final_confidence).toBe(0.55);
    expect(result.overall_assessment).toBe('moderate');
  });
});

describe('ReconciliationAgent', () => {
  let agent: ReconciliationAgent;

  beforeEach(() => {
    agent = new ReconciliationAgent(agentConfig);
    vi.clearAllMocks();
  });

  it('should reconcile extraction and challenge findings', async () => {
    const mockLLMResponse = {
      content: JSON.stringify({
        final_drivers: [
          {
            id: 'vd_123',
            category: 'revenue',
            subcategory: 'conversion_rate',
            name: 'Lead Conversion (Adjusted)',
            confidence_score: 0.70,
            financial_impact: {
              annual_value: 200000,
              currency: 'USD',
              calculation_method: 'Conservative estimate post-review',
              confidence: 0.65
            }
          }
        ],
        reconciliation_summary: {
          drivers_accepted: 0,
          drivers_modified: 1,
          drivers_rejected: 0,
          overall_confidence: 0.70
        },
        audit_trail: [
          {
            driver_id: 'vd_123',
            action: 'modified',
            reason: 'Reduced target and financial impact due to adoption concerns',
            original_confidence: 0.85,
            final_confidence: 0.70
          }
        ],
        reasoning: 'Modified driver to address challenger concerns while preserving core value hypothesis'
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const testDriver: ValueDriver = {
      id: 'vd_123',
      organization_id: 'org_123',
      value_case_id: 'case_456',
      category: 'revenue',
      subcategory: 'conversion_rate',
      name: 'Original Driver',
      description: 'Test',
      economic_mechanism: 'ratio',
      confidence_score: 0.85,
      evidence: [],
      baseline_value: 2.5,
      baseline_unit: 'percent',
      target_value: 5.0,
      target_unit: 'percent',
      expected_delta: 2.5,
      delta_unit: 'percent',
      timeframe_months: 12,
      financial_impact: {
        annual_value: 250000,
        currency: 'USD',
        calculation_method: 'original',
        confidence: 0.75
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const input: ReconciliationInput = {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      original_drivers: [testDriver],
      extraction_reasoning: 'Extracted from interview',
      validations: [
        {
          driver_id: 'vd_123',
          is_valid: false,
          validation_issues: ['Target too optimistic'],
          supporting_evidence_count: 1,
          contradicting_evidence_count: 2,
          benchmark_alignment: 'above',
          final_confidence: 0.60,
          recommendations: ['Lower target']
        }
      ],
      challenge_reasoning: 'Estimates are optimistic'
    };

    const result = await agent.execute('session_1', input);

    expect(result.final_drivers).toHaveLength(1);
    expect(result.final_drivers[0].confidence_score).toBe(0.70);
    expect(result.reconciliation_summary.drivers_modified).toBe(1);
    expect(result.audit_trail).toHaveLength(1);
    expect(result.audit_trail[0].action).toBe('modified');
  });
});

describe('AdversarialReasoningOrchestrator', () => {
  it('should orchestrate full extraction → challenge → reconciliation workflow', async () => {
    const extractionAgent = new ValueDriverExtractionAgent(agentConfig);
    const challengeAgent = new AdversarialChallengeAgent(agentConfig);
    const reconciliationAgent = new ReconciliationAgent(agentConfig);
    const orchestrator = new AdversarialReasoningOrchestrator(
      extractionAgent,
      challengeAgent,
      reconciliationAgent
    );

    // Mock LLM responses for each stage
    vi.mocked(mockLLMGateway.complete)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          drivers: [
            {
              category: 'revenue',
              subcategory: 'conversion_rate',
              name: 'Driver A',
              confidence_score: 0.85,
              evidence: [],
              baseline_value: 10,
              baseline_unit: 'units',
              target_value: 20,
              target_unit: 'units',
              expected_delta: 10,
              delta_unit: 'units',
              timeframe_months: 12,
              financial_impact: { annual_value: 100000, currency: 'USD', calculation_method: 'test', confidence: 0.8 }
            }
          ],
          extraction_confidence: 0.85,
          reasoning: 'Extraction reasoning'
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          validations: [
            {
              driver_id: 'vd_123',
              is_valid: true,
              validation_issues: [],
              supporting_evidence_count: 3,
              contradicting_evidence_count: 0,
              benchmark_alignment: 'aligned',
              final_confidence: 0.85,
              recommendations: []
            }
          ],
          overall_assessment: 'strong',
          reasoning: 'Challenge reasoning'
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          final_drivers: [
            {
              id: 'vd_123',
              category: 'revenue',
              name: 'Driver A',
              confidence_score: 0.85,
              financial_impact: { annual_value: 100000, currency: 'USD', calculation_method: 'test', confidence: 0.8 }
            }
          ],
          reconciliation_summary: {
            drivers_accepted: 1,
            drivers_modified: 0,
            drivers_rejected: 0,
            overall_confidence: 0.85
          },
          audit_trail: [
            {
              driver_id: 'vd_123',
              action: 'accepted',
              reason: 'Strong evidence, no contradictions',
              original_confidence: 0.85,
              final_confidence: 0.85
            }
          ],
          reasoning: 'Reconciliation reasoning'
        })
      });

    const result = await orchestrator.execute('session_1', {
      organization_id: 'org_123',
      value_case_id: 'case_456',
      discovery_sources: [
        { id: 'src_1', type: 'transcript', content: 'Test content' }
      ]
    });

    expect(result.final_drivers).toHaveLength(1);
    expect(result.workflow_summary.drivers_extracted).toBe(1);
    expect(result.workflow_summary.drivers_final).toBe(1);
    expect(result.workflow_summary.extraction_confidence).toBe(0.85);
    expect(result.workflow_summary.challenge_assessment).toBe('strong');
    expect(result.workflow_summary.final_confidence).toBe(0.85);
    expect(result.audit_trail).toHaveLength(1);
  });
});

// =====================================================
// RETRIEVAL-CONDITIONED AGENT TESTS
// =====================================================

describe('RetrievalEngine', () => {
  let engine: RetrievalEngine;

  beforeEach(() => {
    engine = new RetrievalEngine(mockMemorySystem, 'org_123');
    vi.clearAllMocks();
  });

  it('should retrieve semantic snippets with tenant isolation', async () => {
    const mockMemories = [
      {
        id: 'mem_1',
        agent_id: 'agent_1',
        content: 'Relevant snippet 1',
        metadata: { organization_id: 'org_123' },
        created_at: new Date().toISOString()
      },
      {
        id: 'mem_2',
        agent_id: 'agent_2',
        content: 'Relevant snippet 2',
        metadata: { organization_id: 'org_999' } // Different tenant
      }
    ];

    vi.spyOn(mockMemorySystem, 'searchSemanticMemory').mockResolvedValue(mockMemories as any);

    const context = await engine.retrieveContext('session_1', 'test query', {
      use_semantic_memory: true,
      use_episodic_memory: false,
      use_benchmark_context: false
    });

    // Should filter out org_999 memory
    expect(context.semantic_snippets).toHaveLength(1);
    expect(context.semantic_snippets[0].content).toBe('Relevant snippet 1');
  });

  it('should format context for LLM injection', () => {
    const context = {
      semantic_snippets: [
        { content: 'Snippet 1', relevance_score: 0.9, source: 'agent:1', metadata: {} },
        { content: 'Snippet 2', relevance_score: 0.8, source: 'agent:2', metadata: {} }
      ],
      episodic_context: [
        {
          agent_id: 'agent_1',
          execution_time: '2025-01-01T00:00:00Z',
          input_summary: 'Test input',
          output_summary: 'Test output',
          success: true
        }
      ],
      document_metadata: [],
      web_content: [],
      benchmark_context: []
    };

    const formatted = engine.formatContextForPrompt(context);

    expect(formatted).toContain('## RETRIEVED CONTEXT (Semantic Memory)');
    expect(formatted).toContain('[1] (Relevance: 0.90)');
    expect(formatted).toContain('Snippet 1');
    expect(formatted).toContain('## PRIOR AGENT RUNS (Episodic Memory)');
    expect(formatted).toContain('Agent: agent_1');
  });

  it('should estimate tokens correctly', () => {
    const text = 'This is a test string with approximately 40 characters';
    const tokens = engine.estimateTokens(text);
    
    // ~40 chars / 4 = ~10 tokens
    expect(tokens).toBeGreaterThanOrEqual(9);
    expect(tokens).toBeLessThanOrEqual(11);
  });

  it('should truncate context to fit token limit', () => {
    const context = {
      semantic_snippets: Array(10).fill({ content: 'A'.repeat(100), relevance_score: 0.8, source: 'test', metadata: {} }),
      episodic_context: [],
      document_metadata: [],
      web_content: [],
      benchmark_context: []
    };

    const truncated = engine.truncateContext(context, 100); // Very small limit

    expect(truncated.semantic_snippets.length).toBeLessThan(10);
  });
});

describe('RetrievalConditionedAgent', () => {
  let agent: RetrievalConditionedAgent;

  beforeEach(() => {
    agent = new RetrievalConditionedAgent(agentConfig, 'org_123');
    vi.clearAllMocks();
  });

  it('should retrieve context before LLM call', async () => {
    const mockMemories = [
      {
        id: 'mem_1',
        agent_id: 'agent_1',
        content: 'Relevant context for the query',
        metadata: { organization_id: 'org_123' },
        created_at: new Date().toISOString()
      }
    ];

    vi.spyOn(mockMemorySystem, 'searchSemanticMemory').mockResolvedValue(mockMemories as any);
    vi.spyOn(mockMemorySystem, 'getEpisodicMemory').mockResolvedValue([]);

    const mockLLMResponse = {
      content: JSON.stringify({
        answer: 'Based on the retrieved context, the answer is...',
        confidence: 0.85,
        sources_cited: [1]
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const result = await agent.execute('session_1', {
      query: 'What is the conversion rate?',
      retrieval_config: {
        use_semantic_memory: true,
        use_episodic_memory: true
      }
    });

    expect(result.answer).toContain('Based on the retrieved context');
    expect(result.confidence).toBe(0.85);
    expect(result.retrieved_context_summary.semantic_count).toBe(1);
    expect(mockLLMGateway.complete).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('## RETRIEVED CONTEXT')
        })
      ]),
      expect.objectContaining({ temperature: 0.1 })
    );
  });

  it('should return low confidence when no context available', async () => {
    vi.spyOn(mockMemorySystem, 'searchSemanticMemory').mockResolvedValue([]);
    vi.spyOn(mockMemorySystem, 'getEpisodicMemory').mockResolvedValue([]);

    const mockLLMResponse = {
      content: JSON.stringify({
        answer: 'Insufficient context to answer',
        confidence: 0.1,
        sources_cited: []
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    const result = await agent.execute('session_1', {
      query: 'What is the ROI?'
    });

    expect(result.answer).toContain('Insufficient context');
    expect(result.confidence).toBe(0.1);
    expect(result.retrieved_context_summary.semantic_count).toBe(0);
  });

  it('should store result in episodic memory', async () => {
    vi.spyOn(mockMemorySystem, 'searchSemanticMemory').mockResolvedValue([]);
    vi.spyOn(mockMemorySystem, 'getEpisodicMemory').mockResolvedValue([]);
    const storeEpisodicMemorySpy = vi.spyOn(mockMemorySystem, 'storeEpisodicMemory');

    const mockLLMResponse = {
      content: JSON.stringify({
        answer: 'Test answer',
        confidence: 0.7,
        sources_cited: []
      })
    };

    vi.mocked(mockLLMGateway.complete).mockResolvedValue(mockLLMResponse);

    await agent.execute('session_1', { query: 'Test query' });

    expect(storeEpisodicMemorySpy).toHaveBeenCalledWith(
      'session_1',
      'test-agent',
      expect.stringContaining('Answered query: Test query'),
      expect.objectContaining({
        query: 'Test query',
        answer: 'Test answer',
        confidence: 0.7
      })
    );
  });
});
