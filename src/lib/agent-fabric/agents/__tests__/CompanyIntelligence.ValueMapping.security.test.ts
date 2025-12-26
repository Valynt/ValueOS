/**
 * CompanyIntelligenceAgent and ValueMappingAgent Security Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyIntelligenceAgent } from '../CompanyIntelligenceAgent';
import { ValueMappingAgent } from '../ValueMappingAgent';

describe('CompanyIntelligenceAgent - Security Fixes', () => {
  let agent: CompanyIntelligenceAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  const testOrgId = 'org-intel-999';

  beforeEach(() => {
    mockLLMGateway = {
      complete: vi.fn(),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2])
    };

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined)
    };

    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined)
    };

    agent = new CompanyIntelligenceAgent({
      id: 'intel-agent-test',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      organizationId: testOrgId
    });
  });

  it('should NOT call llmGateway.complete() directly', async () => {
    const input = {
      value_case_id: 'case-123',
      companyId: 'company-abc'
    };

    vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        company_profile: {},
        key_stakeholders: [],
        strategic_priorities: [],
        decision_patterns: {},
        confidence_level: 'high',
        reasoning: 'Intelligence gathered',
        company_name: 'Test Corp',
        industry: 'Technology',
        vertical: 'SaaS'
      },
      confidence: 0.85
    });

    await agent.execute('session-123', input);

    expect(mockLLMGateway.complete).not.toHaveBeenCalled();
  });

  it('should pass organizationId for tenant isolation', async () => {
    const input = {
      value_case_id: 'case-123',
      companyId: 'company-abc'
    };

    vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        company_profile: {},
        key_stakeholders: [],
        strategic_priorities: [],
        decision_patterns: {},
        confidence_level: 'high',
        reasoning: 'Test',
        company_name: 'Test Corp',
        industry: 'Tech',
        vertical: 'SaaS'
      },
      confidence: 0.8
    });

    await agent.execute('session-123', input);

    expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      'session-123',
      expect.any(String),
      expect.stringMatching(/Company:.*Test Corp/),
      expect.any(Object),
      testOrgId // Prevent intelligence leaks across tenants
    );
  });

  it('should use confidence thresholds 0.5-0.8 for intelligence gathering', async () => {
    const input = {
      value_case_id: 'case-123',
      companyId: 'company-abc'
    };

    const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        company_profile: {},
        key_stakeholders: [],
        strategic_priorities: [],
        decision_patterns: {},
        confidence_level: 'medium',
        reasoning: 'Test',
        company_name: 'Test',
        industry: 'Tech',
        vertical: 'SaaS'
      },
      confidence: 0.7
    });

    await agent.execute('session-123', input);

    const options = secureInvokeSpy.mock.calls[0][3];
    expect(options.confidenceThresholds).toEqual({ low: 0.5, high: 0.8 });
  });
});

describe('ValueMappingAgent - Security Fixes', () => {
  let agent: ValueMappingAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  const testOrgId = 'org-mapping-111';

  beforeEach(() => {
    mockLLMGateway = {
      complete: vi.fn(),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2])
    };

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined)
    };

    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined)
    };

    agent = new ValueMappingAgent({
      id: 'mapping-agent-test',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      organizationId: testOrgId
    });
  });

  it('should NOT call llmGateway.complete() directly', async () => {
    const input = {
      value_case_id: 'case-123',
      capabilities: []
    };

    vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        value_mapping: {},
        capability_impact: [],
        outcome_correlations: {},
        confidence_level: 'high',
        reasoning: 'Mapping complete',
        value_maps: []
      },
      confidence: 0.85
    });

    await agent.execute('session-123', input);

    expect(mockLLMGateway.complete).not.toHaveBeenCalled();
  });

  it('should pass organizationId in memory loop', async () => {
    const input = {
      value_case_id: 'case-123',
      capabilities: []
    };

    vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        value_mapping: {},
        capability_impact: [],
        outcome_correlations: {},
        confidence_level: 'high',
        reasoning: 'Test',
        value_maps: [
          { feature: 'Automation', business_outcome: 'Efficiency' }
        ]
      },
      confidence: 0.85
    });

    await agent.execute('session-123', input);

    // ValueMappingAgent stores memory in a loop
    expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      'session-123',
      expect.any(String),
      expect.stringContaining('drives'), // "X drives Y" format
      expect.any(Object),
      testOrgId // CRITICAL: Tenant isolation in loop
    );
  });

  it('should use confidence thresholds 0.6-0.85', async () => {
    const input = {
      value_case_id: 'case-123',
      capabilities: []
    };

    const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        value_mapping: {},
        capability_impact: [],
        outcome_correlations: {},
        confidence_level: 'high',
        reasoning: 'Test',
        value_maps: []
      },
      confidence: 0.85
    });

    await agent.execute('session-123', input);

    const options = secureInvokeSpy.mock.calls[0][3];
    expect(options.confidenceThresholds).toEqual({ low: 0.6, high: 0.85 });
  });

  it('should include capabilities count in context', async () => {
    const input = {
      value_case_id: 'case-123',
      capabilities: ['Cap1', 'Cap2', 'Cap3']
    };

    const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
      result: {
        value_mapping: {},
        capability_impact: [],
        outcome_correlations: {},
        confidence_level: 'high',
        reasoning: 'Test',
        value_maps: []
      },
      confidence: 0.85
    });

    await agent.execute('session-123', input);

    const options = secureInvokeSpy.mock.calls[0][3];
    expect(options.context).toEqual({
      agent: 'ValueMappingAgent',
      capabilities: 3
    });
  });
});
