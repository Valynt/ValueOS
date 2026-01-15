import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Progress tracking router
 * Handles user progress through pillars and modules
 */
export const progressRouter = router({
  /**
   * Get all progress for current user
   */
  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserProgress(ctx.user.id);
  }),
  
  /**
   * Get progress for specific pillar
   */
  getPillarProgress: protectedProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getUserPillarProgress(ctx.user.id, input.pillarId);
    }),
  
  /**
   * Update progress for a pillar
   */
  updateProgress: protectedProcedure
    .input(z.object({
      pillarId: z.number(),
      status: z.enum(["not_started", "in_progress", "completed"]),
      completionPercentage: z.number().min(0).max(100),
      completedAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertProgress({
        userId: ctx.user.id,
        pillarId: input.pillarId,
        status: input.status,
        completionPercentage: input.completionPercentage,
        lastAccessed: new Date(),
        completedAt: input.completedAt,
      } as any);
      
      return { success: true };
    }),
});
