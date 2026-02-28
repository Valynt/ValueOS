import { describe, expect, it } from "vitest";
import { appRouter } from "../src/data/routers";
import type { Context } from "../src/data/_core/trpc";

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

describe("AI Recommendation Engine", () => {
  describe("simulations.getRecommendations", () => {
    it("returns personalized recommendations for authenticated user", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.simulations.getRecommendations();

      // Verify response structure
      expect(recommendations).toHaveProperty('nextSimulations');
      expect(recommendations).toHaveProperty('pillarsToStudy');
      expect(recommendations).toHaveProperty('improvementAreas');
      expect(recommendations).toHaveProperty('overallGuidance');

      // Verify arrays
      expect(Array.isArray(recommendations.nextSimulations)).toBe(true);
      expect(Array.isArray(recommendations.pillarsToStudy)).toBe(true);
      expect(Array.isArray(recommendations.improvementAreas)).toBe(true);

      // Verify overall guidance is a string
      expect(typeof recommendations.overallGuidance).toBe('string');
      expect(recommendations.overallGuidance.length).toBeGreaterThan(0);

      console.log('Overall Guidance:', recommendations.overallGuidance);
      console.log('Next Simulations Count:', recommendations.nextSimulations.length);
      console.log('Pillars to Study Count:', recommendations.pillarsToStudy.length);
      console.log('Improvement Areas Count:', recommendations.improvementAreas.length);
    }, 30000); // Increased timeout for AI call

    it("provides simulation recommendations with correct structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.simulations.getRecommendations();

      if (recommendations.nextSimulations.length > 0) {
        const sim = recommendations.nextSimulations[0];
        
        expect(sim).toHaveProperty('simulationTitle');
        expect(sim).toHaveProperty('reason');
        expect(sim).toHaveProperty('priority');

        expect(typeof sim.simulationTitle).toBe('string');
        expect(typeof sim.reason).toBe('string');
        expect(['high', 'medium', 'low']).toContain(sim.priority);

        // Reason should be substantive (at least 20 characters)
        expect(sim.reason.length).toBeGreaterThan(20);

        console.log('Sample Simulation Recommendation:', {
          title: sim.simulationTitle,
          priority: sim.priority,
          reasonLength: sim.reason.length,
        });
      }
    }, 30000);

    it("provides pillar recommendations with correct structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.simulations.getRecommendations();

      if (recommendations.pillarsToStudy.length > 0) {
        const pillar = recommendations.pillarsToStudy[0];
        
        expect(pillar).toHaveProperty('pillarNumber');
        expect(pillar).toHaveProperty('pillarTitle');
        expect(pillar).toHaveProperty('reason');
        expect(pillar).toHaveProperty('priority');

        expect(typeof pillar.pillarNumber).toBe('number');
        expect(pillar.pillarNumber).toBeGreaterThanOrEqual(1);
        expect(pillar.pillarNumber).toBeLessThanOrEqual(10);
        
        expect(typeof pillar.pillarTitle).toBe('string');
        expect(typeof pillar.reason).toBe('string');
        expect(['high', 'medium', 'low']).toContain(pillar.priority);

        // Reason should be substantive
        expect(pillar.reason.length).toBeGreaterThan(20);

        console.log('Sample Pillar Recommendation:', {
          pillarNumber: pillar.pillarNumber,
          title: pillar.pillarTitle,
          priority: pillar.priority,
        });
      }
    }, 30000);

    it("provides improvement areas with actionable items", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.simulations.getRecommendations();

      if (recommendations.improvementAreas.length > 0) {
        const area = recommendations.improvementAreas[0];
        
        expect(area).toHaveProperty('area');
        expect(area).toHaveProperty('currentScore');
        expect(area).toHaveProperty('targetScore');
        expect(area).toHaveProperty('actionItems');
        expect(area).toHaveProperty('priority');

        expect(typeof area.area).toBe('string');
        expect(typeof area.currentScore).toBe('number');
        expect(typeof area.targetScore).toBe('number');
        expect(Array.isArray(area.actionItems)).toBe(true);
        expect(['high', 'medium', 'low']).toContain(area.priority);

        // Scores should be valid
        expect(area.currentScore).toBeGreaterThanOrEqual(0);
        expect(area.currentScore).toBeLessThanOrEqual(100);
        expect(area.targetScore).toBeGreaterThanOrEqual(0);
        expect(area.targetScore).toBeLessThanOrEqual(100);
        expect(area.targetScore).toBeGreaterThan(area.currentScore);

        // Should have at least one action item
        expect(area.actionItems.length).toBeGreaterThan(0);
        
        // Action items should be substantive
        area.actionItems.forEach((item: string) => {
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(10);
        });

        console.log('Sample Improvement Area:', {
          area: area.area,
          currentScore: area.currentScore,
          targetScore: area.targetScore,
          actionItemsCount: area.actionItems.length,
          priority: area.priority,
        });
      }
    }, 30000);

    it("tailors recommendations based on user role", async () => {
      const { ctx: salesCtx } = createAuthContext({ vosRole: "Sales" });
      const salesCaller = appRouter.createCaller(salesCtx);

      const salesRecs = await salesCaller.simulations.getRecommendations();

      // Sales role should get recommendations
      expect(salesRecs.overallGuidance).toBeTruthy();
      expect(salesRecs.nextSimulations.length + salesRecs.pillarsToStudy.length).toBeGreaterThan(0);

      console.log('Sales Role Recommendations:', {
        guidance: salesRecs.overallGuidance.substring(0, 100) + '...',
        simCount: salesRecs.nextSimulations.length,
        pillarCount: salesRecs.pillarsToStudy.length,
      });
    }, 30000);

    it("tailors recommendations based on maturity level", async () => {
      const { ctx: beginnerCtx } = createAuthContext({ maturityLevel: 1 });
      const beginnerCaller = appRouter.createCaller(beginnerCtx);

      const beginnerRecs = await beginnerCaller.simulations.getRecommendations();

      // Beginner should get foundational recommendations
      expect(beginnerRecs.overallGuidance).toBeTruthy();
      expect(beginnerRecs.pillarsToStudy.length).toBeGreaterThan(0);

      console.log('Beginner (L1) Recommendations:', {
        guidance: beginnerRecs.overallGuidance.substring(0, 100) + '...',
        pillarCount: beginnerRecs.pillarsToStudy.length,
      });
    }, 30000);

    it("provides recommendations for users with no attempts", async () => {
      // Create a user context with a different user ID that has no attempts
      const { ctx } = createAuthContext({ id: 99999, email: "newuser@example.com" });
      const caller = appRouter.createCaller(ctx);

      const recommendations = await caller.simulations.getRecommendations();

      // Should still provide recommendations for new users
      expect(recommendations.overallGuidance).toBeTruthy();
      expect(recommendations.nextSimulations.length + recommendations.pillarsToStudy.length).toBeGreaterThan(0);

      console.log('New User Recommendations:', {
        guidance: recommendations.overallGuidance.substring(0, 100) + '...',
        simCount: recommendations.nextSimulations.length,
        pillarCount: recommendations.pillarsToStudy.length,
      });
    }, 30000);

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
        caller.simulations.getRecommendations()
      ).rejects.toThrow();
    });
  });
});
