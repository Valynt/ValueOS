/**
 * Analytics Router
 * Provides dashboard statistics and insights with tenant isolation
 */
import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { logger } from "../../../lib/logger.js";
import { type AcademyContext, protectedProcedure, router } from "../trpc.js";

// ============================================================================
// Helpers
// ============================================================================

function getDateRangeCutoff(dateRange: string): Date | null {
  if (dateRange === "all") return null;

  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return cutoffDate;
}

function getSupabaseClient(ctx: { supabase?: RequestScopedRlsSupabaseClient; accessToken?: string }) {
  if (ctx.supabase) {
    return ctx.supabase;
  }
  if (ctx.accessToken) {
    return createRequestSupabaseClient({ accessToken: ctx.accessToken });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No Supabase client available",
  });
}

function getOrganizationId(ctx: Pick<AcademyContext, "tenantId" | "user">): string {
  const organizationId = ctx.tenantId ?? ctx.user?.organizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tenant context required",
    });
  }

  return organizationId;
}

const pillarBreakdownSchema = z.object({
  pillarId: z.number().int(),
  pillarName: z.string(),
  attempts: z.number().int().nonnegative(),
  averageScore: z.number().int().nonnegative(),
  passRate: z.number().int().nonnegative(),
});

const quizStatsRpcSchema = z.object({
  totalQuizzes: z.number().int().nonnegative(),
  passedAttempts: z.number().int().nonnegative().default(0),
  averageScore: z.number().int().nonnegative(),
  passRate: z.number().int().nonnegative(),
  distinctUserCompletionCount: z.number().int().nonnegative().default(0),
  completionRate: z.number().int().nonnegative(),
  pillarBreakdown: z.array(pillarBreakdownSchema),
});

