import { describe, expect, it } from "vitest";

import {
  createHITLCheckpoint,
  evaluateConfidence,
} from "../AgentGovernanceLayer.js";

describe("AgentGovernanceLayer parse/build guard", () => {
  it("exports Layer 5 governance entry points", () => {
    expect(typeof createHITLCheckpoint).toBe("function");
    expect(typeof evaluateConfidence).toBe("function");
  });
});
