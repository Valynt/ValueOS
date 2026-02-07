import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../src/data/routers";
import type { Context } from "../src/data/_core/trpc";
import * as db from "../src/data/db";

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

describe("QBR Expansion Modeling Simulation", () => {
  let qbrScenarioId: number;

  beforeAll(async () => {
    // Find the QBR Expansion simulation scenario
    const scenarios = await db.getAllSimulationScenarios();
    const qbrScenario = scenarios.find(s => s.type === 'qbr_expansion');
    
    if (qbrScenario) {
      qbrScenarioId = qbrScenario.id;
    }
  });

  describe("simulations.evaluateResponse", () => {
    it("evaluates QBR Step 1 (Value Delivered vs. Committed) response", async () => {
      if (!qbrScenarioId) {
        console.log('Skipping test: QBR Expansion scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
Value Realization Analysis - DataFlow Analytics Q3 QBR

**Commitment vs. Actual Results:**

1. Campaign Analysis Time Reduction
   - Committed: 50% reduction (40hrs → 20hrs)
   - Actual: 55% reduction (40hrs → 18hrs)
   - Status: ✅ EXCEEDED by 5 percentage points

2. Campaign ROI Improvement
   - Committed: 15% improvement
   - Actual: 22% improvement (1.8 → 2.2 return per dollar)
   - Status: ✅ EXCEEDED by 7 percentage points

3. Campaign Volume Increase
   - Committed: 2x volume without headcount increase
   - Actual: 1.6x volume (24 → 38 campaigns/quarter)
   - Status: ⚠️ ON TRACK (80% of target, 9 months in)

**Total Quantified Value Delivered (9 months):**

Time Savings Value:
- 22 hours saved × 38 campaigns × 3 quarters = 2,508 hours
- At $95K loaded cost = $45.67/hour
- Total value: $114,545

Ad Spend Efficiency Gains:
- $360K annual savings × 0.75 (9 months) = $270,000

Campaign ROI Improvement:
- Baseline ad spend: $1.2M/quarter × 3 = $3.6M
- ROI improvement: 22% vs baseline 80% = additional $792K return
- Incremental value: $792K

**Total 9-Month Value: $1,176,545**

**ROI Calculation:**
- Investment: $180K × 0.75 = $135K (9 months)
- Return: $1,176,545
- ROI: 771%
- Payback: <2 months

**Gap Analysis:**
Campaign volume is at 80% of 2x target, which is appropriate for 9-month mark. The team is pacing well toward the 12-month goal. No mitigation needed—this is healthy adoption curve.

**Unexpected Win:**
30% ad spend reduction ($360K annually) was not in original business case but represents significant value that should be highlighted in QBR.
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: qbrScenarioId,
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

      console.log('QBR Step 1 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
        strengthsCount: result.strengths.length,
        improvementsCount: result.improvements.length,
      });
    }, 30000); // 30 second timeout for AI call

    it("evaluates QBR Step 2 (Compelling Value Narrative) response", async () => {
      if (!qbrScenarioId) {
        console.log('Skipping test: QBR Expansion scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
**The DataFlow Analytics Success Story**

Nine months ago, DataFlow Analytics faced a critical challenge: their marketing operations team was drowning in manual campaign analysis. Each campaign required 40 hours of data crunching, limiting them to just 24 campaigns per quarter. Meanwhile, their ad spend efficiency was mediocre, and they knew they were leaving money on the table.

"We were stuck in a vicious cycle," says Jennifer Wu, VP of Marketing Operations. "Our team was so busy analyzing past campaigns that we couldn't launch new ones. We knew we needed to break through, but adding headcount wasn't an option."

**Three Game-Changing Wins:**

1. **Time Reclaimed:** Campaign analysis time dropped from 40 hours to just 18 hours—a 55% improvement that exceeded our 50% target. That's 2,508 hours reclaimed over nine months, allowing the team to focus on strategy instead of spreadsheets.

2. **ROI Breakthrough:** Campaign performance improved by 22%, crushing the 15% target. Every dollar DataFlow invests in advertising now returns $2.20 instead of $1.80—that's nearly $800K in incremental returns over nine months.

3. **The Unexpected Win:** The team discovered they were wasting $360K annually on inefficient ad spend. By identifying and eliminating this waste, DataFlow essentially paid for the platform twice over—and that benefit wasn't even in the original business case.

**The Bottom Line:**
In just nine months, DataFlow Analytics achieved a 771% ROI on their Marketing Analytics investment. They're now running 58% more campaigns with the same team size, and they're on track to hit their 2x volume target by year-end.

But here's what matters most to the CEO: DataFlow's marketing engine is no longer a bottleneck—it's a competitive advantage. And that's just the beginning of what's possible.
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: qbrScenarioId,
        stepNumber: 2,
        userResponse,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.categoryBreakdown.technical).toBeGreaterThan(0);
      expect(result.categoryBreakdown.crossFunctional).toBeGreaterThan(0);
      expect(result.categoryBreakdown.aiAugmentation).toBeGreaterThan(0);

      console.log('QBR Step 2 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
      });
    }, 30000);

    it("evaluates QBR Step 3 (Expansion Opportunity Analysis) response", async () => {
      if (!qbrScenarioId) {
        console.log('Skipping test: QBR Expansion scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const userResponse = `
**Expansion Opportunity Analysis**

**Option 1: Sales Analytics Module ($240K annually)**
- Addresses: "Need visibility into sales funnel performance"
- Strategic fit: Natural extension from marketing to sales
- Proof point leverage: Strong—same analytical approach that worked for marketing
- Organizational readiness: HIGH—Jennifer's team has proven they can drive adoption
- Timing: Ready now—team is confident and executives are asking for it

**Option 2: Customer Journey Analytics ($320K annually)**
- Addresses: "Customer churn analysis currently manual"
- Strategic fit: Valuable but requires cross-functional coordination
- Proof point leverage: Moderate—different use case than marketing campaigns
- Organizational readiness: MEDIUM—requires buy-in from Customer Success team
- Timing: Better as second expansion after Sales Analytics

**Option 3: Executive Dashboard ($80K annually)**
- Addresses: "Executive team wants unified metrics dashboard"
- Strategic fit: Visualization layer for existing data
- Proof point leverage: Weak—doesn't deliver new analytical capability
- Organizational readiness: HIGH—executives are asking for it
- Timing: Could be bundled with Sales Analytics as a package deal

**RECOMMENDATION: Sales Analytics Module (#1 Priority)**

**Rationale:**

1. **Urgency & Demand:** DataFlow's executive team is actively asking for sales funnel visibility. This is a pull opportunity, not a push.

2. **Proven Success Pattern:** The Marketing Analytics success provides a perfect proof point. Same analytical framework, same team driving adoption, predictable value delivery.

3. **Natural Progression:** Marketing and Sales alignment is a top priority for B2B SaaS companies. Connecting marketing campaign performance to sales outcomes is the logical next step.

4. **Organizational Readiness:** Jennifer's team has proven they can drive platform adoption and extract value. They're confident and ready to expand scope.

5. **Executive Visibility:** Sales funnel analytics will give executives the unified view they want, potentially reducing the need for a separate dashboard purchase.

**Why Not the Others (Yet):**

- Customer Journey Analytics requires Customer Success team buy-in and cross-functional coordination. Better as a second expansion once Sales Analytics is proven.
- Executive Dashboard is a "nice to have" visualization layer, not a value driver. It could be bundled with Sales Analytics as a package deal, but shouldn't be the primary focus.

**Next Step:** Present Sales Analytics business case in this QBR with option to bundle Executive Dashboard at a discount.
      `.trim();

      const result = await caller.simulations.evaluateResponse({
        scenarioId: qbrScenarioId,
        stepNumber: 3,
        userResponse,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.improvements)).toBe(true);

      console.log('QBR Step 3 Evaluation Result:', {
        score: result.score,
        categoryBreakdown: result.categoryBreakdown,
      });
    }, 30000);

    it("requires authentication for evaluation", async () => {
      if (!qbrScenarioId) {
        console.log('Skipping test: QBR Expansion scenario not found in database');
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
          scenarioId: qbrScenarioId,
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

  describe("QBR scenario data structure", () => {
    it("has correct scenario structure", async () => {
      if (!qbrScenarioId) {
        console.log('Skipping test: QBR Expansion scenario not found in database');
        return;
      }

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const scenario = await caller.simulations.getById({ id: qbrScenarioId });

      expect(scenario).toBeDefined();
      expect(scenario?.type).toBe('qbr_expansion');
      expect(scenario?.title).toContain('QBR');
      expect(scenario?.difficulty).toBe('advanced');
      expect(scenario?.pillarId).toBe(8); // Pillar 8: Lifecycle Value Management & QBRs

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

      console.log('QBR Expansion Scenario Structure:', {
        id: scenario?.id,
        type: scenario?.type,
        difficulty: scenario?.difficulty,
        stepsCount: steps.length,
        stepTitles: steps.map((s: any) => s.title),
      });
    });
  });
});
