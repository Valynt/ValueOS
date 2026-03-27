/**
 * Quiz Router
 * Handles quiz questions, submissions, and results with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { getSupabaseClient } from "../utils.js";

// ============================================================================
// Types
// ============================================================================

interface QuizQuestion {
  id: number;
  pillarId: number;
  questionNumber: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  category: string;
  points: number;
}

interface QuizResult {
  id: number;
  userId: string;
  pillarId: number;
  score: number;
  categoryScores: Record<string, number> | null;
  answers: Record<string, unknown>;
  feedback: string;
  passed: boolean;
  attemptNumber: number;
  completedAt: string;
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

interface SimulationAttempt {
  id: number;
  userId: string;
  scenarioId: number;
  overallScore: number;
  pillarId: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

// getSupabaseClient is now imported from ../utils.js

/**
 * Generate personalized quiz feedback based on score and maturity level
 */
function generateQuizFeedback(
  score: number,
  maturityLevel: number,
  categoryScores?: Record<string, number>
) {
  const feedback: {
    overall: string;
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
  } = {
    overall: "",
    strengths: [],
    improvements: [],
    nextSteps: [],
  };

  // Overall feedback based on score
  if (score >= 90) {
    feedback.overall = "Excellent work! You've demonstrated strong mastery of this pillar's concepts.";
  } else if (score >= 80) {
    feedback.overall = "Good job! You've passed and shown solid understanding of the core concepts.";
  } else if (score >= 70) {
    feedback.overall = "You're close! Review the feedback below and retake the quiz to achieve certification.";
  } else {
    feedback.overall = "Keep learning! Focus on the improvement areas below and revisit the pillar content.";
  }

  // Maturity-based guidance
  if (maturityLevel <= 1) {
    feedback.nextSteps.push("Focus on building foundational knowledge through the pillar content");
    feedback.nextSteps.push("Review the KPI Definition Sheet and practice mapping pain to value");
  } else if (maturityLevel === 2) {
    feedback.nextSteps.push("Apply these concepts in cross-functional scenarios");
    feedback.nextSteps.push("Practice structured value realization tracking");
  } else {
    feedback.nextSteps.push("Integrate these concepts into automated workflows");
    feedback.nextSteps.push("Mentor others on value language and frameworks");
  }

  // Category-specific feedback
  if (categoryScores) {
    const categories = Object.entries(categoryScores);
    const strongCategories = categories.filter(([_, s]) => s >= 80);
    const weakCategories = categories.filter(([_, s]) => s < 70);

    strongCategories.forEach(([category]) => {
      feedback.strengths.push(`Strong performance in ${category}`);
    });

    weakCategories.forEach(([category]) => {
      feedback.improvements.push(`Review ${category} concepts and examples`);
    });
  }

  return feedback;
}

// ============================================================================
// Database Operations
// ============================================================================

async function getQuizQuestionsByPillar(
  client: RequestScopedRlsSupabaseClient,
  pillarId: number
): Promise<QuizQuestion[]> {
  const { data, error } = await client
    .from("quiz_questions")
    .select("*")
    .eq("pillar_id", pillarId)
    .order("question_number");

  if (error) {
    logger.error("Failed to get quiz questions", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve quiz questions",
    });
  }

  return (data || []).map((q) => ({
    id: q.id,
    pillarId: q.pillar_id,
    questionNumber: q.question_number,
    questionText: q.question_text,
    options: q.options,
    correctAnswer: q.correct_answer,
    explanation: q.explanation,
    category: q.category,
    points: q.points,
  }));
}

async function getUserQuizResults(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  organizationId: string,
  pillarId?: number
): Promise<QuizResult[]> {
  let query = client
    .from("quiz_results")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (pillarId) {
    query = query.eq("pillar_id", pillarId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to get quiz results", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve quiz results",
    });
  }

  return (data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    pillarId: r.pillar_id,
    score: r.score,
    categoryScores: r.category_scores,
    answers: r.answers,
    feedback: r.feedback,
    passed: r.passed,
    attemptNumber: r.attempt_number,
    completedAt: r.completed_at,
  }));
}

