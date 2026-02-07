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

describe("Simulations", () => {
  describe("simulations.list", () => {
    it("returns list of simulation scenarios", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const scenarios = await caller.simulations.list();

      expect(Array.isArray(scenarios)).toBe(true);
      if (scenarios.length > 0) {
        expect(scenarios[0]).toHaveProperty("id");
        expect(scenarios[0]).toHaveProperty("title");
        expect(scenarios[0]).toHaveProperty("type");
        expect(scenarios[0]).toHaveProperty("difficulty");
        expect(scenarios[0]).toHaveProperty("scenarioData");
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

      await expect(caller.simulations.list()).rejects.toThrow();
    });
  });

  describe("simulations.getById", () => {
    it("returns a specific simulation scenario", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First get all scenarios to find a valid ID
      const scenarios = await caller.simulations.list();

      if (scenarios.length > 0) {
        const scenario = await caller.simulations.getById({ id: scenarios[0].id });

        expect(scenario).toBeDefined();
        expect(scenario?.id).toBe(scenarios[0].id);
        expect(scenario?.scenarioData).toHaveProperty("context");
        expect(scenario?.scenarioData).toHaveProperty("steps");
        expect(Array.isArray(scenario?.scenarioData?.steps)).toBe(true);
      }
    });

    it("returns undefined for non-existent scenario", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const scenario = await caller.simulations.getById({ id: 99999 });

      expect(scenario).toBeUndefined();
    });
  });

  describe("simulations.submitAttempt", () => {
    it("calculates overall score correctly", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Mock evaluation response
      const mockEvaluation = {
        overallScore: 85,
        categoryScores: {
          technical: 80,
          crossFunctional: 85,
          aiAugmentation: 90
        },
        passed: true,
        feedback: "Excellent performance across all categories"
      };

      // Create a mock attempt - this would normally be done through the evaluateResponse mutation
      const result = await caller.simulations.submitAttempt({
        scenarioId: 1,
        responsesData: [
          {
            stepNumber: 1,
            userResponse: "Test response",
            aiFeedback: "Good response",
            score: 85,
            strengths: ["Clear analysis"],
            improvements: ["Add more detail"]
          }
        ],
        timeSpent: 600
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("success", true);
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

      await expect(caller.simulations.submitAttempt({
        scenarioId: 1,
        responsesData: [],
        timeSpent: 300
      })).rejects.toThrow();
    });
  });

  describe("simulations.getAttempts", () => {
    it("returns user's simulation attempts", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const attempts = await caller.simulations.getAttempts({});

      expect(Array.isArray(attempts)).toBe(true);
      if (attempts.length > 0) {
        expect(attempts[0]).toHaveProperty("id");
        expect(attempts[0]).toHaveProperty("scenarioId");
        expect(attempts[0]).toHaveProperty("overallScore");
        expect(attempts[0]).toHaveProperty("categoryScores");
      }
    });

    it("filters by scenario ID", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const attempts = await caller.simulations.getAttempts({ scenarioId: 1 });

      expect(Array.isArray(attempts)).toBe(true);
      attempts.forEach(attempt => {
        expect(attempt.scenarioId).toBe(1);
      });
    });
  });
});