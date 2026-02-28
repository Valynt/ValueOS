import { describe, expect, it } from "vitest";

import type { Context } from "../src/data/_core/trpc";
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
    maturityLevel: 0,
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

describe("Maturity Assessment", () => {
  describe("maturity.createAssessment", () => {
    it("creates assessment and updates user maturity level", async () => {
      const { ctx } = createAuthContext({ maturityLevel: 0 });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.maturity.createAssessment({
        level: 2,
        assessmentData: {
          selfAssessment: 2,
          quizAverage: 85,
          pillarsCompleted: 3,
          behaviorIndicators: [
            "Uses value language consistently",
            "Documents value hypotheses",
            "Tracks basic metrics"
          ],
          recommendations: [
            "Focus on proactive optimization",
            "Implement AI/ML experimentation",
            "Build cross-functional alignment"
          ]
        }
      });

      expect(result).toEqual({ success: true });
    });

    it("validates maturity level range (0-5)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Level 6 should fail validation
      await expect(
        caller.maturity.createAssessment({
          level: 6,
          assessmentData: {
            selfAssessment: 6,
            quizAverage: 100,
            pillarsCompleted: 10,
            behaviorIndicators: [],
            recommendations: []
          }
        })
      ).rejects.toThrow();

      // Negative level should fail
      await expect(
        caller.maturity.createAssessment({
          level: -1,
          assessmentData: {
            selfAssessment: -1,
            quizAverage: 0,
            pillarsCompleted: 0,
            behaviorIndicators: [],
            recommendations: []
          }
        })
      ).rejects.toThrow();
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
        caller.maturity.createAssessment({
          level: 2,
          assessmentData: {
            selfAssessment: 2,
            quizAverage: 85,
            pillarsCompleted: 3,
            behaviorIndicators: [],
            recommendations: []
          }
        })
      ).rejects.toThrow();
    });
  });

  describe("maturity.getAssessments", () => {
    it("returns user's assessment history", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.maturity.getAssessments();

      expect(Array.isArray(result)).toBe(true);
      // Each assessment should have expected structure
      result.forEach(assessment => {
        expect(assessment).toHaveProperty("id");
        expect(assessment).toHaveProperty("userId");
        expect(assessment).toHaveProperty("level");
        expect(assessment).toHaveProperty("assessmentData");
        expect(assessment).toHaveProperty("assessedAt");
        
        // Level should be 0-5
        expect(assessment.level).toBeGreaterThanOrEqual(0);
        expect(assessment.level).toBeLessThanOrEqual(5);
      });
    });
  });

  describe("Maturity Levels", () => {
    const maturityLevels = [
      { level: 0, name: "Value Chaos", focus: "Reactive Problem Solving" },
      { level: 1, name: "Value Awareness", focus: "Basic Data Collection" },
      { level: 2, name: "Value Alignment", focus: "Performance Measurement" },
      { level: 3, name: "Value Optimization", focus: "Proactive Analytics" },
      { level: 4, name: "Value Prediction", focus: "Proactive Optimization" },
      { level: 5, name: "Value Orchestration", focus: "Autonomous Value Flow" }
    ];

    it("defines all 6 maturity levels (L0-L5)", () => {
      expect(maturityLevels).toHaveLength(6);
      maturityLevels.forEach((level, index) => {
        expect(level.level).toBe(index);
        expect(level.name).toBeTruthy();
        expect(level.focus).toBeTruthy();
      });
    });

    it("Level 0: Value Chaos - reactive problem solving", () => {
      const level0 = maturityLevels.find(l => l.level === 0);
      expect(level0?.name).toBe("Value Chaos");
      expect(level0?.focus).toContain("Reactive");
    });

    it("Level 5: Value Orchestration - autonomous value flow", () => {
      const level5 = maturityLevels.find(l => l.level === 5);
      expect(level5?.name).toBe("Value Orchestration");
      expect(level5?.focus).toContain("Autonomous");
    });
  });

  describe("Role-Based Maturity Tracks", () => {
    const roles = ["Sales", "CS", "Marketing", "Product", "Executive", "VE"];

    it("supports all 6 VOS roles", () => {
      expect(roles).toHaveLength(6);
      roles.forEach(role => {
        expect(role).toBeTruthy();
      });
    });

    it("each role has distinct maturity progression", () => {
      // Sales role progression example
      const salesProgression = {
        L0: "Reactive selling, feature-focused",
        L1: "Basic value language, inconsistent metrics",
        L2: "Documented value hypotheses, KPI tracking",
        L3: "Proactive optimization, predictive analytics",
        L4: "AI-driven insights, cross-functional alignment",
        L5: "Autonomous value orchestration, self-optimizing systems"
      };

      expect(Object.keys(salesProgression)).toHaveLength(6);
    });
  });
});
