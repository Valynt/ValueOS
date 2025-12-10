/**
 * ExpansionAgent Security Tests
 * Validates secureInvoke() usage, tenant isolation, and Zod schema enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpansionAgent } from '../ExpansionAgent';

describe('ExpansionAgent - Security Fixes', () => {
  let agent: ExpansionAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  let mockSupabase: any;
  const testOrgId = 'org-test-456';

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
      logMetric: vi.fn().mockResolvedValue(undefined),
      logPerformanceMetric: vi.fn().mockResolvedValue(undefined)
    };

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };

    agent = new ExpansionAgent({
      id: 'expansion-agent-test',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase,
      organizationId: testOrgId
    });
  });

  describe('secureInvoke() Usage', () => {
    it('should NOT call llmGateway.complete() directly', async () => {
      const input = {
        customerId: 'customer-123',
        realizationData: {
          kpi_results: {},
          achieved_value: 50000
        }
      };

      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          recommended_capabilities: [
            { capability_name: 'Analytics', value_proposition: 'Better insights', implementation_effort: 'low' }
          ],
          opportunity_score: 85,
          confidence_level: 'high',
          reasoning: 'Strong expansion potential'
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });

    it('should enforce structured schema with typed capabilities', async () => {
      const input = {
        customerId: 'customer-123',
        realizationData: { kpi_results: {}, achieved_value: 0 }
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          recommended_capabilities: [],
          opportunity_score: 50,
          confidence_level: 'medium',
          reasoning: 'Test'
        },
        confidence: 0.7
      });

      await agent.execute('session-123', input);

      const schema = secureInvokeSpy.mock.calls[0][2];

      // Test schema validates capability structure
      expect(() => schema.parse({
        recommended_capabilities: [
          {
            capability_name: 'Test',
            value_proposition: 'Value',
            implementation_effort: 'medium'
          }
        ],
        opportunity_score: 75,
        confidence_level: 'high',
        reasoning: 'Test reasoning'
      })).not.toThrow();

      // Test invalid effort level
      expect(() => schema.parse({
        recommended_capabilities: [
          {
            capability_name: 'Test',
            value_proposition: 'Value',
            implementation_effort: 'invalid' // Should fail
          }
        ],
        opportunity_score: 75,
        confidence_level: 'high',
        reasoning: 'Test'
      })).toThrow();
    });

    it('should use confidence thresholds 0.6 low, 0.85 high', async () => {
      const input = {
        customerId: 'customer-123',
        realizationData: { kpi_results: {}, achieved_value: 0 }
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          recommended_capabilities: [],
          opportunity_score: 50,
          confidence_level: 'medium',
          reasoning: 'Test'
        },
        confidence: 0.7
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.confidenceThresholds).toEqual({ low: 0.6, high: 0.85 });
    });
  });

  describe('Tenant Isolation', () => {
    it('should pass organizationId to memory operations', async () => {
      const input = {
        customerId: 'customer-123',
        realizationData: { kpi_results: {}, achieved_value: 100000 }
      };

      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          recommended_capabilities: [],
          opportunity_score: 80,
          confidence_level: 'high',
          reasoning: 'Test',
          expansion_model: {
            name: 'Test Expansion',
            estimated_value: 50000,
            opportunity_type: 'upsell',
            confidence_score: 0.8
          }
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        'session-123',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        testOrgId // CRITICAL: Tenant isolation
      );
    });
  });

  describe('Context Propagation', () => {
    it('should include customerId in secureInvoke context', async () => {
      const input = {
        customerId: 'customer-xyz',
        realizationData: { kpi_results: {}, achieved_value: 0 }
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          recommended_capabilities: [],
          opportunity_score: 60,
          confidence_level: 'medium',
          reasoning: 'Test'
        },
        confidence: 0.7
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.context).toEqual({
        agent: 'ExpansionAgent',
        customerId: 'customer-xyz'
      });
    });
  });
});
