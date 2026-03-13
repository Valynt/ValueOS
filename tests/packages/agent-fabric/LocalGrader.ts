/**
 * LocalGrader — Semantic evaluation of agent outputs
 *
 * Provides a lightweight, deterministic grading function for test suites.
 * Evaluates agent output against a goal specification using structural
 * and content-based heuristics.
 *
 * In production, this would delegate to an LLM-as-judge pattern.
 * For CI/test environments, it uses deterministic scoring to avoid
 * flaky tests from non-deterministic LLM responses.
 */

// ============================================================================
// Types
// ============================================================================

export interface GradeGoal {
  goal: string;
  requiredFields?: string[];
  minConfidence?: number;
}

export interface GradeResult {
  score: number;
  breakdown: {
    structuralCompleteness: number;
    goalAlignment: number;
    confidenceAdequacy: number;
  };
  feedback: string[];
}

// ============================================================================
// Implementation
// ============================================================================

export class LocalGrader {
  /**
   * Evaluate an agent output against a goal specification.
   *
   * @param output - The agent's output object
   * @param goal   - The goal specification to grade against
   * @returns A score between 0.0 and 1.0
   */
  async evaluate(
    output: Record<string, unknown>,
    goal: GradeGoal
  ): Promise<number> {
    const result = this.grade(output, goal);
    return result.score;
  }

  /**
   * Detailed grading with breakdown and feedback.
   */
  grade(
    output: Record<string, unknown>,
    goal: GradeGoal
  ): GradeResult {
    const feedback: string[] = [];

    // 1. Structural completeness (0-1)
    const structuralCompleteness = this.scoreStructure(output, goal, feedback);

    // 2. Goal alignment (0-1) — keyword overlap between output and goal
    const goalAlignment = this.scoreGoalAlignment(output, goal, feedback);

    // 3. Confidence adequacy (0-1)
    const confidenceAdequacy = this.scoreConfidence(output, goal, feedback);

    // Weighted composite
    const score =
      structuralCompleteness * 0.4 +
      goalAlignment * 0.4 +
      confidenceAdequacy * 0.2;

    return {
      score: Math.min(1, Math.max(0, score)),
      breakdown: {
        structuralCompleteness,
        goalAlignment,
        confidenceAdequacy,
      },
      feedback,
    };
  }

  // --------------------------------------------------------------------------
  // Scoring components
  // --------------------------------------------------------------------------

  private scoreStructure(
    output: Record<string, unknown>,
    goal: GradeGoal,
    feedback: string[]
  ): number {
    if (!output || typeof output !== "object") {
      feedback.push("Output is not a valid object");
      return 0;
    }

    const keys = Object.keys(output);
    if (keys.length === 0) {
      feedback.push("Output has no fields");
      return 0;
    }

    // Check required fields if specified
    const requiredFields = goal.requiredFields ?? [];
    if (requiredFields.length > 0) {
      const present = requiredFields.filter((f) => f in output);
      const ratio = present.length / requiredFields.length;
      if (ratio < 1) {
        const missing = requiredFields.filter((f) => !(f in output));
        feedback.push(`Missing required fields: ${missing.join(", ")}`);
      }
      return ratio;
    }

    // Default: score based on non-null field density
    const nonNullFields = keys.filter(
      (k) => output[k] !== null && output[k] !== undefined
    );
    const density = nonNullFields.length / Math.max(keys.length, 1);
    if (density < 0.5) {
      feedback.push("Many output fields are null or undefined");
    }
    return density;
  }

  private scoreGoalAlignment(
    output: Record<string, unknown>,
    goal: GradeGoal,
    feedback: string[]
  ): number {
    const goalText = goal.goal.toLowerCase();
    const outputText = JSON.stringify(output).toLowerCase();

    // Extract meaningful keywords from goal (words > 3 chars)
    const goalWords = goalText
      .split(/\W+/)
      .filter((w) => w.length > 3);

    if (goalWords.length === 0) {
      feedback.push("Goal text has no meaningful keywords");
      return 0.5; // Neutral score
    }

    const matchedWords = goalWords.filter((w) => outputText.includes(w));
    const alignment = matchedWords.length / goalWords.length;

    if (alignment < 0.3) {
      feedback.push(
        `Low goal alignment: only ${matchedWords.length}/${goalWords.length} keywords found`
      );
    }

    // Boost score if output has goalAchieved: true
    const goalAchieved =
      "goalAchieved" in output && output.goalAchieved === true;
    const boost = goalAchieved ? 0.2 : 0;

    return Math.min(1, alignment + boost);
  }

  private scoreConfidence(
    output: Record<string, unknown>,
    goal: GradeGoal,
    feedback: string[]
  ): number {
    const minConfidence = goal.minConfidence ?? 0.7;

    // Look for confidence-like fields
    const confidenceValue = this.extractConfidence(output);
    if (confidenceValue === null) {
      feedback.push("No confidence score found in output");
      return 0.5; // Neutral
    }

    if (confidenceValue < minConfidence) {
      feedback.push(
        `Confidence ${confidenceValue.toFixed(2)} below minimum ${minConfidence}`
      );
      return confidenceValue / minConfidence;
    }

    return 1.0;
  }

  private extractConfidence(output: Record<string, unknown>): number | null {
    // Direct confidence field
    if (typeof output.confidence === "number") return output.confidence;

    // Nested in quality_score (0-18 scale)
    if (typeof output.quality_score === "number") {
      return output.quality_score / 18;
    }

    // Search one level deep
    for (const value of Object.values(output)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "confidence" in (value as Record<string, unknown>)
      ) {
        const nested = (value as Record<string, unknown>).confidence;
        if (typeof nested === "number") return nested;
      }
    }

    return null;
  }
}
