import { afterEach, describe, expect, it, vi } from "vitest";
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

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("AgentFabric stub guard", () => {
  it("throws unless AGENT_FABRIC_ALLOW_STUB=true", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.AGENT_FABRIC_ALLOW_STUB;

    const fabric = new AgentFabric("url", "anon", "provider");

    await expect(fabric.processUserInput("hi")).rejects.toThrow(/AGENT_FABRIC_ALLOW_STUB=true/);
  });

  it("always blocks in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AGENT_FABRIC_ALLOW_STUB = "true";

    const fabric = new AgentFabric("url", "anon", "provider");

    await expect(fabric.processUserInput("hi")).rejects.toThrow(/disabled/);
  });
});
