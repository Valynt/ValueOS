import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Maturity assessments router
 * Handles user maturity level tracking and assessments
 */
export const maturityRouter = router({
  /**
   * Get all maturity assessments for current user
   */
  getAssessments: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserMaturityAssessments(ctx.user.id);
  }),
  
  /**
   * Create new maturity assessment
   * Updates user's maturity level
   */
  createAssessment: protectedProcedure
    .input(z.object({
      level: z.number().min(0).max(5),
      assessmentData: z.object({
        selfAssessment: z.number(),
        quizAverage: z.number(),
        pillarsCompleted: z.number(),
        behaviorIndicators: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createMaturityAssessment({
        userId: ctx.user.id,
        level: input.level,
        assessmentData: input.assessmentData,
        assessedAt: new Date(),
      });
      
      // Update user's maturity level
      await db.updateUserMaturityLevel(ctx.user.id, input.level);
      
      return { success: true };
    }),
});