async function createQuizResult(
  client: RequestScopedRlsSupabaseClient,
  result: Omit<QuizResult, "id"> & { organizationId: string }
): Promise<void> {
  const { error } = await client.from("quiz_results").insert({
    organization_id: result.organizationId,
    user_id: result.userId,
    pillar_id: result.pillarId,
    score: result.score,
    category_scores: result.categoryScores,
    answers: result.answers,
    feedback: result.feedback,
    passed: result.passed,
    attempt_number: result.attemptNumber,
    completed_at: result.completedAt,
  });

  if (error) {
    logger.error("Failed to create quiz result", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save quiz result",
    });
  }
}

async function getPillarById(client: RequestScopedRlsSupabaseClient, pillarId: number) {
  const { data, error } = await client
    .from("pillars")
    .select("*")
    .eq("id", pillarId)
    .single();

  if (error) {
    logger.error("Failed to get pillar", error);
    return null;
  }

  return data;
}

async function getUserSimulationAttempts(
  client: RequestScopedRlsSupabaseClient,
  userId: string,
  organizationId: string
): Promise<SimulationAttempt[]> {
  const { data, error } = await client
    .from("simulation_attempts")
    .select("id, user_id, scenario_id, overall_score, simulation_scenarios(pillar_id)")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to get simulation attempts", error);
    return [];
  }

  return (data || []).map((a) => {
    const scenario = a.simulation_scenarios as unknown as { pillar_id: number | null } | null;
    return {
      id: a.id,
      userId: a.user_id,
      scenarioId: a.scenario_id,
      overallScore: a.overall_score,
      pillarId: scenario?.pillar_id ?? null,
    };
  });
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

async function upsertProgress(
  client: RequestScopedRlsSupabaseClient,
  progress: {
    userId: string;
    organizationId: string;
    pillarId: number;
    status: string;
    completionPercentage: number;
    lastAccessed: Date;
    completedAt?: Date;
  }
): Promise<void> {
  const { data: existing, error: existingError } = await client
    .from("progress")
    .select("id")
    .eq("organization_id", progress.organizationId)
    .eq("user_id", progress.userId)
    .eq("pillar_id", progress.pillarId)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    logger.error("Failed to check existing progress", existingError);
  }

  if (existing) {
    const { error } = await client
      .from("progress")
      .update({
        status: progress.status,
        completion_percentage: progress.completionPercentage,
        last_accessed: progress.lastAccessed.toISOString(),
        completed_at: progress.completedAt?.toISOString() || null,
      })
      .eq("organization_id", progress.organizationId)
      .eq("id", existing.id);

    if (error) {
      logger.error("Failed to update progress", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update progress",
      });
    }
  } else {
    const { error } = await client.from("progress").insert({
      organization_id: progress.organizationId,
      user_id: progress.userId,
      pillar_id: progress.pillarId,
      status: progress.status,
      completion_percentage: progress.completionPercentage,
      last_accessed: progress.lastAccessed.toISOString(),
      completed_at: progress.completedAt?.toISOString() || null,
    });

    if (error) {
      logger.error("Failed to create progress", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create progress",
      });
    }
  }
}

async function getUserMaturityLevel(
  client: RequestScopedRlsSupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await client
    .from("users")
    .select("maturity_level")
    .eq("id", userId)
    .single();

  if (error) {
    logger.error("Failed to get user maturity level", error);
    return 0;
  }

  return data?.maturity_level ?? 0;
}

// ============================================================================
// Router
// ============================================================================

