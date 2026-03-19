/**
 * Maturity Router
 * Handles user maturity level tracking and assessments with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestRlsSupabaseClient } from "../../../lib/supabase.js";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, router } from "../trpc.js";

// ============================================================================
// Types
// ============================================================================

interface MaturityAssessment {
  id: number;
  userId: string;
  level: number;
  assessmentData: Record<string, unknown>;
  assessedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getSupabaseClient(ctx: { supabase?: ReturnType<typeof createRequestRlsSupabaseClient>; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createRequestRlsSupabaseClient(ctx.accessToken);
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No Supabase client available",
  });
}

// ============================================================================
// Database Operations
// ============================================================================

async function getUserMaturityAssessments(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
  userId: string
): Promise<MaturityAssessment[]> {
  const { data, error } = await client
    .from("maturity_assessments")
    .select("*")
    .eq("user_id", userId)
    .order("assessed_at", { ascending: false });

  if (error) {
    logger.error("Failed to get maturity assessments", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve maturity assessments",
    });
  }

  return (data || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    level: a.level,
    assessmentData: a.assessment_data,
    assessedAt: a.assessed_at,
  }));
}

async function createMaturityAssessment(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
  assessment: Omit<MaturityAssessment, "id">
): Promise<void> {
  const { error } = await client.from("maturity_assessments").insert({
    user_id: assessment.userId,
    level: assessment.level,
    assessment_data: assessment.assessmentData,
    assessed_at: assessment.assessedAt,
  });

  if (error) {
    logger.error("Failed to create maturity assessment", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create maturity assessment",
    });
  }
}

async function updateUserMaturityLevel(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
  userId: string,
  level: number
): Promise<void> {
  const { error } = await client
    .from("users")
    .update({ maturity_level: level })
    .eq("id", userId);

  if (error) {
    logger.error("Failed to update user maturity level", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update maturity level",
    });
  }
}

// ============================================================================
// Router
// ============================================================================

export const maturityRouter = router({
  /**
   * Get all maturity assessments for current user
   */
  getAssessments: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    return await getUserMaturityAssessments(client, ctx.user.id);
  }),

  /**
   * Create new maturity assessment
   * Updates user's maturity level
   */
  createAssessment: protectedProcedure
    .input(
      z.object({
        level: z.number().min(0).max(5),
        assessmentData: z.object({
          selfAssessment: z.number(),
          quizAverage: z.number(),
          pillarsCompleted: z.number(),
          behaviorIndicators: z.array(z.string()),
          recommendations: z.array(z.string()),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      await createMaturityAssessment(client, {
        userId: ctx.user.id,
        level: input.level,
        assessmentData: input.assessmentData,
        assessedAt: new Date().toISOString(),
      });

      // Update user's maturity level
      await updateUserMaturityLevel(client, ctx.user.id, input.level);

      return { success: true };
    }),
});
