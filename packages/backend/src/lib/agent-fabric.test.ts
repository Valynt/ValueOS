import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@valueos/agents/orchestration", () => ({
  ValueHypothesisSchema: z.object({
    id: z.string(),
    description: z.string(),
    confidence: z.number(),
    category: z.string(),
    estimatedValue: z.number(),
  }),
  LoopResultSchema: z.object({
    valueCaseId: z.string(),
    tenantId: z.string(),
    hypotheses: z.array(z.unknown()),
    valueTree: z.unknown().nullable(),
    evidenceBundle: z.unknown().nullable(),
    narrative: z.unknown().nullable(),
    objections: z.array(z.unknown()),
    revisionCount: z.number(),
    finalState: z.string(),
    success: z.boolean(),
  }),
}));

import { AgentFabric } from "./agent-fabric";

vi.mock("./supabase.js");

describe("AgentFabric", () => {
  it("throws when factoryDeps are not set", async () => {
    const fabric = new AgentFabric("url", "anon", "provider");

    await expect(fabric.processUserInput("hi", "org-1")).rejects.toThrow(
      /requires factoryDeps/,
    );
  });
});
