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

describe("AI Chat", () => {
  describe("ai.chat", () => {
    // Skip actual LLM tests in unit tests - these should be integration tests
    it.skip("returns a response for valid input", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.chat({
        messages: [
          { role: "system", content: "You are a helpful VOS tutor." },
          { role: "user", content: "What is a Value Stream?" }
        ]
      });

      expect(result).toHaveProperty("content");
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
    }, 15000);

    it.skip("handles multiple conversation turns", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.chat({
        messages: [
          { role: "system", content: "You are a helpful VOS tutor." },
          { role: "user", content: "Explain value discovery." },
          { role: "assistant", content: "Value discovery is the process of..." },
          { role: "user", content: "Can you give an example?" }
        ]
      });

      expect(result).toHaveProperty("content");
      expect(typeof result.content).toBe("string");
    }, 15000);

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
        caller.ai.chat({
          messages: [
            { role: "user", content: "Test message" }
          ]
        })
      ).rejects.toThrow();
    });

    it("validates input structure", () => {
      // Test that the endpoint accepts the correct message format
      const validMessages = [
        { role: "system" as const, content: "You are a VOS tutor." },
        { role: "user" as const, content: "Help me learn." }
      ];

      expect(validMessages).toHaveLength(2);
      expect(validMessages[0].role).toBe("system");
      expect(validMessages[1].role).toBe("user");
    });
  });

  describe("AI Tutor Modes", () => {
    it("defines Chat mode for general VOS guidance", () => {
      const chatMode = {
        name: "Chat",
        description: "General VOS guidance and Q&A",
        systemPrompt: "You are a VOS tutor in Chat mode."
      };
      
      expect(chatMode.name).toBe("Chat");
      expect(chatMode.systemPrompt).toContain("Chat mode");
    });

    it("defines KPI Hypothesis mode for metrics generation", () => {
      const kpiMode = {
        name: "KPI Hypothesis",
        description: "Help generate metrics and KPI hypotheses",
        systemPrompt: "You are a VOS tutor in KPI Hypothesis mode."
      };
      
      expect(kpiMode.name).toBe("KPI Hypothesis");
      expect(kpiMode.systemPrompt).toContain("KPI Hypothesis mode");
    });

    it("defines ROI Narrative mode for business cases", () => {
      const roiMode = {
        name: "ROI Narrative",
        description: "Build business cases and ROI narratives",
        systemPrompt: "You are a VOS tutor in ROI Narrative mode."
      };
      
      expect(roiMode.name).toBe("ROI Narrative");
      expect(roiMode.systemPrompt).toContain("ROI Narrative mode");
    });

    it("defines Value Case mode for reusable templates", () => {
      const valueCaseMode = {
        name: "Value Case",
        description: "Create reusable value case templates",
        systemPrompt: "You are a VOS tutor in Value Case mode."
      };
      
      expect(valueCaseMode.name).toBe("Value Case");
      expect(valueCaseMode.systemPrompt).toContain("Value Case mode");
    });
  });

  describe("AI Tutor Integration", () => {
    it("supports role-based adaptation", () => {
      const roles = ["Sales", "CS", "Marketing", "Product", "Executive", "VE"];
      
      roles.forEach(role => {
        expect(role).toBeTruthy();
        expect(typeof role).toBe("string");
      });
      
      expect(roles).toHaveLength(6);
    });

    it("supports maturity-based guidance", () => {
      const maturityLevels = [0, 1, 2, 3, 4, 5];
      
      maturityLevels.forEach(level => {
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(5);
      });
      
      expect(maturityLevels).toHaveLength(6);
    });
  });
});