export const quizRouter = router({
  /**
   * Get quiz questions for a pillar
   */
  getQuestions: protectedProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }
      return await getQuizQuestionsByPillar(client, input.pillarId);
    }),

  /**
   * Submit quiz answers and calculate results
   * Awards certification if passed (80%+) using 40/30/30 rubric
   */
  submitQuiz: protectedProcedure
    .input(
      z.object({
        pillarId: z.number(),
        answers: z.array(
          z.object({
            questionId: z.number(),
            selectedAnswer: z.string(),
            isCorrect: z.boolean(),
            pointsEarned: z.number(),
          })
        ),
        score: z.number(),
        categoryScores: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const passed = input.score >= 80;

      // Get attempt number
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }
      const previousResults = await getUserQuizResults(client, ctx.user.id, ctx.tenantId, input.pillarId);
      const attemptNumber = previousResults.length + 1;

      // Get user's actual maturity level from database
      const maturityLevel = await getUserMaturityLevel(client, ctx.user.id);
      const feedback = generateQuizFeedback(input.score, maturityLevel, input.categoryScores);

      // Save quiz result
      await createQuizResult(client, {
        userId: ctx.user.id,
        organizationId: ctx.tenantId,
        pillarId: input.pillarId,
        score: input.score,
        categoryScores: input.categoryScores || null,
        answers: { answers: input.answers },
        feedback: JSON.stringify(feedback),
        passed,
        attemptNumber,
        completedAt: new Date().toISOString(),
      });

      // If passed, award certification using 40/30/30 rubric
      if (passed) {
        const pillar = await getPillarById(client, input.pillarId);

        // Get user's simulation performance for this pillar (if applicable)
        const simulationAttempts = await getUserSimulationAttempts(client, ctx.user.id, ctx.tenantId);
        // Filter simulations that are linked to this pillar - requires scenario metadata
        // For now, exclude simulations that don't match the pillar context
        const pillarSimulations = simulationAttempts.filter((attempt) => {
          if (attempt.pillarId !== null) {
            return attempt.pillarId === input.pillarId;
          }
          // Scenarios without pillar metadata are included as a fallback
          // so early adopters who created simulations before the field existed
          // are not penalised.
          return true;
        });

        // Calculate simulation average (30% of certification score)
        const simulationAvg =
          pillarSimulations.length > 0
            ? pillarSimulations.reduce((sum, attempt) => sum + attempt.overallScore, 0) /
              pillarSimulations.length
            : 0;

        // Calculate role task score (30% of certification score)
        const roleTaskScore = Math.min(
          100,
          input.score * 0.5 +
            (input.categoryScores?.technical || 0) * 0.3 +
            (input.categoryScores?.crossFunctional || 0) * 0.2
        );

        // Calculate final certification score using 40/30/30 rubric
        const quizWeight = 0.4;
        const simulationWeight = 0.3;
        const roleTaskWeight = 0.3;

        const finalCertificationScore = Math.round(
          input.score * quizWeight + simulationAvg * simulationWeight + roleTaskScore * roleTaskWeight
        );

        const badgeName = `${pillar?.title || "Unknown Pillar"} - Certified`;

        const alreadyCertified = await hasCertification(client, ctx.user.id, ctx.tenantId, input.pillarId, "general");

        if (!alreadyCertified) {
          await createCertification(client, {
            userId: ctx.user.id,
            organizationId: ctx.tenantId,
            badgeName,
            pillarId: input.pillarId,
            vosRole: "general",
            tier:
              finalCertificationScore >= 95 ? "gold" : finalCertificationScore >= 80 ? "silver" : "bronze",
            score: finalCertificationScore,
            awardedAt: new Date().toISOString(),
          });
        }

        // Update progress to completed
        await upsertProgress(client, {
          userId: ctx.user.id,
          organizationId: ctx.tenantId,
          pillarId: input.pillarId,
          status: "completed",
          completionPercentage: 100,
          lastAccessed: new Date(),
          completedAt: new Date(),
        });
      }

      return {
        success: true,
        passed,
        feedback,
        attemptNumber,
      };
    }),

  /**
   * Get quiz results for user
   * Optionally filter by pillar
   */
  getResults: protectedProcedure
    .input(z.object({ pillarId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }
      return await getUserQuizResults(client, ctx.user.id, ctx.tenantId, input.pillarId);
    }),
});