const certificationStatsRpcSchema = z.object({
  totalCertifications: z.number().int().nonnegative(),
  tierBreakdown: z.array(
    z.object({
      tier: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
});

const simulationStatsRpcSchema = z.object({
  totalAttempts: z.number().int().nonnegative(),
  passedAttempts: z.number().int().nonnegative().default(0),
  averageScore: z.number().int().nonnegative(),
  passRate: z.number().int().nonnegative(),
});

// ============================================================================
// Router
// ============================================================================

export const analyticsRouter = router({
  /**
   * Get user statistics
   * Includes total users, active users, new users, and average maturity
   * Scoped to current user's organization via RLS
   */
  userStats: protectedProcedure
    .input(
      z.object({
        dateRange: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
        role: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        // Get total users count (filtered by RLS to tenant)
        const { count: totalUsers, error: totalError } = await client
          .from("users")
          .select("*", { count: "exact", head: true });

        if (totalError) {
          logger.error("Failed to get user stats", totalError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get user statistics",
          });
        }

        // Get active users (signed in within specified period)
        let activeUsers = 0;
        if (cutoffDate) {
          const { count, error } = await client
            .from("users")
            .select("*", { count: "exact", head: true })
            .gte("last_signed_in", cutoffDate.toISOString());

          if (error) {
            logger.error("Failed to get active users", error);
          } else {
            activeUsers = count || 0;
          }
        } else {
          activeUsers = totalUsers || 0;
        }

        // Get new users this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: newUsersThisMonth, error: newUsersError } = await client
          .from("users")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startOfMonth.toISOString());

        if (newUsersError) {
          logger.error("Failed to get new users", newUsersError);
        }

        // Calculate average maturity level
        const { data: maturityData, error: maturityError } = await client
          .from("users")
          .select("maturity_level");

        let averageMaturityLevel = 0;
        if (!maturityError && maturityData) {
          const validLevels = maturityData.filter((u) => u.maturity_level !== null);
          if (validLevels.length > 0) {
            averageMaturityLevel = Math.round(
              validLevels.reduce((sum, u) => sum + (u.maturity_level || 0), 0) / validLevels.length
            );
          }
        }

        return {
          totalUsers: totalUsers || 0,
          activeUsers,
          newUsersThisMonth: newUsersThisMonth || 0,
          averageMaturityLevel,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error("Unexpected error in userStats", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve user statistics",
        });
      }
    }),

  /**
   * Get quiz statistics
   * Includes attempts, scores, pass rates, and pillar breakdown
   * Scoped to current user's organization via RLS
   */
  quizStats: protectedProcedure
    .input(
      z.object({
        dateRange: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
        pillarId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const organizationId = getOrganizationId(ctx);
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        const { data, error } = await client.rpc("get_academy_quiz_stats", {
          p_organization_id: organizationId,
          p_since: cutoffDate?.toISOString() ?? null,
          p_pillar_id: input.pillarId ?? null,
        });

        if (error) {
          logger.error("Failed to get quiz stats", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get quiz statistics",
          });
        }

        return quizStatsRpcSchema.parse(data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error("Unexpected error in quizStats", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve quiz statistics",
        });
      }
    }),

  /**
   * Get certification statistics
   * Includes total certifications and tier breakdown
   * Scoped to current user's organization via RLS
   */
  certificationStats: protectedProcedure
    .input(
      z.object({
        dateRange: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const organizationId = getOrganizationId(ctx);
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        const { data, error } = await client.rpc("get_academy_certification_stats", {
          p_organization_id: organizationId,
          p_since: cutoffDate?.toISOString() ?? null,
        });

        if (error) {
          logger.error("Failed to get certification stats", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get certification statistics",
          });
        }

        return certificationStatsRpcSchema.parse(data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error("Unexpected error in certificationStats", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve certification statistics",
        });
      }
    }),

  /**
   * Get simulation statistics
   * Includes attempts, scores, and completion rates
   * Scoped to current user's organization via RLS
   */
  simulationStats: protectedProcedure
    .input(
      z.object({
        dateRange: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = getSupabaseClient(ctx);
      const organizationId = getOrganizationId(ctx);
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        const { data, error } = await client.rpc("get_academy_simulation_stats", {
          p_organization_id: organizationId,
          p_since: cutoffDate?.toISOString() ?? null,
        });

        if (error) {
          logger.error("Failed to get simulation stats", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get simulation statistics",
          });
        }

        return simulationStatsRpcSchema.parse(data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error("Unexpected error in simulationStats", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve simulation statistics",
        });
      }
    }),

  /**
   * Get academy overview stats
   * Combines key metrics for dashboard
   * Scoped to current user's organization via RLS
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const client = getSupabaseClient(ctx);

    try {
      // Total users
      const { count: totalUsers, error: totalError } = await client
        .from("users")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        logger.error("Failed to get total users", totalError);
      }

      // Active users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: activeUsers, error: activeError } = await client
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("last_signed_in", thirtyDaysAgo.toISOString());

      if (activeError) {
        logger.error("Failed to get active users", activeError);
      }

      // Total certifications
      const { count: totalCertifications, error: certError } = await client
        .from("certifications")
        .select("*", { count: "exact", head: true });

      if (certError) {
        logger.error("Failed to get certifications", certError);
      }

      // Total quiz attempts
      const { count: totalQuizAttempts, error: quizError } = await client
        .from("quiz_results")
        .select("*", { count: "exact", head: true });

      if (quizError) {
        logger.error("Failed to get quiz attempts", quizError);
      }

      // Total simulation attempts
      const { count: totalSimulationAttempts, error: simError } = await client
        .from("simulation_attempts")
        .select("*", { count: "exact", head: true });

      if (simError) {
        logger.error("Failed to get simulation attempts", simError);
      }

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalCertifications: totalCertifications || 0,
        totalQuizAttempts: totalQuizAttempts || 0,
        totalSimulationAttempts: totalSimulationAttempts || 0,
      };
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      logger.error("Unexpected error in overview", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve overview statistics",
      });
    }
  }),
});
