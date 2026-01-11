import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdversarialChallengeAgent, ChallengeInput } from '../agents/AdversarialReasoningAgents';
import { AgentConfig } from '../../../types/agent';

// Mock dependencies
const mockLlmGateway = {
  complete: vi.fn(),
  invoke: vi.fn(),
} as any;

const mockMemorySystem = {
  storeSemanticMemory: vi.fn(),
  storeEpisodicMemory: vi.fn(),
} as any;

const mockAuditLogger = {
  logAction: vi.fn(),
  logMetric: vi.fn(),
  logPerformanceMetric: vi.fn(),
} as any;

const mockConfig: AgentConfig = {
  id: 'test-agent',
  organizationId: 'test-org',
  userId: 'test-user',
  sessionId: 'test-session',
  llmGateway: mockLlmGateway,
  memorySystem: mockMemorySystem,
  auditLogger: mockAuditLogger,
};

describe('AdversarialReasoningAgents', () => {
  describe('AdversarialChallengeAgent', () => {
    let agent: AdversarialChallengeAgent;

    beforeEach(() => {
      vi.clearAllMocks();
      agent = new AdversarialChallengeAgent(mockConfig);

      // Spy on secureInvoke
      // We need to cast to any because secureInvoke is protected
      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          validations: [],
          overall_assessment: 'strong',
          reasoning: 'Test reasoning',
        },
        confidence_level: 'high',
        confidence_score: 0.9,
        hallucination_check: false,
      });
    });

    it('should use secureInvoke instead of direct llmGateway calls', async () => {
      const input: ChallengeInput = {
        organization_id: 'test-org',
        value_case_id: 'test-case',
        drivers: [
          {
            id: 'd1',
            category: 'revenue',
            subcategory: 'conversion',
            name: 'Driver 1',
            description: 'Desc',
            economic_mechanism: 'linear',
            confidence_score: 0.8,
            evidence: [],
            baseline_value: 100,
            baseline_unit: 'units',
            target_value: 120,
            target_unit: 'units',
            expected_delta: 20,
            delta_unit: 'units',
            timeframe_months: 12,
            financial_impact: {
              annual_value: 1000,
              currency: 'USD',
              calculation_method: 'simple',
              confidence: 0.8
            },
            created_at: 'now',
            updated_at: 'now',
          }
        ],
        discovery_sources: [],
      };

      await agent.execute('test-session', input);

      // Verify secureInvoke was called
      expect((agent as any).secureInvoke).toHaveBeenCalledTimes(1);

      // Verify llmGateway.complete was NOT called directly (other than inside secureInvoke, but we mocked secureInvoke)
      expect(mockLlmGateway.complete).not.toHaveBeenCalled();
    });
  });
});
