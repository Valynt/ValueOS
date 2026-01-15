import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Pillars router
 * Handles VOS pillar content and metadata
 */
export const pillarsRouter = router({
  /**
   * Get all pillars
   */
  list: publicProcedure.query(async () => {
    return await db.getAllPillars();
  }),
  
  /**
   * Get pillar by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getPillarById(input.id);
    }),
  
  /**
   * Get pillar by number (1-10)
   */
  getByNumber: publicProcedure
    .input(z.object({ pillarNumber: z.number() }))
    .query(async ({ input }) => {
      return await db.getPillarByNumber(input.pillarNumber);
    }),
});
