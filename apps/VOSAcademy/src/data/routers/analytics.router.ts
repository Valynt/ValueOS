import { and, avg, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { certifications, pillars, quizResults, simulationAttempts, users } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

/**
 * Analytics router
 * Provides dashboard statistics and insights
 * TODO: Add caching for expensive queries
 */
export const analyticsRouter = router({
  /**
   * Get user statistics
   * Includes total users, active users, new users, and average maturity
   */
  userStats: protectedProcedure
    .input(z.object({
      dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
      role: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get total users count
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult[0]?.count || 0;

      // Get active users (signed in within specified period)
      let activeUsers = 0;
      if (input.dateRange !== 'all') {
        const days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const activeUsersResult = await db
          .select({ count: count() })
          .from(users)
          .where(sql`${users.lastSignedIn} >= ${cutoffDate}`);
        activeUsers = activeUsersResult[0]?.count || 0;
      } else {
        activeUsers = totalUsers;
      }

      // Get new users this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const newUsersResult = await db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.createdAt} >= ${startOfMonth}`);
      const newUsersThisMonth = newUsersResult[0]?.count || 0;

      // Calculate average maturity level
      const maturityResult = await db
        .select({ avg: avg(users.maturityLevel) })
        .from(users);
      const averageMaturityLevel = Math.round(Number(maturityResult[0]?.avg) || 0);

      return {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        averageMaturityLevel,
      };
    }),

  /**
   * Get quiz statistics
   * Includes attempts, scores, pass rates, and pillar breakdown
   */
  quizStats: protectedProcedure
    .input(z.object({
      dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
      pillarId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Helper to get date cutoff
      const getCutoffDate = () => {
        if (input.dateRange === 'all') return null;
        const days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return cutoffDate;
      };

      const cutoffDate = getCutoffDate();

      // Get total quiz attempts
      const quizCountResult = cutoffDate
        ? await db.select({ count: count() }).from(quizResults).where(sql`${quizResults.completedAt} >= ${cutoffDate}`)
        : await db.select({ count: count() }).from(quizResults);
      const totalQuizzes = quizCountResult[0]?.count || 0;

      // Calculate average score
      const avgScoreResult = cutoffDate
        ? await db.select({ avg: avg(quizResults.score) }).from(quizResults).where(sql`${quizResults.completedAt} >= ${cutoffDate}`)
        : await db.select({ avg: avg(quizResults.score) }).from(quizResults);
      const averageScore = Math.round((avgScoreResult[0]?.avg as number) || 0);

      // Calculate pass rate
      const passedCountResult = cutoffDate
        ? await db.select({ count: count() }).from(quizResults).where(and(sql`${quizResults.completedAt} >= ${cutoffDate}`, eq(quizResults.passed, true)))
        : await db.select({ count: count() }).from(quizResults).where(eq(quizResults.passed, true));
      const passedCount = passedCountResult[0]?.count || 0;
      const passRate = totalQuizzes > 0 ? Math.round((passedCount / totalQuizzes) * 100) : 0;

      // Calculate completion rate
      const uniqueQuizUsersResult = await db.select({ count: count(sql`DISTINCT ${quizResults.userId}`) }).from(quizResults);
      const uniqueQuizUsers = uniqueQuizUsersResult[0]?.count || 0;
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult[0]?.count || 0;
      const completionRate = totalUsers > 0 ? Math.round((uniqueQuizUsers / totalUsers) * 100) : 0;

      // Get pillar breakdown
      const pillarBreakdown = await db
        .select({
          pillarId: quizResults.pillarId,
          attempts: count(),
          avgScore: avg(quizResults.score),
          passedCount: sql<number>`COUNT(CASE WHEN ${quizResults.passed} = 1 THEN 1 END)`,
        })
        .from(quizResults)
        .groupBy(quizResults.pillarId);

      const allPillars = await db.select().from(pillars);

      const pillarBreakdownFormatted = pillarBreakdown.map(pillar => {
        const pillarInfo = allPillars.find(p => p.id === pillar.pillarId);
        const avgScore = Math.round(Number(pillar.avgScore) || 0);
        const pillarPassRate = pillar.attempts > 0 ? Math.round((pillar.passedCount / pillar.attempts) * 100) : 0;

        return {
          pillarId: pillar.pillarId,
          pillarName: pillarInfo?.title || `Pillar ${pillar.pillarId}`,
          attempts: pillar.attempts,
          averageScore: avgScore,
          passRate: pillarPassRate,
        };
      });

      return {
        totalQuizzes,
        averageScore,
        passRate,
        completionRate,
        pillarBreakdown: pillarBreakdownFormatted,
      };
    }),

  /**
   * Get certification statistics
   * Includes total certifications and tier breakdown
   */
  certificationStats: protectedProcedure
    .input(z.object({
      dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get total certifications
      let totalCertifications = 0;
      if (input.dateRange !== 'all') {
        const days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const certCountResult = await db
          .select({ count: count() })
          .from(certifications)
          .where(sql`${certifications.awardedAt} >= ${cutoffDate}`);
        totalCertifications = certCountResult[0]?.count || 0;
      } else {
        const certCountResult = await db.select({ count: count() }).from(certifications);
        totalCertifications = certCountResult[0]?.count || 0;
      }

      // Get tier breakdown
      const tierBreakdown = await db
        .select({
          tier: certifications.tier,
          count: count(),
        })
        .from(certifications)
        .groupBy(certifications.tier);

      return {
        totalCertifications,
        tierBreakdown: tierBreakdown.map(t => ({
          tier: t.tier || 'bronze',
          count: t.count,
        })),
      };
    }),

  /**
   * Get simulation statistics
   * Includes attempts, scores, and completion rates
   */
  simulationStats: protectedProcedure
    .input(z.object({
      dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get total simulation attempts
      let totalAttempts = 0;
      if (input.dateRange !== 'all') {
        const days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const attemptCountResult = await db
          .select({ count: count() })
          .from(simulationAttempts)
          .where(sql`${simulationAttempts.completedAt} >= ${cutoffDate}`);
        totalAttempts = attemptCountResult[0]?.count || 0;
      } else {
        const attemptCountResult = await db.select({ count: count() }).from(simulationAttempts);
        totalAttempts = attemptCountResult[0]?.count || 0;
      }

      // Calculate average score
      const avgScoreResult = await db
        .select({ avg: avg(simulationAttempts.overallScore) })
        .from(simulationAttempts);
      const averageScore = Math.round((avgScoreResult[0]?.avg as number) || 0);

      // Calculate pass rate
      const passedCountResult = await db
        .select({ count: count() })
        .from(simulationAttempts)
        .where(eq(simulationAttempts.passed, true));
      const passedCount = passedCountResult[0]?.count || 0;
      const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;

      return {
        totalAttempts,
        averageScore,
        passRate,
      };
    }),
});
