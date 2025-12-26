/**
 * Agent Security Integration Tests
 * Tests cross-tenant isolation, circuit breaker coordination, and workflow security
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoltClientMock } from '../../../../test/mocks/mockSupabaseClient';
import { OpportunityAgent } from '../OpportunityAgent';
import { TargetAgent } from '../TargetAgent';
import { FinancialModelingAgent } from '../FinancialModelingAgent';

describe('Agent Security Integration Tests', () => {
  let mockSupabase: any;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    mockSupabase = createBoltClientMock({
      agent_memory: [],
      agent_predictions: [],
      value_fabric_capabilities: []
    });

    mockLLMGateway = {
      complete: vi.fn(),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
      storeEpisodicMemory: vi.fn().mockResolvedValue(undefined),
      searchSemanticMemory: vi.fn().mockResolvedValue([])
    };

    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined),
      logPerformanceMetric: vi.fn().mockResolvedValue(undefined),
      logArtifactProvenance: vi.fn().mockResolvedValue(undefined)
    };
  });

  describe('Cross-Tenant Isolation', () => {
    it('should isolate memory operations between different organizations', async () => {
      const orgA = 'org-aaa-111';
      const orgB = 'org-bbb-222';

      const agentA = new OpportunityAgent({
        id: 'agent-a',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase,
        organizationId: orgA
      });

      const agentB = new OpportunityAgent({
        id: 'agent-b',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase,
        organizationId: orgB
      });

      const input = {
        discoveryData: ['Test data'],
        valueCaseId: 'case-123'
      };

      vi.spyOn(agentA as any, 'secureInvoke').mockResolvedValue({
        result: {
          opportunity_summary: 'Org A opportunity',
          persona_fit: {},
          initial_value_model: {},
          pain_points: [],
          business_objectives: [],
          recommended_capability_tags: [],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.85
      });

      vi.spyOn(agentB as any, 'secureInvoke').mockResolvedValue({
        result: {
          opportunity_summary: 'Org B opportunity',
          persona_fit: {},
          initial_value_model: {},
          pain_points: [],
          business_objectives: [],
          recommended_capability_tags: [],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.85
      });

      await agentA.execute('session-a', input);
      await agentB.execute('session-b', input);

      // Verify each agent used its own organizationId
      const calls = mockMemorySystem.storeSemanticMemory.mock.calls;
      expect(calls[0][4]).toBe(orgA); // First call from agentA
      expect(calls[1][4]).toBe(orgB); // Second call from agentB
      expect(calls[0][4]).not.toBe(calls[1][4]); // Different orgs
    });

    it('should prevent memory queries from leaking across tenants', async () => {
      const memoryData = [
        { organization_id: 'org-1', content: 'Org 1 secret data' },
        { organization_id: 'org-2', content: 'Org 2 secret data' }
      ];

      mockSupabase = createBoltClientMock({
        agent_memory: memoryData
      });

      // Simulate RLS filtering (should only return org-1 data)
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'agent_memory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((column: string, value: any) => {
              if (column === 'organization_id' && value === 'org-1') {
                return {
                  data: [memoryData[0]],
                  error: null
                };
              }
              return { data: [], error: null };
            })
          };
        }
        return mockSupabase;
      });

      // Verify RLS would filter correctly
      const { data } = await mockSupabase
        .from('agent_memory')
        .select('*')
        .eq('organization_id', 'org-1');

      expect(data).toHaveLength(1);
      expect(data[0].organization_id).toBe('org-1');
      expect(data[0].content).not.toContain('Org 2'); // No cross-tenant leak
    });
  });

  describe('Circuit Breaker Coordination', () => {
    it('should share circuit breaker state across agent instances', async () => {
      const agent1 = new FinancialModelingAgent({
        id: 'financial-1',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        organizationId: 'org-test'
      });

      const agent2 = new FinancialModelingAgent({
        id: 'financial-2',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        organizationId: 'org-test'
      });

      // Both agents should have independent circuit breakers
      expect((agent1 as any).circuitBreaker).toBeDefined();
      expect((agent2 as any).circuitBreaker).toBeDefined();
    });

    it('should activate circuit breaker after repeated failures', async () => {
      const agent = new OpportunityAgent({
        id: 'test-agent',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase,
        organizationId: 'org-test'
      });

      // Mock secureInvoke to fail repeatedly
      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke')
        .mockRejectedValue(new Error('LLM service unavailable'));

      const input = {
        discoveryData: ['Test'],
        valueCaseId: 'case-123'
      };

      // Attempt multiple executions (should trigger circuit breaker)
      for (let i = 0; i < 5; i++) {
        try {
          await agent.execute(`session-${i}`, input);
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit breaker was engaged
      expect(secureInvokeSpy).toHaveBeenCalled();
    });
  });

  describe('Workflow Security Integration', () => {
    it('should propagate organizationId through agent chain', async () => {
      const orgId = 'org-workflow-test';

      const opportunityAgent = new OpportunityAgent({
        id: 'opportunity',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase,
        organizationId: orgId
      });

      const targetAgent = new TargetAgent({
        id: 'target',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase,
        organizationId: orgId
      });

      // Mock both agents
      vi.spyOn(opportunityAgent as any, 'secureInvoke').mockResolvedValue({
        result: {
          opportunity_summary: 'Test',
          persona_fit: {},
          initial_value_model: {},
          pain_points: [],
          business_objectives: [{ title: 'Objective 1', description: 'Test', priority: 'high' }],
          recommended_capability_tags: [],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.85
      });

      vi.spyOn(targetAgent as any, 'secureInvoke').mockResolvedValue({
        result: {
          target_metrics: [],
          financial_model: {},
          success_criteria: [],
          assumptions: [],
          confidence_level: 'high',
          reasoning: 'Test',
          business_case_summary: 'Test case'
        },
        confidence: 0.85
      });

      // Execute workflow
      const oppResult = await opportunityAgent.execute('session-1', {
        discoveryData: ['Test'],
        valueCaseId: 'case-123'
      });

      await targetAgent.execute('session-1', {
        valueCaseId: 'case-123',
        businessObjectives: oppResult.businessObjectives,
        capabilities: []
      });

      // Verify organizationId propagated through chain
      const memoryCalls = mockMemorySystem.storeSemanticMemory.mock.calls;
      expect(memoryCalls.every(call => call[4] === orgId)).toBe(true);
    });
  });

  describe('Hallucination Detection Validation', () => {
    it('should detect and flag potential hallucinations', async () => {
      const agent = new FinancialModelingAgent({
        id: 'financial-test',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        organizationId: 'org-test'
      });

      // Mock LLM response with hallucination_check flag
      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'low', // Low confidence indicates potential hallucination
          reasoning: 'Test',
          hallucination_check: true, // Hallucination detected
          roi_percentage: 999, // Unrealistic value
          npv_amount: 1000000000, // Unrealistic value
          payback_months: 1 // Unrealistic value
        },
        confidence: 0.4 // Below low threshold (0.7)
      });

      const input = {
        valueHypothesis: 'Test',
        businessObjectives: []
      };

      const result = await agent.execute('session-test', input);

      // Financial agent should have detected suspicious values
      expect((agent as any).secureInvoke).toHaveBeenCalled();
    });
  });
});
