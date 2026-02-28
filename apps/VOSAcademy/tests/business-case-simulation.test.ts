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

describe("Business Case Development Simulation", () => {
  let businessCaseScenarioId: number;

  beforeAll(async () => {
    // Find the Business Case simulation scenario
    const scenarios = await db.getAllSimulationScenarios();
    const businessCaseScenario = scenarios.find(s => s.type === 'business_case');
    
    if (businessCaseScenario) {
      businessCaseScenarioId = businessCaseScenario.id;
    }
  });

  describe("simulations.evaluateResponse", () => {
    it("evaluates Business Case Step 1 (Revenue Impact) response", async () => {
      if (!businessCaseScenarioId) {
        console.log('Skipping test: Business Case scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
Revenue Impact Analysis:

I've identified customer retention as the primary revenue-protection KPI. MegaCorp's current security incident rate (45/quarter) likely contributes to customer churn, especially among enterprise clients who prioritize security.

Quantification:
- Assume 5% of customer base ($2.8B revenue) is at risk due to security concerns
- Revenue at risk: $140M annually
- If CloudSecure prevents even 10% of this churn, that's $14M in protected revenue
- Timeframe: Benefits begin in Q2 after implementation, full impact by Year 2

Additionally, improved security posture could enable MegaCorp to pursue high-value enterprise clients in regulated industries (healthcare, government) currently off-limits. This represents a potential $50M+ market expansion opportunity over 3 years.
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: businessCaseScenarioId,
        stepNumber: 1,
        userResponse,
      });

      // Verify response structure
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('categoryBreakdown');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('improvements');
      expect(result).toHaveProperty('feedback');

      // Verify score is reasonable
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Verify category breakdown
      expect(result.categoryBreakdown).toHaveProperty('technical');
      expect(result.categoryBreakdown).toHaveProperty('crossFunctional');
      expect(result.categoryBreakdown).toHaveProperty('aiAugmentation');

      // Verify arrays
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.improvements)).toBe(true);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.improvements.length).toBeGreaterThan(0);

      // Verify feedback is substantive
      expect(typeof result.feedback).toBe('string');
      expect(result.feedback.length).toBeGreaterThan(50);

      console.log('Business Case Step 1 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
        strengthsCount: result.strengths.length,
        improvementsCount: result.improvements.length,
      });
    }, 30000); // 30 second timeout for AI call

    it("evaluates Business Case Step 2 (Cost Reduction) response", async () => {
      if (!businessCaseScenarioId) {
        console.log('Skipping test: Business Case scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
Cost Reduction Analysis:

1. Security Incident Reduction:
   - Current cost: $5.6M annually (180 incidents × $125K)
   - Target reduction: 65% (industry benchmark)
   - Annual savings: $3.64M
   - 3-year cumulative: $10.92M

2. Compliance Efficiency Gains:
   - Current: 8 FTEs × 60% utilization = 4.8 FTE on manual work
   - Loaded cost: $120K per FTE = $576K annually
   - Expected automation: 70% of manual work
   - FTE redeployment value: $403K annually
   - 3-year cumulative: $1.21M

3. Insurance Premium Reduction:
   - Current premium: $2.4M annually
   - Expected reduction with improved security: 15-20%
   - Conservative estimate: 15% = $360K annually
   - 3-year cumulative: $1.08M

Total 3-Year Cost Savings: $13.21M
Less: Solution cost ($480K + $420K + $420K = $1.32M)
Net 3-Year Benefit: $11.89M

Assumptions:
- 65% incident reduction achievable by Year 2
- Compliance automation reaches 70% by end of Year 1
- Insurance premium reduction negotiated at Year 1 renewal
- All costs in current dollars (no inflation adjustment)
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: businessCaseScenarioId,
        stepNumber: 2,
        userResponse,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.categoryBreakdown.technical).toBeGreaterThan(0);
      expect(result.categoryBreakdown.crossFunctional).toBeGreaterThan(0);
      expect(result.categoryBreakdown.aiAugmentation).toBeGreaterThan(0);

      console.log('Business Case Step 2 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
      });
    }, 30000);

    it("evaluates Business Case Step 3 (Risk Mitigation) response", async () => {
      if (!businessCaseScenarioId) {
        console.log('Skipping test: Business Case scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
Risk Mitigation Value:

1. Regulatory Fine Avoidance:
   - Average data breach fine (financial services): $4.5M
   - Probability without controls: 15% annually
   - Expected value: $675K per year
   - 3-year expected value: $2.03M

2. Brand Protection:
   - Public breach impact: 2-5% revenue decline
   - Conservative estimate: 2% of $2.8B = $56M
   - Probability of major public breach: 10% annually
   - Expected value: $5.6M per year
   - 3-year expected value: $16.8M

3. Business Continuity:
   - Average downtime per major incident: 72 hours
   - Revenue impact: $2.8B / 365 days / 24 hours × 72 = $26.5M
   - Probability reduction: 65%
   - Expected value: $17.2M over 3 years

Total Risk Mitigation Value (3-year): $35.03M

Note: These are expected values (probability × impact). Actual realization depends on incidents that may or may not occur. However, the insurance-like value of risk reduction is real and should be factored into CFO decision-making.
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: businessCaseScenarioId,
        stepNumber: 3,
        userResponse,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.improvements)).toBe(true);

      console.log('Business Case Step 3 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
      });
    }, 30000);

    it("requires authentication for evaluation", async () => {
      if (!businessCaseScenarioId) {
        console.log('Skipping test: Business Case scenario not found in database');
        return;
      }

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
        caller.simulations.evaluateResponse({
          scenarioId: businessCaseScenarioId,
          stepNumber: 1,
          userResponse: "Test response",
        })
      ).rejects.toThrow();
    });

    it("handles invalid scenario ID gracefully", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.simulations.evaluateResponse({
          scenarioId: 99999,
          stepNumber: 1,
          userResponse: "Test response",
        })
      ).rejects.toThrow();
    });
  });

  describe("Business Case scenario data structure", () => {
    it("has correct scenario structure", async () => {
      if (!businessCaseScenarioId) {
        console.log('Skipping test: Business Case scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const scenario = await caller.simulations.getById({ id: businessCaseScenarioId });

      expect(scenario).toBeDefined();
      expect(scenario?.type).toBe('business_case');
      expect(scenario?.title).toContain('Business Case');
      expect(scenario?.difficulty).toBe('advanced');
      expect(scenario?.pillarId).toBe(4); // Pillar 4: Business Case Development

      // Verify scenario data structure
      expect(scenario?.scenarioData).toHaveProperty('context');
      expect(scenario?.scenarioData).toHaveProperty('customerProfile');
      expect(scenario?.scenarioData).toHaveProperty('objectives');
      expect(scenario?.scenarioData).toHaveProperty('steps');

      // Verify 5 steps
      expect(Array.isArray(scenario?.scenarioData?.steps)).toBe(true);
      expect(scenario?.scenarioData?.steps?.length).toBe(5);

      // Verify step structure
      const steps = scenario?.scenarioData?.steps || [];
      steps.forEach((step: any, index: number) => {
        expect(step).toHaveProperty('stepNumber');
        expect(step.stepNumber).toBe(index + 1);
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('instruction');
        expect(step).toHaveProperty('promptType');
        expect(step).toHaveProperty('expectedElements');
        expect(Array.isArray(step.expectedElements)).toBe(true);
      });

      console.log('Business Case Scenario Structure:', {
        id: scenario?.id,
        type: scenario?.type,
        difficulty: scenario?.difficulty,
        stepsCount: steps.length,
        stepTitles: steps.map((s: any) => s.title),
      });
    });
  });
});
