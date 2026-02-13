import { describe, expect, it, beforeEach } from "vitest";
import { agentFabric } from "./agent-fabric";

describe("agent-fabric stub guard", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.AGENT_FABRIC_ALLOW_STUB;
  });

  it("fails fast when stub execution is not explicitly allowed", async () => {
    agentFabric.registerAgent({ id: "a1", name: "Agent 1", type: "test", capabilities: [] });

    await expect(agentFabric.executeAgent("a1", { payload: true })).rejects.toThrow(
      "Agent fabric stub is disabled"
    );
  });
});
