import { beforeAll, describe, expect, it } from "vitest";

import type { Context } from "../src/data/_core/trpc";
import * as db from "../src/data/db";
import { appRouter } from "../src/data/routers";

type AuthenticatedUser = NonNullable<Context["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: Context } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    vosRole: "Sales",
    maturityLevel: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: Context = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as Context["req"],
    res: {} as Context["res"],
  };

  return { ctx };
}

describe("Simulation Analytics", () => {
  describe("simulations.getAnalytics", () => {
    it("returns analytics data structure for authenticated user", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      // Verify response structure
      expect(analytics).toHaveProperty('overview');
      expect(analytics).toHaveProperty('categoryAverages');
      expect(analytics).toHaveProperty('scenarioStats');
      expect(analytics).toHaveProperty('scoreTrend');
      expect(analytics).toHaveProperty('recentAttempts');

      // Verify overview structure
      expect(analytics.overview).toHaveProperty('totalAttempts');
      expect(analytics.overview).toHaveProperty('avgScore');
      expect(analytics.overview).toHaveProperty('bestScore');
      expect(analytics.overview).toHaveProperty('completionRate');

      // Verify category averages structure
      expect(analytics.categoryAverages).toHaveProperty('technical');
      expect(analytics.categoryAverages).toHaveProperty('crossFunctional');
      expect(analytics.categoryAverages).toHaveProperty('aiAugmentation');

      // Verify data types
      expect(typeof analytics.overview.totalAttempts).toBe('number');
      expect(typeof analytics.overview.avgScore).toBe('number');
      expect(typeof analytics.overview.bestScore).toBe('number');
      expect(typeof analytics.overview.completionRate).toBe('number');

      expect(Array.isArray(analytics.scenarioStats)).toBe(true);
      expect(Array.isArray(analytics.scoreTrend)).toBe(true);
      expect(Array.isArray(analytics.recentAttempts)).toBe(true);

      console.log('Analytics Overview:', {
        totalAttempts: analytics.overview.totalAttempts,
        avgScore: analytics.overview.avgScore,
        bestScore: analytics.overview.bestScore,
        completionRate: analytics.overview.completionRate,
        scenarioCount: analytics.scenarioStats.length,
        trendDataPoints: analytics.scoreTrend.length,
        recentAttemptsCount: analytics.recentAttempts.length,
      });
    });

    it("returns zero values for user with no attempts", async () => {
      // Create a user context with a different user ID that has no attempts
      const { ctx } = createAuthContext({ id: 99999, email: "newuser@example.com" });
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      expect(analytics.overview.totalAttempts).toBe(0);
      expect(analytics.overview.avgScore).toBe(0);
      expect(analytics.overview.bestScore).toBe(0);
      expect(analytics.overview.completionRate).toBe(0);

      expect(analytics.categoryAverages.technical).toBe(0);
      expect(analytics.categoryAverages.crossFunctional).toBe(0);
      expect(analytics.categoryAverages.aiAugmentation).toBe(0);

      expect(analytics.scenarioStats.length).toBe(0);
      expect(analytics.scoreTrend.length).toBe(0);
      expect(analytics.recentAttempts.length).toBe(0);
    });

    it("calculates correct averages for multiple attempts", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      // If user has attempts, verify calculations
      if (analytics.overview.totalAttempts > 0) {
        // Average score should be between 0 and 100
        expect(analytics.overview.avgScore).toBeGreaterThanOrEqual(0);
        expect(analytics.overview.avgScore).toBeLessThanOrEqual(100);

        // Best score should be >= average score
        expect(analytics.overview.bestScore).toBeGreaterThanOrEqual(analytics.overview.avgScore);

        // Completion rate should be between 0 and 100
        expect(analytics.overview.completionRate).toBeGreaterThanOrEqual(0);
        expect(analytics.overview.completionRate).toBeLessThanOrEqual(100);

        // Category scores should be between 0 and 100
        expect(analytics.categoryAverages.technical).toBeGreaterThanOrEqual(0);
        expect(analytics.categoryAverages.technical).toBeLessThanOrEqual(100);
        expect(analytics.categoryAverages.crossFunctional).toBeGreaterThanOrEqual(0);
        expect(analytics.categoryAverages.crossFunctional).toBeLessThanOrEqual(100);
        expect(analytics.categoryAverages.aiAugmentation).toBeGreaterThanOrEqual(0);
        expect(analytics.categoryAverages.aiAugmentation).toBeLessThanOrEqual(100);
      }
    });

    it("returns correct scenario statistics structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      // Verify scenario stats structure if any exist
      if (analytics.scenarioStats.length > 0) {
        const stat = analytics.scenarioStats[0];
        
        expect(stat).toHaveProperty('scenarioId');
        expect(stat).toHaveProperty('scenarioTitle');
        expect(stat).toHaveProperty('scenarioType');
        expect(stat).toHaveProperty('attemptCount');
        expect(stat).toHaveProperty('avgScore');
        expect(stat).toHaveProperty('bestScore');
        expect(stat).toHaveProperty('lastAttempt');

        expect(typeof stat.scenarioId).toBe('number');
        expect(typeof stat.scenarioTitle).toBe('string');
        expect(typeof stat.scenarioType).toBe('string');
        expect(typeof stat.attemptCount).toBe('number');
        expect(typeof stat.avgScore).toBe('number');
        expect(typeof stat.bestScore).toBe('number');

        // Attempt count should be positive
        expect(stat.attemptCount).toBeGreaterThan(0);

        // Best score should be >= average score
        expect(stat.bestScore).toBeGreaterThanOrEqual(stat.avgScore);

        console.log('Sample Scenario Stat:', stat);
      }
    });

    it("returns correct score trend structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      // Verify score trend structure if any exist
      if (analytics.scoreTrend.length > 0) {
        const trendPoint = analytics.scoreTrend[0];
        
        expect(trendPoint).toHaveProperty('attemptId');
        expect(trendPoint).toHaveProperty('scenarioTitle');
        expect(trendPoint).toHaveProperty('score');
        expect(trendPoint).toHaveProperty('completedAt');
        expect(trendPoint).toHaveProperty('passed');

        expect(typeof trendPoint.attemptId).toBe('number');
        expect(typeof trendPoint.scenarioTitle).toBe('string');
        expect(typeof trendPoint.score).toBe('number');
        expect(typeof trendPoint.passed).toBe('boolean');

        // Score should be between 0 and 100
        expect(trendPoint.score).toBeGreaterThanOrEqual(0);
        expect(trendPoint.score).toBeLessThanOrEqual(100);

        // Score trend should have max 10 items
        expect(analytics.scoreTrend.length).toBeLessThanOrEqual(10);

        console.log('Sample Score Trend Point:', trendPoint);
      }
    });

    it("returns correct recent attempts structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const analytics = await caller.simulations.getAnalytics();

      // Verify recent attempts structure if any exist
      if (analytics.recentAttempts.length > 0) {
        const attempt = analytics.recentAttempts[0];
        
        expect(attempt).toHaveProperty('id');
        expect(attempt).toHaveProperty('scenarioTitle');
        expect(attempt).toHaveProperty('scenarioType');
        expect(attempt).toHaveProperty('attemptNumber');
        expect(attempt).toHaveProperty('overallScore');
        expect(attempt).toHaveProperty('categoryScores');
        expect(attempt).toHaveProperty('passed');
        expect(attempt).toHaveProperty('timeSpent');
        expect(attempt).toHaveProperty('completedAt');

        expect(typeof attempt.id).toBe('number');
        expect(typeof attempt.scenarioTitle).toBe('string');
        expect(typeof attempt.scenarioType).toBe('string');
        expect(typeof attempt.attemptNumber).toBe('number');
        expect(typeof attempt.overallScore).toBe('number');
        expect(typeof attempt.passed).toBe('boolean');

        // Recent attempts should have max 5 items
        expect(analytics.recentAttempts.length).toBeLessThanOrEqual(5);

        console.log('Sample Recent Attempt:', attempt);
      }
    });

    it("requires authentication", async () => {
      const ctx: Context = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as Context["req"],
        res: {} as Context["res"],
      };
      
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.simulations.getAnalytics()
      ).rejects.toThrow();
    });
  });
});
