/**
 * Analytics Router
 * Provides dashboard statistics and insights with tenant isolation
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRequestSupabaseClient, type RequestScopedRlsSupabaseClient } from "@shared/lib/supabase";
import { logger } from "../../../lib/logger.js";
import { protectedProcedure, router } from "../trpc.js";

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
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        // Get total quiz attempts
        let quizCountQuery = client.from("quiz_results").select("*", { count: "exact", head: true });

        if (cutoffDate) {
          quizCountQuery = quizCountQuery.gte("completed_at", cutoffDate.toISOString());
        }

        const { count: totalQuizzes, error: quizCountError } = await quizCountQuery;

        if (quizCountError) {
          logger.error("Failed to get quiz stats", quizCountError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get quiz statistics",
          });
        }

        // Get passed count for pass rate calculation
        let passedCountQuery = client
          .from("quiz_results")
          .select("*", { count: "exact", head: true })
          .eq("passed", true);

        if (cutoffDate) {
          passedCountQuery = passedCountQuery.gte("completed_at", cutoffDate.toISOString());
        }

        const { count: passedCount, error: passedError } = await passedCountQuery;

        if (passedError) {
          logger.error("Failed to get passed quiz count", passedError);
        }

        const passRate = totalQuizzes && totalQuizzes > 0 ? Math.round(((passedCount || 0) / totalQuizzes) * 100) : 0;

        // Get average score
        const { data: scoresData, error: scoresError } = await client.from("quiz_results").select("score");

        let averageScore = 0;
        if (!scoresError && scoresData && scoresData.length > 0) {
          averageScore = Math.round(scoresData.reduce((sum, r) => sum + r.score, 0) / scoresData.length);
        }

        // Calculate completion rate (unique users with quiz results / total users)
        const { data: quizUsers, error: quizUsersError } = await client.from("quiz_results").select("user_id");

        if (quizUsersError) {
          logger.error("Failed to get quiz users", quizUsersError);
        }

        const uniqueQuizUsers = new Set(quizUsers?.map((r) => r.user_id)).size;

        const { count: totalUsers, error: totalUsersError } = await client
          .from("users")
          .select("*", { count: "exact", head: true });

        if (totalUsersError) {
          logger.error("Failed to get total users", totalUsersError);
        }

        const completionRate = totalUsers && totalUsers > 0 ? Math.round((uniqueQuizUsers / totalUsers) * 100) : 0;

        // Get pillar breakdown
        const { data: pillarResults, error: pillarError } = await client
          .from("quiz_results")
          .select("pillar_id, score, passed");

        const pillarBreakdown: Array<{
          pillarId: number;
          pillarName: string;
          attempts: number;
          averageScore: number;
          passRate: number;
        }> = [];

        if (!pillarError && pillarResults) {
          const pillarStats = new Map<
            number,
            { attempts: number; totalScore: number; passedCount: number }
          >();

          for (const result of pillarResults) {
            const stats = pillarStats.get(result.pillar_id) || { attempts: 0, totalScore: 0, passedCount: 0 };
            stats.attempts++;
            stats.totalScore += result.score;
            if (result.passed) stats.passedCount++;
            pillarStats.set(result.pillar_id, stats);
          }

          // Get pillar names
          const { data: pillars, error: pillarsError } = await client.from("pillars").select("id, title");

          if (pillarsError) {
            logger.error("Failed to get pillars", pillarsError);
          }

          const pillarMap = new Map(pillars?.map((p) => [p.id, p.title]) ?? []);

          for (const [pillarId, stats] of pillarStats) {
            pillarBreakdown.push({
              pillarId,
              pillarName: pillarMap.get(pillarId) || `Pillar ${pillarId}`,
              attempts: stats.attempts,
              averageScore: Math.round(stats.totalScore / stats.attempts),
              passRate: Math.round((stats.passedCount / stats.attempts) * 100),
            });
          }
        }

        return {
          totalQuizzes: totalQuizzes || 0,
          averageScore,
          passRate,
          completionRate,
          pillarBreakdown,
        };
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
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        // Get total certifications
        let certCountQuery = client.from("certifications").select("*", { count: "exact", head: true });

        if (cutoffDate) {
          certCountQuery = certCountQuery.gte("awarded_at", cutoffDate.toISOString());
        }

        const { count: totalCertifications, error } = await certCountQuery;

        if (error) {
          logger.error("Failed to get certification stats", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get certification statistics",
          });
        }

        // Get tier breakdown
        const { data: tierData, error: tierError } = await client.from("certifications").select("tier");

        const tierBreakdown: Array<{ tier: string; count: number }> = [];

        if (!tierError && tierData) {
          const tierCounts = new Map<string, number>();
          for (const cert of tierData) {
            const tier = cert.tier || "bronze";
            tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
          }
          for (const [tier, count] of tierCounts) {
            tierBreakdown.push({ tier, count });
          }
        }

        return {
          totalCertifications: totalCertifications || 0,
          tierBreakdown,
        };
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
      const cutoffDate = getDateRangeCutoff(input.dateRange);

      try {
        // Get total simulation attempts
        let attemptCountQuery = client.from("simulation_attempts").select("*", { count: "exact", head: true });

        if (cutoffDate) {
          attemptCountQuery = attemptCountQuery.gte("completed_at", cutoffDate.toISOString());
        }

        const { count: totalAttempts, error } = await attemptCountQuery;

        if (error) {
          logger.error("Failed to get simulation stats", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get simulation statistics",
          });
        }

        // Calculate average score
        const { data: scoresData, error: scoresError } = await client.from("simulation_attempts").select("overall_score");

        if (scoresError) {
          logger.error("Failed to get simulation scores", scoresError);
        }

        let averageScore = 0;
        if (scoresData && scoresData.length > 0) {
          averageScore = Math.round(
            scoresData.reduce((sum, a) => sum + a.overall_score, 0) / scoresData.length
          );
        }

        // Calculate pass rate
        const { count: passedCount, error: passedError } = await client
          .from("simulation_attempts")
          .select("*", { count: "exact", head: true })
          .eq("passed", true);

        if (passedError) {
          logger.error("Failed to get passed simulation count", passedError);
        }

        const passRate = totalAttempts && totalAttempts > 0 ? Math.round(((passedCount || 0) / totalAttempts) * 100) : 0;

        return {
          totalAttempts: totalAttempts || 0,
          averageScore,
          passRate,
        };
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
