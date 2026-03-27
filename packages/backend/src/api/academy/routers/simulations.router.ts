/**
 * Simulations Router
 * Handles simulation scenarios, attempts, evaluation, and analytics with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { LLMGateway } from "../../../lib/agent-fabric/LLMGateway.js";
import type { RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { getSupabaseClient } from "../utils.js";

// ---------------------------------------------------------------------------
// Evaluation response schema — validated before returning to the client
// ---------------------------------------------------------------------------

const EvaluationResultSchema = z.object({
  score: z.number().min(0).max(100),
  categoryBreakdown: z.object({
    technical: z.number(),
    crossFunctional: z.number(),
    aiAugmentation: z.number(),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  feedback: z.string(),
});

type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ============================================================================
// Types
// ============================================================================

interface SimulationScenario {
  id: number;
  title: string;
  description: string;
  type: string;
  pillarId: number | null;
  steps: Record<string, unknown>;
  rubric: Record<string, unknown>;
  difficulty_level?: string;
  evaluation_criteria?: Record<string, unknown>;
}

interface SimulationAttempt {
  id: number;
  userId: string;
  scenarioId: number;
  attemptNumber: number;
  responsesData: Record<string, unknown>;
  overallScore: number;
  categoryScores: Record<string, number>;
  passed: boolean;
  timeSpent: number;
  feedback: string;
  completedAt: string;
}

interface SimulationResponse {
  stepNumber: number;
  userResponse: string;
  aiFeedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

interface ScoringResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  passed: boolean;
  tier: "bronze" | "silver" | "gold" | null;
}

interface Certification {
  id: number;
  userId: string;
  badgeName: string;
  pillarId: number;
  vosRole: string;
  tier: string;
  score: number | null;
  awardedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

// getSupabaseClient is now imported from ../utils.js

function calculateScoringResult(responses: SimulationResponse[]): ScoringResult {
  if (responses.length === 0) {
    return {
      overallScore: 0,
      categoryScores: { technical: 0, crossFunctional: 0, aiAugmentation: 0 },
      passed: false,
      tier: null,
    };
  }

  const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
  const overallScore = Math.round(totalScore / responses.length);

  // Calculate category scores (simplified - would use rubric in real implementation)
  const categoryScores = {
    technical: Math.round(overallScore * 0.4),
    crossFunctional: Math.round(overallScore * 0.35),
    aiAugmentation: Math.round(overallScore * 0.25),
  };

  const passed = overallScore >= 70;
  let tier: "bronze" | "silver" | "gold" | null = null;
  if (passed) {
    if (overallScore >= 90) tier = "gold";
    else if (overallScore >= 80) tier = "silver";
    else tier = "bronze";
  }

  return {
    overallScore,
    categoryScores,
    passed,
    tier,
  };
}

function validateScoringResult(result: ScoringResult): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (result.overallScore < 0 || result.overallScore > 100) {
    errors.push("Overall score must be between 0 and 100");
  }

  if (Object.values(result.categoryScores).some((s) => s < 0 || s > 100)) {
    errors.push("Category scores must be between 0 and 100");
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

function generateFeedbackPrompt(overallScore: number, categoryScores: Record<string, number>, passed: boolean): string {
  return `Generate feedback for a simulation attempt with score ${overallScore}% (${passed ? "passed" : "did not pass"}).
Category scores: Technical ${categoryScores.technical}%, Cross-functional ${categoryScores.crossFunctional}%, AI Augmentation ${categoryScores.aiAugmentation}%.`;
}

// ============================================================================
// Database Operations
// ============================================================================

async function getAllSimulationScenarios(
  client: RequestScopedRlsSupabaseClient
): Promise<SimulationScenario[]> {
  const { data, error } = await client.from("simulation_scenarios").select("*");

  if (error) {
    logger.error("Failed to get simulation scenarios", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve simulation scenarios",
    });
  }

  return (data || []).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    type: s.type,
    pillarId: s.pillar_id,
    steps: s.steps,
    rubric: s.rubric,
  }));
}

async function getSimulationScenarioById(
  client: RequestScopedRlsSupabaseClient,
  id: number
): Promise<SimulationScenario | null> {
  const { data, error } = await client
    .from("simulation_scenarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logger.error("Failed to get simulation scenario", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    type: data.type,
    pillarId: data.pillar_id,
    steps: data.steps,
    rubric: data.rubric,
  };
}

async function getUserSimulationAttempts(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  organizationId: string,
  scenarioId?: number
): Promise<SimulationAttempt[]> {
  let query = client
    .from("simulation_attempts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (scenarioId) {
    query = query.eq("scenario_id", scenarioId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to get simulation attempts", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve simulation attempts",
    });
  }

  return (data || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    scenarioId: a.scenario_id,
    attemptNumber: a.attempt_number,
    responsesData: a.responses_data,
    overallScore: a.overall_score,
    categoryScores: a.category_scores,
    passed: a.passed,
    timeSpent: a.time_spent,
    feedback: a.feedback,
    completedAt: a.completed_at,
  }));
}

async function getSimulationAttemptCount(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  organizationId: string,
  scenarioId: number
): Promise<number> {
  const { data, error } = await client
    .from("simulation_attempts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("scenario_id", scenarioId);

  if (error) {
    logger.error("Failed to count simulation attempts", error);
    return 0;
  }

  return (data || []).length;
}

async function createSimulationAttempt(
  client: RequestScopedRlsSupabaseClient,
  attempt: Omit<SimulationAttempt, "id"> & { organizationId: string }
): Promise<void> {
  const { error } = await client.from("simulation_attempts").insert({
    organization_id: attempt.organizationId,
    user_id: attempt.userId,
    scenario_id: attempt.scenarioId,
    attempt_number: attempt.attemptNumber,
    responses_data: attempt.responsesData,
    overall_score: attempt.overallScore,
    category_scores: attempt.categoryScores,
    passed: attempt.passed,
    time_spent: attempt.timeSpent,
    feedback: attempt.feedback,
    completed_at: attempt.completedAt,
  });

  if (error) {
    logger.error("Failed to create simulation attempt", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save simulation attempt",
    });
  }
}

async function hasCertification(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  organizationId: string,
  pillarId: number,
  vosRole: string
): Promise<boolean> {
  const { data, error } = await client
    .from("certifications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("pillar_id", pillarId)
    .eq("vos_role", vosRole)
    .limit(1);

  if (error) {
    logger.error("Failed to check certification", error);
    return false;
  }

  return (data || []).length > 0;
}

async function createCertification(
  client: RequestScopedRlsSupabaseClient,
  cert: Omit<Certification, "id"> & { organizationId: string }
): Promise<void> {
  const { error } = await client.from("certifications").insert({
    organization_id: cert.organizationId,
    user_id: cert.userId,
    badge_name: cert.badgeName,
    pillar_id: cert.pillarId,
    vos_role: cert.vosRole,
    tier: cert.tier,
    score: cert.score,
    awarded_at: cert.awardedAt,
  });

  if (error) {
    logger.error("Failed to create certification", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create certification",
    });
  }
}

// ============================================================================
// Router
// ============================================================================

export const simulationsRouter = router({
  /**
   * Get all simulation scenarios
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getAllSimulationScenarios(client);
  }),

  /**
   * Get simulation scenario by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      return await getSimulationScenarioById(client, input.id);
    }),

  /**
   * Get user's simulation attempts
   * Optionally filter by scenario
   */
  getAttempts: protectedProcedure
    .input(z.object({ scenarioId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }
      return await getUserSimulationAttempts(client, ctx.user.id, ctx.tenantId, input.scenarioId);
    }),

  /**
   * Get simulation analytics for current user
   * Includes overview stats, category averages, and score trends
   */
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tenant context required",
      });
    }
    const attempts = await getUserSimulationAttempts(client, ctx.user.id, ctx.tenantId);
    const scenarios = await getAllSimulationScenarios(client);

    // Calculate overall statistics
    const totalAttempts = attempts.length;
    const avgScore =
      totalAttempts > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.overallScore, 0) / totalAttempts)
        : 0;
    const bestScore = totalAttempts > 0 ? Math.max(...attempts.map((a) => a.overallScore)) : 0;
    const passedAttempts = attempts.filter((a) => a.passed).length;
    const completionRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    // Calculate category averages
    const categoryAverages =
      totalAttempts > 0
        ? {
            technical: Math.round(
              attempts.reduce((sum, a) => sum + (a.categoryScores?.technical || 0), 0) / totalAttempts
            ),
            crossFunctional: Math.round(
              attempts.reduce((sum, a) => sum + (a.categoryScores?.crossFunctional || 0), 0) / totalAttempts
            ),
            aiAugmentation: Math.round(
              attempts.reduce((sum, a) => sum + (a.categoryScores?.aiAugmentation || 0), 0) / totalAttempts
            ),
          }
        : {
            technical: 0,
            crossFunctional: 0,
            aiAugmentation: 0,
          };

    // Group attempts by scenario for detailed stats
    const scenarioStats = scenarios
      .map((scenario) => {
        const scenarioAttempts = attempts.filter((a) => a.scenarioId === scenario.id);
        const scenarioAvg =
          scenarioAttempts.length > 0
            ? Math.round(scenarioAttempts.reduce((sum, a) => sum + a.overallScore, 0) / scenarioAttempts.length)
            : 0;
        const scenarioBest = scenarioAttempts.length > 0 ? Math.max(...scenarioAttempts.map((a) => a.overallScore)) : 0;

        return {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          scenarioType: scenario.type,
          attemptCount: scenarioAttempts.length,
          avgScore: scenarioAvg,
          bestScore: scenarioBest,
          lastAttempt: scenarioAttempts.length > 0 ? scenarioAttempts[scenarioAttempts.length - 1].completedAt : null,
        };
      })
      .filter((s) => s.attemptCount > 0);

    // Prepare score trend data (last 10 attempts)
    const scoreTrend = attempts.slice(-10).map((a) => ({
      attemptId: a.id,
      scenarioTitle: scenarios.find((s) => s.id === a.scenarioId)?.title || "Unknown",
      score: a.overallScore,
      completedAt: a.completedAt,
      passed: a.passed,
    }));

    return {
      overview: {
        totalAttempts,
        avgScore,
        bestScore,
        completionRate,
      },
      categoryAverages,
      scenarioStats,
      scoreTrend,
      recentAttempts: attempts.slice(-5).reverse().map((a) => ({
        id: a.id,
        scenarioTitle: scenarios.find((s) => s.id === a.scenarioId)?.title || "Unknown",
        scenarioType: scenarios.find((s) => s.id === a.scenarioId)?.type || "unknown",
        attemptNumber: a.attemptNumber,
        overallScore: a.overallScore,
        categoryScores: a.categoryScores,
        passed: a.passed,
        timeSpent: a.timeSpent,
        completedAt: a.completedAt,
      })),
    };
  }),

  /**
   * Evaluate a single simulation response
   * Uses AI to provide feedback and scoring
   */
  evaluateResponse: protectedProcedure
    .input(
      z.object({
        scenarioId: z.number(),
        stepNumber: z.number(),
        userResponse: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const scenario = await getSimulationScenarioById(client, input.scenarioId);

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      logger.info("[Academy] Simulation response evaluation requested", {
        scenarioId: input.scenarioId,
        stepNumber: input.stepNumber,
        scenarioType: scenario.type,
      });

      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant context required." });
      }

      // Build the evaluation prompt from the scenario definition and user response.
      const scenarioContext = JSON.stringify({
        title: scenario.title,
        description: scenario.description,
        type: scenario.type,
        difficulty: scenario.difficulty_level,
        step: input.stepNumber,
        evaluationCriteria: scenario.evaluation_criteria ?? {},
      });

      const systemPrompt = `You are an expert evaluator for a B2B value engineering simulation.
Evaluate the user's response to the simulation scenario step.
Return ONLY a valid JSON object with this exact structure:
{
  "score": <integer 0-100>,
  "categoryBreakdown": {
    "technical": <integer 0-40>,
    "crossFunctional": <integer 0-30>,
    "aiAugmentation": <integer 0-30>
  },
  "strengths": [<string>, ...],
  "improvements": [<string>, ...],
  "feedback": "<one paragraph of constructive feedback>"
}
The three category scores must sum to the total score.
Be specific, actionable, and calibrated to the scenario difficulty.`;

      const userPrompt = `Scenario context:
${scenarioContext}

User response to step ${input.stepNumber}:
${input.userResponse}

Evaluate this response and return the JSON object.`;

      const llm = new LLMGateway({
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 800,
      });

      let rawContent: string;
      try {
        const llmResponse = await llm.complete({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          metadata: {
            tenantId,
            agentType: "academy-evaluator",
            sessionId: `academy-eval-${input.scenarioId}-${input.stepNumber}`,
          },
        });
        rawContent = llmResponse.content;
      } catch (llmErr) {
        logger.error("[Academy] LLM evaluation failed", {
          scenarioId: input.scenarioId,
          stepNumber: input.stepNumber,
          error: llmErr instanceof Error ? llmErr.message : String(llmErr),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Evaluation service unavailable. Please try again.",
        });
      }

      // Parse and validate the LLM response.
      let evaluation: EvaluationResult;
      try {
        // Strip markdown code fences if the model wrapped the JSON.
        const jsonText = rawContent
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        const parsed = JSON.parse(jsonText) as unknown;
        evaluation = EvaluationResultSchema.parse(parsed);
      } catch (parseErr) {
        logger.error("[Academy] Failed to parse LLM evaluation response", {
          scenarioId: input.scenarioId,
          rawContent,
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Evaluation response was malformed. Please try again.",
        });
      }

      logger.info("[Academy] Simulation response evaluated", {
        scenarioId: input.scenarioId,
        stepNumber: input.stepNumber,
        score: evaluation.score,
      });

      return evaluation;
    }),

  /**
   * Submit completed simulation attempt
   * Calculates scores, awards certifications if applicable
   */
  submitAttempt: protectedProcedure
    .input(
      z.object({
        scenarioId: z.number(),
        responsesData: z.array(
          z.object({
            stepNumber: z.number(),
            userResponse: z.string(),
            aiFeedback: z.string(),
            score: z.number(),
            strengths: z.array(z.string()),
            improvements: z.array(z.string()),
          })
        ),
        timeSpent: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }

      // Calculate scores using dedicated scoring module
      const scoringResult = calculateScoringResult(input.responsesData as SimulationResponse[]);

      // Validate scoring result
      const validation = validateScoringResult(scoringResult);
      if (!validation.valid) {
        logger.error("[Simulation] Invalid scoring result", validation.errors);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Scoring calculation error",
        });
      }

      const { overallScore, categoryScores, passed, tier } = scoringResult;

      // Get attempt number
      const attemptCount = await getSimulationAttemptCount(client, ctx.user.id, ctx.tenantId, input.scenarioId);
      const attemptNumber = attemptCount + 1;

      // Generate overall feedback (simplified)
      const overallFeedback = passed
        ? "Great work! You've demonstrated solid understanding of VOS principles."
        : "Good effort! Review the feedback and try again to improve your score.";

      // Save attempt
      await createSimulationAttempt(client, {
        userId: ctx.user.id,
        organizationId: ctx.tenantId,
        scenarioId: input.scenarioId,
        attemptNumber,
        responsesData: { responses: input.responsesData },
        overallScore,
        categoryScores,
        passed,
        timeSpent: input.timeSpent,
        feedback: overallFeedback,
        completedAt: new Date().toISOString(),
      });

      // Award certification if passed with high score
      if (passed && tier && (tier === "gold" || tier === "silver")) {
        const scenario = await getSimulationScenarioById(client, input.scenarioId);
        if (scenario && scenario.pillarId) {
          const alreadyCertified = await hasCertification(client, ctx.user.id, ctx.tenantId, scenario.pillarId, "general");

          if (!alreadyCertified) {
            const badgeTier = tier.charAt(0).toUpperCase() + tier.slice(1);
            await createCertification(client, {
              userId: ctx.user.id,
              organizationId: ctx.tenantId,
              badgeName: `${scenario.title} - ${badgeTier}`,
              pillarId: scenario.pillarId,
              vosRole: "general",
              tier,
              score: overallScore,
              awardedAt: new Date().toISOString(),
            });
          }
        }
      }

      return {
        success: true,
        passed,
        overallScore,
        categoryScores,
        feedback: overallFeedback,
        attemptNumber,
      };
    }),

  /**
   * Get personalized recommendations based on user performance.
   * Uses a deterministic data pipeline by default.
   * Optional AI enrichment can be enabled via SIMULATION_AI_RECOMMENDATIONS_ENABLED=true.
   */
  getRecommendations: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tenant context required",
      });
    }
    const attempts = await getUserSimulationAttempts(client, ctx.user.id, ctx.tenantId);
    const scenarios = await getAllSimulationScenarios(client);
    const aiRecommendationsEnabled = process.env.SIMULATION_AI_RECOMMENDATIONS_ENABLED === "true";

    const attemptsByScenario = new Map<number, typeof attempts>();
    for (const attempt of attempts) {
      const grouped = attemptsByScenario.get(attempt.scenarioId) ?? [];
      grouped.push(attempt);
      attemptsByScenario.set(attempt.scenarioId, grouped);
    }

    const totalAttempts = attempts.length;
    const avgScore =
      totalAttempts > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.overallScore, 0) / totalAttempts) : 0;

    const recommendations: Array<{
      type: "start" | "review" | "practice" | "challenge" | "mentor";
      title: string;
      description: string;
      scenarioId?: number;
      confidence: number;
      source: "rules" | "ai";
    }> = [];

    const unattemptedScenario = scenarios.find((scenario) => !attemptsByScenario.has(scenario.id));
    if (totalAttempts === 0 && unattemptedScenario) {
      recommendations.push({
        type: "start",
        title: "Start Your First Simulation",
        description: `Begin with ${unattemptedScenario.title} to establish a baseline score.`,
        scenarioId: unattemptedScenario.id,
        confidence: 0.92,
        source: "rules",
      });
    }

    const lowPerformingScenario = scenarios
      .map((scenario) => {
        const scenarioAttempts = attemptsByScenario.get(scenario.id) ?? [];
        if (scenarioAttempts.length === 0) return null;
        const scenarioAvg = scenarioAttempts.reduce((sum, a) => sum + a.overallScore, 0) / scenarioAttempts.length;
        return { scenario, scenarioAvg };
      })
      .filter(
        (entry): entry is { scenario: (typeof scenarios)[number]; scenarioAvg: number } => entry !== null
      )
      .sort((a, b) => a.scenarioAvg - b.scenarioAvg)[0];

    if (lowPerformingScenario && lowPerformingScenario.scenarioAvg < 80) {
      recommendations.push({
        type: "review",
        title: "Target your lowest-scoring scenario",
        description: `${lowPerformingScenario.scenario.title} is averaging ${Math.round(
          lowPerformingScenario.scenarioAvg
        )}%. Re-run this scenario and focus on rubric gaps.`,
        scenarioId: lowPerformingScenario.scenario.id,
        confidence: 0.88,
        source: "rules",
      });
    }

    if (avgScore >= 70 && avgScore < 90) {
      const nextPractice = unattemptedScenario ?? scenarios.find((s) => s.type !== lowPerformingScenario?.scenario.type);
      if (nextPractice) {
        recommendations.push({
          type: "practice",
          title: "Expand scenario coverage",
          description: `Practice ${nextPractice.title} to improve cross-category fluency.`,
          scenarioId: nextPractice.id,
          confidence: 0.84,
          source: "rules",
        });
      }
    }

    if (avgScore >= 90) {
      recommendations.push({
        type: "challenge",
        title: "Maintain expert-level performance",
        description: "Take a new advanced scenario this week and keep all category scores above 85%.",
        confidence: 0.8,
        source: "rules",
      });
      recommendations.push({
        type: "mentor",
        title: "Mentor peers",
        description: "Share your approach and coach lower-scoring learners to reinforce mastery.",
        confidence: 0.75,
        source: "rules",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: "start",
        title: "Build momentum with regular practice",
        description: "Complete at least one simulation this week to generate personalized insights.",
        scenarioId: scenarios[0]?.id,
        confidence: 0.7,
        source: "rules",
      });
    }

    // AI recommendations disabled for now - would need LLM integration
    if (aiRecommendationsEnabled) {
      logger.info("[Academy] AI recommendations requested but not yet implemented");
    }

    return recommendations;
  }),
});
