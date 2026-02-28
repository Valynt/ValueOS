import { describe, expect, it } from 'vitest';
import {
  analyzePerformance,
  calculateCategoryScores,
  calculateImprovementNeeded,
  calculateOverallScore,
  calculateScoringResult,
  calculateWeightedScore,
  determineTier,
  generateFeedbackPrompt,
  isPassing,
  RUBRIC_WEIGHTS,
  SCORING_THRESHOLDS,
  type SimulationResponse,
  validateScoringResult,
} from '../../src/lib/simulation-scoring';

describe('Simulation Scoring', () => {
  const mockResponses: SimulationResponse[] = [
    {
      stepNumber: 1,
      userResponse: 'Test response 1',
      aiFeedback: 'Good work',
      score: 85,
      strengths: ['Clear communication', 'Technical accuracy'],
      improvements: ['More detail needed'],
    },
    {
      stepNumber: 2,
      userResponse: 'Test response 2',
      aiFeedback: 'Excellent',
      score: 90,
      strengths: ['Technical accuracy', 'Cross-functional thinking'],
      improvements: [],
    },
    {
      stepNumber: 3,
      userResponse: 'Test response 3',
      aiFeedback: 'Needs improvement',
      score: 75,
      strengths: ['Clear communication'],
      improvements: ['More detail needed', 'Better AI usage'],
    },
  ];

  describe('calculateOverallScore', () => {
    it('should calculate average score correctly', () => {
      const score = calculateOverallScore(mockResponses);
      expect(score).toBe(83); // (85 + 90 + 75) / 3 = 83.33 -> 83
    });

    it('should return 0 for empty responses', () => {
      const score = calculateOverallScore([]);
      expect(score).toBe(0);
    });

    it('should handle single response', () => {
      const score = calculateOverallScore([mockResponses[0]]);
      expect(score).toBe(85);
    });
  });

  describe('calculateCategoryScores', () => {
    it('should calculate category scores with multipliers', () => {
      const scores = calculateCategoryScores(80, mockResponses);
      
      expect(scores.technical).toBe(76); // 80 * 0.95
      expect(scores.crossFunctional).toBe(80); // 80 * 1.0
      expect(scores.aiAugmentation).toBe(84); // 80 * 1.05
    });

    it('should round scores to nearest integer', () => {
      const scores = calculateCategoryScores(83, mockResponses);
      
      expect(scores.technical).toBe(79); // 83 * 0.95 = 78.85 -> 79
      expect(scores.crossFunctional).toBe(83);
      expect(scores.aiAugmentation).toBe(87); // 83 * 1.05 = 87.15 -> 87
    });
  });

  describe('calculateWeightedScore', () => {
    it('should calculate weighted score using rubric', () => {
      const categoryScores = {
        technical: 80,
        crossFunctional: 85,
        aiAugmentation: 90,
      };

      const weighted = calculateWeightedScore(categoryScores);
      // 80 * 0.4 + 85 * 0.3 + 90 * 0.3 = 32 + 25.5 + 27 = 84.5 -> 85
      expect(weighted).toBe(85);
    });

    it('should respect rubric weights', () => {
      // Verify weights sum to 1.0
      const sum = RUBRIC_WEIGHTS.technical + 
                  RUBRIC_WEIGHTS.crossFunctional + 
                  RUBRIC_WEIGHTS.aiAugmentation;
      expect(sum).toBe(1.0);
    });
  });

  describe('isPassing', () => {
    it('should return true for passing scores', () => {
      expect(isPassing(80)).toBe(true);
      expect(isPassing(85)).toBe(true);
      expect(isPassing(100)).toBe(true);
    });

    it('should return false for failing scores', () => {
      expect(isPassing(79)).toBe(false);
      expect(isPassing(50)).toBe(false);
      expect(isPassing(0)).toBe(false);
    });

    it('should use correct threshold', () => {
      expect(isPassing(SCORING_THRESHOLDS.PASSING_SCORE)).toBe(true);
      expect(isPassing(SCORING_THRESHOLDS.PASSING_SCORE - 1)).toBe(false);
    });
  });

  describe('determineTier', () => {
    it('should return null for failing scores', () => {
      expect(determineTier(79)).toBeNull();
      expect(determineTier(50)).toBeNull();
      expect(determineTier(0)).toBeNull();
    });

    it('should return bronze for passing scores below silver', () => {
      expect(determineTier(80)).toBe('bronze');
      expect(determineTier(84)).toBe('bronze');
    });

    it('should return silver for scores in silver range', () => {
      expect(determineTier(85)).toBe('silver');
      expect(determineTier(90)).toBe('silver');
      expect(determineTier(94)).toBe('silver');
    });

    it('should return gold for scores at or above gold threshold', () => {
      expect(determineTier(95)).toBe('gold');
      expect(determineTier(98)).toBe('gold');
      expect(determineTier(100)).toBe('gold');
    });
  });

  describe('calculateScoringResult', () => {
    it('should calculate complete scoring result', () => {
      const result = calculateScoringResult(mockResponses);

      expect(result.overallScore).toBe(83);
      expect(result.categoryScores.technical).toBe(79);
      expect(result.categoryScores.crossFunctional).toBe(83);
      expect(result.categoryScores.aiAugmentation).toBe(87);
      expect(result.passed).toBe(true);
      expect(result.tier).toBe('bronze');
    });

    it('should handle failing scores', () => {
      const failingResponses: SimulationResponse[] = [
        { ...mockResponses[0], score: 70 },
        { ...mockResponses[1], score: 65 },
        { ...mockResponses[2], score: 60 },
      ];

      const result = calculateScoringResult(failingResponses);

      expect(result.overallScore).toBe(65);
      expect(result.passed).toBe(false);
      expect(result.tier).toBeNull();
    });

    it('should handle gold tier scores', () => {
      const goldResponses: SimulationResponse[] = [
        { ...mockResponses[0], score: 95 },
        { ...mockResponses[1], score: 98 },
        { ...mockResponses[2], score: 96 },
      ];

      const result = calculateScoringResult(goldResponses);

      expect(result.overallScore).toBe(96);
      expect(result.passed).toBe(true);
      expect(result.tier).toBe('gold');
    });
  });

  describe('generateFeedbackPrompt', () => {
    it('should generate formatted feedback prompt', () => {
      const categoryScores = {
        technical: 80,
        crossFunctional: 85,
        aiAugmentation: 90,
      };

      const prompt = generateFeedbackPrompt(85, categoryScores, true);

      expect(prompt).toContain('Overall Score: 85/100');
      expect(prompt).toContain('Passed: Yes');
      expect(prompt).toContain('Technical: 80/100');
      expect(prompt).toContain('Cross-Functional: 85/100');
      expect(prompt).toContain('AI Augmentation: 90/100');
    });

    it('should show "No" for failing attempts', () => {
      const categoryScores = {
        technical: 70,
        crossFunctional: 75,
        aiAugmentation: 72,
      };

      const prompt = generateFeedbackPrompt(72, categoryScores, false);

      expect(prompt).toContain('Passed: No');
    });
  });

  describe('analyzePerformance', () => {
    it('should identify common strengths', () => {
      const analysis = analyzePerformance(mockResponses);

      expect(analysis.commonStrengths).toContain('Clear communication');
      expect(analysis.commonStrengths).toContain('Technical accuracy');
    });

    it('should identify common improvements', () => {
      const analysis = analyzePerformance(mockResponses);

      expect(analysis.commonImprovements).toContain('More detail needed');
    });

    it('should identify strongest and weakest categories', () => {
      const analysis = analyzePerformance(mockResponses);

      expect(analysis.strongestCategory).toBeDefined();
      expect(analysis.weakestCategory).toBeDefined();
      expect(['technical', 'crossFunctional', 'aiAugmentation']).toContain(analysis.strongestCategory);
      expect(['technical', 'crossFunctional', 'aiAugmentation']).toContain(analysis.weakestCategory);
    });

    it('should handle responses with no common patterns', () => {
      const uniqueResponses: SimulationResponse[] = [
        { ...mockResponses[0], strengths: ['A'], improvements: ['X'] },
        { ...mockResponses[1], strengths: ['B'], improvements: ['Y'] },
        { ...mockResponses[2], strengths: ['C'], improvements: ['Z'] },
      ];

      const analysis = analyzePerformance(uniqueResponses);

      expect(analysis.commonStrengths).toHaveLength(0);
      expect(analysis.commonImprovements).toHaveLength(0);
    });
  });

  describe('validateScoringResult', () => {
    it('should validate correct scoring result', () => {
      const result = calculateScoringResult(mockResponses);
      const validation = validateScoringResult(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect out-of-range overall score', () => {
      const invalidResult = {
        overallScore: 150,
        categoryScores: { technical: 80, crossFunctional: 85, aiAugmentation: 90 },
        passed: true,
        tier: 'gold' as const,
      };

      const validation = validateScoringResult(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Overall score'))).toBe(true);
    });

    it('should detect out-of-range category scores', () => {
      const invalidResult = {
        overallScore: 85,
        categoryScores: { technical: 120, crossFunctional: 85, aiAugmentation: 90 },
        passed: true,
        tier: 'silver' as const,
      };

      const validation = validateScoringResult(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('technical score'))).toBe(true);
    });

    it('should detect incorrect passed flag', () => {
      const invalidResult = {
        overallScore: 75,
        categoryScores: { technical: 70, crossFunctional: 75, aiAugmentation: 80 },
        passed: true, // Should be false
        tier: null,
      };

      const validation = validateScoringResult(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Passed flag'))).toBe(true);
    });

    it('should detect incorrect tier', () => {
      const invalidResult = {
        overallScore: 85,
        categoryScores: { technical: 80, crossFunctional: 85, aiAugmentation: 90 },
        passed: true,
        tier: 'gold' as const, // Should be silver
      };

      const validation = validateScoringResult(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Tier'))).toBe(true);
    });
  });

  describe('calculateImprovementNeeded', () => {
    it('should calculate points needed for bronze', () => {
      const improvement = calculateImprovementNeeded(75);

      expect(improvement).not.toBeNull();
      expect(improvement?.nextTier).toBe('bronze');
      expect(improvement?.pointsNeeded).toBe(5); // 80 - 75
    });

    it('should calculate points needed for silver', () => {
      const improvement = calculateImprovementNeeded(82);

      expect(improvement).not.toBeNull();
      expect(improvement?.nextTier).toBe('silver');
      expect(improvement?.pointsNeeded).toBe(3); // 85 - 82
    });

    it('should calculate points needed for gold', () => {
      const improvement = calculateImprovementNeeded(90);

      expect(improvement).not.toBeNull();
      expect(improvement?.nextTier).toBe('gold');
      expect(improvement?.pointsNeeded).toBe(5); // 95 - 90
    });

    it('should calculate points needed for mastery', () => {
      const improvement = calculateImprovementNeeded(97);

      expect(improvement).not.toBeNull();
      expect(improvement?.nextTier).toBe('mastery');
      expect(improvement?.pointsNeeded).toBe(3); // 100 - 97
    });

    it('should return null for perfect score', () => {
      const improvement = calculateImprovementNeeded(100);

      expect(improvement).toBeNull();
    });

    it('should calculate percentage improvement needed', () => {
      const improvement = calculateImprovementNeeded(80);

      expect(improvement).not.toBeNull();
      expect(improvement?.percentageNeeded).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero scores', () => {
      const zeroResponses: SimulationResponse[] = [
        { ...mockResponses[0], score: 0 },
      ];

      const result = calculateScoringResult(zeroResponses);

      expect(result.overallScore).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.tier).toBeNull();
    });

    it('should handle perfect scores', () => {
      const perfectResponses: SimulationResponse[] = [
        { ...mockResponses[0], score: 100 },
        { ...mockResponses[1], score: 100 },
      ];

      const result = calculateScoringResult(perfectResponses);

      expect(result.overallScore).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.tier).toBe('gold');
    });

    it('should handle boundary scores', () => {
      const boundaryTests = [
        { score: 79, expectedPassed: false, expectedTier: null },
        { score: 80, expectedPassed: true, expectedTier: 'bronze' },
        { score: 84, expectedPassed: true, expectedTier: 'bronze' },
        { score: 85, expectedPassed: true, expectedTier: 'silver' },
        { score: 94, expectedPassed: true, expectedTier: 'silver' },
        { score: 95, expectedPassed: true, expectedTier: 'gold' },
      ];

      boundaryTests.forEach(({ score, expectedPassed, expectedTier }) => {
        expect(isPassing(score)).toBe(expectedPassed);
        expect(determineTier(score)).toBe(expectedTier);
      });
    });
  });
});
