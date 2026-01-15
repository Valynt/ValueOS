import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Resources router
 * Handles learning resources, templates, and downloadable content
 */
export const resourcesRouter = router({
  /**
   * Get all resources
   */
  list: publicProcedure.query(async () => {
    return await db.getAllResources();
  }),
  
  /**
   * Get resources for specific pillar
   */
  getByPillar: publicProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ input }) => {
      return await db.getResourcesByPillar(input.pillarId);
    }),
  
  /**
   * Get resources for specific VOS role
   */
  getByRole: publicProcedure
    .input(z.object({ vosRole: z.string() }))
    .query(async ({ input }) => {
      return await db.getResourcesByRole(input.vosRole);
    }),
});
