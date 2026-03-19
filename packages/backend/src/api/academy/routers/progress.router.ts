/**
 * Progress Router
 * Handles user progress through pillars and modules with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestRlsSupabaseClient } from "../../../lib/supabase.js";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, router } from "../trpc.js";
import { getSupabaseClient } from "../utils.js";

// ============================================================================
// Types
// ============================================================================

interface Progress {
  id: number;
  userId: string;
  pillarId: number;
  status: "not_started" | "in_progress" | "completed";
  completionPercentage: number;
  lastAccessed: string;
  completedAt: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

// getSupabaseClient is now imported from ../utils.js

// ============================================================================
// Database Operations
// ============================================================================

async function getUserProgress(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
  userId: string,
  organizationId: string
): Promise<Progress[]> {
  const { data, error } = await client
    .from("progress")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to get user progress", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve progress",
    });
  }

  return (data || []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    pillarId: p.pillar_id,
    status: p.status,
    completionPercentage: p.completion_percentage,
    lastAccessed: p.last_accessed,
    completedAt: p.completed_at,
  }));
}

async function getUserPillarProgress(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
  userId: string,
  organizationId: string,
  pillarId: number
): Promise<Progress | null> {
  const { data, error } = await client
    .from("progress")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("pillar_id", pillarId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - not an error, just no progress yet
      return null;
    }
    logger.error("Failed to get pillar progress", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve pillar progress",
    });
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    pillarId: data.pillar_id,
    status: data.status,
    completionPercentage: data.completion_percentage,
    lastAccessed: data.last_accessed,
    completedAt: data.completed_at,
  };
}

async function upsertProgress(
  client: ReturnType<typeof createRequestRlsSupabaseClient>,
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

// ============================================================================
// Router
// ============================================================================

export const progressRouter = router({
  /**
   * Get all progress for current user
   */
  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tenant context required",
      });
    }
    return await getUserProgress(client, ctx.user.id, ctx.tenantId);
  }),

  /**
   * Get progress for specific pillar
   */
  getPillarProgress: protectedProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant context required",
        });
      }
      return await getUserPillarProgress(client, ctx.user.id, ctx.tenantId, input.pillarId);
    }),

  /**
   * Update progress for a pillar
   */
  updateProgress: protectedProcedure
    .input(
      z.object({
        pillarId: z.number(),
        status: z.enum(["not_started", "in_progress", "completed"]),
        completionPercentage: z.number().min(0).max(100),
        completedAt: z.date().optional(),
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
      await upsertProgress(client, {
        userId: ctx.user.id,
        organizationId: ctx.tenantId,
        pillarId: input.pillarId,
        status: input.status,
        completionPercentage: input.completionPercentage,
        lastAccessed: new Date(),
        completedAt: input.completedAt,
      });

      return { success: true };
    }),
});
