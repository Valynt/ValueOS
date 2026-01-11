import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReflectionEngine, QualityAssessment } from '../ReflectionEngine';
import { LLMGateway } from '../LLMGateway';
import { secureLLMComplete } from '../../llm/secureLLMWrapper';
import { QualityRubric } from '../types';

// Mock secureLLMComplete
vi.mock('../../llm/secureLLMWrapper', () => ({
  secureLLMComplete: vi.fn(),
}));

// Mock LLMGateway
vi.mock('../LLMGateway', () => {
  return {
    LLMGateway: vi.fn().mockImplementation(() => ({
      // Add methods if needed, though secureLLMComplete takes the gateway as arg
    })),
  };
});

// Mock featureFlags to control JSON parsing path if needed
vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    ENABLE_SAFE_JSON_PARSER: false, // Start with legacy path for simplicity
  },
}));

describe('ReflectionEngine', () => {
  let reflectionEngine: ReflectionEngine;
  let mockLLMGateway: LLMGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLMGateway = new LLMGateway({} as any); // Mock config
    reflectionEngine = new ReflectionEngine(mockLLMGateway, 'org-123', 'user-123');
  });

  describe('evaluateQuality', () => {
    it('should call secureLLMComplete with correct arguments', async () => {
      const mockAssessment: QualityAssessment = {
        total_score: 15,
        max_score: 18,
        dimension_scores: {
          traceability: 3,
          relevance: 3,
          realism: 2,
          clarity: 3,
          actionability: 2,
          polish: 2,
        },
        feedback: 'Good job',
        needs_refinement: false,
        improvement_suggestions: ['Improve realism'],
      };

      vi.mocked(secureLLMComplete).mockResolvedValue({
        content: JSON.stringify(mockAssessment),
        model: 'gpt-4',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
      });

      const valueCaseData = { key: 'value' };
      const rubric: QualityRubric = {
        traceability: 3,
        relevance: 3,
        realism: 3,
        clarity: 3,
        actionability: 3,
        polish: 3,
      };
      const threshold = 10;

      const result = await reflectionEngine.evaluateQuality(valueCaseData, rubric, threshold);

      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
            organizationId: 'org-123',
            userId: 'user-123',
            serviceName: 'ReflectionEngine',
            operation: 'evaluateQuality'
        })
      );
      expect(result).toEqual({ ...mockAssessment, needs_refinement: false });
    });
  });

  describe('generateRefinementInstructions', () => {
    it('should call secureLLMComplete with correct arguments', async () => {
        const mockAssessment: QualityAssessment = {
            total_score: 10,
            max_score: 18,
            dimension_scores: {
              traceability: 1,
              relevance: 3,
              realism: 1,
              clarity: 3,
              actionability: 3,
              polish: 3,
            },
            feedback: 'Needs work',
            needs_refinement: true,
            improvement_suggestions: ['Fix traceability', 'Fix realism'],
          };

      const previousData = { key: 'old-value' };
      const expectedInstructions = 'Do this and that';

      vi.mocked(secureLLMComplete).mockResolvedValue({
        content: expectedInstructions,
        model: 'gpt-4',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
      });

      const result = await reflectionEngine.generateRefinementInstructions(mockAssessment, previousData);

      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
            organizationId: 'org-123',
            userId: 'user-123',
            serviceName: 'ReflectionEngine',
            operation: 'generateRefinementInstructions'
        })
      );
      expect(result).toBe(expectedInstructions);
    });
  });
});
