import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * User profile management router
 * Handles user profile updates and preferences
 */
export const userRouter = router({
  /**
   * Update user's VOS role
   */
  updateVosRole: protectedProcedure
    .input(z.object({
      vosRole: z.enum(["Sales", "CS", "Marketing", "Product", "Executive", "VE"])
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserVosRole(ctx.user.id, input.vosRole);
      return { success: true };
    }),
  
  /**
   * Update user's maturity level
   */
  updateMaturityLevel: protectedProcedure
    .input(z.object({
      level: z.number().min(0).max(5)
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserMaturityLevel(ctx.user.id, input.level);
      return { success: true };
    }),
});
