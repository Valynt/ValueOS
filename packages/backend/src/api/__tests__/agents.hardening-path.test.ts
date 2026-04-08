import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const agentsSource = readFileSync(
  resolve(import.meta.dirname, "../agents.ts"),
  "utf-8"
);

describe("agents direct execution hardening path regression", () => {
  it("routes external-facing and financial paths through hardened runner helper", () => {
    expect(agentsSource).toContain("requiresHardenedExecution(agentId as AgentType)");
    expect(agentsSource).toContain("runAgentWithHardening({");
    expect(agentsSource).toContain("executeWithHardenedRunner({");
  });
});
