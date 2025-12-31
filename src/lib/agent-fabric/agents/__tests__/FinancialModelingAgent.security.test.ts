/**
 * FinancialModelingAgent Security Tests
 * CRITICAL: Financial calculations require highest confidence thresholds (0.7-0.9)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialModelingAgent } from '../FinancialModelingAgent';

describe('FinancialModelingAgent - Security Fixes', () => {
  let agent: FinancialModelingAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  const testOrgId = 'org-financial-789';

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

    agent = new FinancialModelingAgent({
      id: 'financial-agent-test',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      organizationId: testOrgId
    });
  });

  describe('secureInvoke() Usage - CRITICAL for Financial Data', () => {
    it('should NOT call llmGateway.complete() directly', async () => {
      const input = {
        valueHypothesis: 'Reduce costs by 30%',
        businessObjectives: []
      };

      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'high',
          reasoning: 'Financial analysis complete'
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      // CRITICAL: Financial calculations must NEVER bypass security
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });

    it('should enforce HIGHEST confidence thresholds (0.7 low, 0.9 high)', async () => {
      const input = {
        valueHypothesis: 'Increase revenue by 25%',
        businessObjectives: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      
      // Financial models require stricter thresholds than other agents
      expect(options.confidenceThresholds).toEqual({ low: 0.7, high: 0.9 });
      expect(options.confidenceThresholds.low).toBeGreaterThan(0.6); // Higher than OpportunityAgent
      expect(options.confidenceThresholds.high).toBeGreaterThan(0.85); // Higher than TargetAgent
    });

    it('should validate financial model structure with Zod', async () => {
      const input = {
        valueHypothesis: 'Test hypothesis',
        businessObjectives: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: { annual_benefit: 100000 },
          roi_analysis: { roi_percentage: 150 },
          sensitivity_scenarios: [{ name: 'Best case', impact: 0.2 }],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      const schema = secureInvokeSpy.mock.calls[0][2];

      // Verify schema accepts valid financial data
      expect(() => schema.parse({
        financial_model: {},
        roi_analysis: {},
        sensitivity_scenarios: [],
        confidence_level: 'high',
        reasoning: 'Test reasoning',
        hallucination_check: false
      })).not.toThrow();
    });

    it('should include hallucination_check for financial accuracy', async () => {
      const input = {
        valueHypothesis: 'ROI calculation',
        businessObjectives: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'high',
          reasoning: 'Test',
          hallucination_check: false // Should detect financial hallucinations
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      const schema = secureInvokeSpy.mock.calls[0][2];
      const validData = {
        financial_model: {},
        roi_analysis: {},
        sensitivity_scenarios: [],
        confidence_level: 'high',
        reasoning: 'Test',
        hallucination_check: true
      };

      expect(() => schema.parse(validData)).not.toThrow();
    });
  });

  describe('Tenant Isolation', () => {
    it('should pass organizationId to memory operations', async () => {
      const input = {
        valueHypothesis: 'Test',
        businessObjectives: []
      };

      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'high',
          reasoning: 'Test',
          roi_percentage: 120,
          npv_amount: 500000,
          payback_months: 18
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        'session-123',
        expect.any(String),
        expect.stringMatching(/ROI:.*NPV:/), // Financial summary format
        expect.any(Object),
        testOrgId // CRITICAL: Prevent financial data leaks across tenants
      );
    });
  });

  describe('Prediction Tracking', () => {
    it('should track financial predictions for accuracy auditing', async () => {
      const input = {
        valueHypothesis: 'Revenue increase',
        businessObjectives: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          financial_model: {},
          roi_analysis: {},
          sensitivity_scenarios: [],
          confidence_level: 'high',
          reasoning: 'Test'
        },
        confidence: 0.9
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.trackPrediction).toBe(true);
      
      // Financial predictions MUST be tracked for compliance auditing
      expect(options.context).toEqual({
        agent: 'FinancialModelingAgent',
        valueHypothesis: 'Revenue increase'
      });
    });
  });
});
