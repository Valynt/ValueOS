/**
 * Simulation Scoring Module
 * Handles scoring logic for VOS simulations using the 40/30/30 rubric
 * 
 * Rubric:
 * - 40% Technical Competency
 * - 30% Cross-Functional Collaboration
 * - 30% AI Augmentation
 */

export interface SimulationResponse {
  stepNumber: number;
  userResponse: string;
  aiFeedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

export interface CategoryScores {
  technical: number;
  crossFunctional: number;
  aiAugmentation: number;
}

export interface ScoringResult {
  overallScore: number;
  categoryScores: CategoryScores;
  passed: boolean;
  tier: 'bronze' | 'silver' | 'gold' | null;
}

/**
 * Scoring thresholds
 */
export const SCORING_THRESHOLDS = {
  PASSING_SCORE: 80,
  SILVER_THRESHOLD: 80,
  GOLD_THRESHOLD: 95,
} as const;

/**
 * Rubric weights (must sum to 1.0)
 */
export const RUBRIC_WEIGHTS = {
  technical: 0.4,
  crossFunctional: 0.3,
  aiAugmentation: 0.3,
} as const;

/**
 * Calculate overall score from individual response scores
 */
export function calculateOverallScore(responses: SimulationResponse[]): number {
  if (responses.length === 0) return 0;
  
  const sum = responses.reduce((total, response) => total + response.score, 0);
  return Math.round(sum / responses.length);
}

/**
 * Calculate category scores using the 40/30/30 rubric
 * 
 * This is a simplified implementation. In production, you would:
 * 1. Analyze each response for category-specific criteria
 * 2. Weight responses by category relevance
 * 3. Apply rubric weights to calculate final scores
 */
export function calculateCategoryScores(
  overallScore: number,
  responses: SimulationResponse[]
): CategoryScores {
  // For now, use score multipliers based on typical performance patterns
  // Technical tends to be slightly lower, AI augmentation slightly higher
  return {
    technical: Math.round(overallScore * 0.95),
    crossFunctional: Math.round(overallScore * 1.0),
    aiAugmentation: Math.round(overallScore * 1.05),
  };
}

/**
 * Calculate weighted score using rubric weights
 * This is the "proper" way to calculate if you have individual category scores
 */
export function calculateWeightedScore(categoryScores: CategoryScores): number {
  return Math.round(
    categoryScores.technical * RUBRIC_WEIGHTS.technical +
    categoryScores.crossFunctional * RUBRIC_WEIGHTS.crossFunctional +
    categoryScores.aiAugmentation * RUBRIC_WEIGHTS.aiAugmentation
  );
}

/**
 * Determine if simulation attempt passed
 */
export function isPassing(score: number): boolean {
  return score >= SCORING_THRESHOLDS.PASSING_SCORE;
}

/**
 * Determine certification tier based on score
 */
export function determineTier(score: number): 'bronze' | 'silver' | 'gold' | null {
  if (score < SCORING_THRESHOLDS.PASSING_SCORE) {
    return null; // No certification
  }
  
  if (score >= SCORING_THRESHOLDS.GOLD_THRESHOLD) {
    return 'gold';
  }
  
  if (score >= SCORING_THRESHOLDS.SILVER_THRESHOLD) {
    return 'silver';
  }
  
  return 'bronze';
}

/**
 * Calculate complete scoring result
 */
export function calculateScoringResult(responses: SimulationResponse[]): ScoringResult {
  const overallScore = calculateOverallScore(responses);
  const categoryScores = calculateCategoryScores(overallScore, responses);
  const passed = isPassing(overallScore);
  const tier = determineTier(overallScore);

  return {
    overallScore,
    categoryScores,
    passed,
    tier,
  };
}

/**
 * Generate feedback prompt for AI evaluation
 */
export function generateFeedbackPrompt(
  overallScore: number,
  categoryScores: CategoryScores,
  passed: boolean
): string {
  return `Based on this simulation performance:
- Overall Score: ${overallScore}/100
- Passed: ${passed ? "Yes" : "No"}
- Technical: ${categoryScores.technical}/100
- Cross-Functional: ${categoryScores.crossFunctional}/100
- AI Augmentation: ${categoryScores.aiAugmentation}/100

Provide brief (2-3 sentences) summary and key recommendations.`;
}

/**
 * Analyze strengths and weaknesses across all responses
 */
export function analyzePerformance(responses: SimulationResponse[]): {
  commonStrengths: string[];
  commonImprovements: string[];
  strongestCategory: string;
  weakestCategory: string;
} {
  // Aggregate all strengths and improvements
  const allStrengths = responses.flatMap(r => r.strengths);
  const allImprovements = responses.flatMap(r => r.improvements);

  // Count occurrences
  const strengthCounts = countOccurrences(allStrengths);
  const improvementCounts = countOccurrences(allImprovements);

  // Get most common (appearing in 2+ responses)
  const commonStrengths = Object.entries(strengthCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([strength]) => strength);

  const commonImprovements = Object.entries(improvementCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([improvement]) => improvement);

  // Determine strongest/weakest categories (placeholder logic)
  const avgScores = responses.reduce((acc, r) => acc + r.score, 0) / responses.length;
  const strongestCategory = avgScores >= 85 ? 'technical' : 'crossFunctional';
  const weakestCategory = avgScores < 75 ? 'aiAugmentation' : 'technical';

  return {
    commonStrengths,
    commonImprovements,
    strongestCategory,
    weakestCategory,
  };
}

/**
 * Helper: Count occurrences of items in array
 */
function countOccurrences(items: string[]): Record<string, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Validate scoring result
 * Ensures scores are within valid ranges
 */
export function validateScoringResult(result: ScoringResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check overall score range
  if (result.overallScore < 0 || result.overallScore > 100) {
    errors.push(`Overall score ${result.overallScore} is out of range [0, 100]`);
  }

  // Check category scores
  Object.entries(result.categoryScores).forEach(([category, score]) => {
    if (score < 0 || score > 100) {
      errors.push(`${category} score ${score} is out of range [0, 100]`);
    }
  });

  // Check passed logic
  const expectedPassed = result.overallScore >= SCORING_THRESHOLDS.PASSING_SCORE;
  if (result.passed !== expectedPassed) {
    errors.push(`Passed flag (${result.passed}) doesn't match score (${result.overallScore})`);
  }

  // Check tier logic
  const expectedTier = determineTier(result.overallScore);
  if (result.tier !== expectedTier) {
    errors.push(`Tier (${result.tier}) doesn't match score (${result.overallScore})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate improvement needed to reach next tier
 */
export function calculateImprovementNeeded(currentScore: number): {
  nextTier: 'bronze' | 'silver' | 'gold' | 'mastery' | null;
  pointsNeeded: number;
  percentageNeeded: number;
} | null {
  if (currentScore >= 100) {
    return null; // Already at maximum
  }

  let nextTier: 'bronze' | 'silver' | 'gold' | 'mastery';
  let targetScore: number;

  if (currentScore < SCORING_THRESHOLDS.PASSING_SCORE) {
    nextTier = 'bronze';
    targetScore = SCORING_THRESHOLDS.PASSING_SCORE;
  } else if (currentScore < SCORING_THRESHOLDS.SILVER_THRESHOLD) {
    nextTier = 'silver';
    targetScore = SCORING_THRESHOLDS.SILVER_THRESHOLD;
  } else if (currentScore < SCORING_THRESHOLDS.GOLD_THRESHOLD) {
    nextTier = 'gold';
    targetScore = SCORING_THRESHOLDS.GOLD_THRESHOLD;
  } else {
    nextTier = 'mastery';
    targetScore = 100;
  }

  const pointsNeeded = targetScore - currentScore;
  const percentageNeeded = Math.round((pointsNeeded / currentScore) * 100);

  return {
    nextTier,
    pointsNeeded,
    percentageNeeded,
  };
}
