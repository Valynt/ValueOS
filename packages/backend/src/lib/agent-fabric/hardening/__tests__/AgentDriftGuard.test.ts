import { describe, it, expect } from "vitest";
import { AgentDriftGuard, fingerprintSchema } from "../AgentDriftGuard.js";
import { z } from "zod";

describe("AgentDriftGuard", () => {
  it("reports no correction when there is no drift", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0 });
    const res = guard.check({
      agentName: "TestAgent",
      riskTier: "discovery",
      outputSchemaFingerprint: fingerprintSchema(z.object({ foo: z.string() })._def),
    });

    expect(res.driftDetected).toBe(false);
    expect(res.correctionApplied).toBe(false);
    expect(res.correctionType).toBe("none");
  });

  it("applies risk tier fallback correction in non-strict mode", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0 });
    const res = guard.check({
      agentName: "TestAgent",
      riskTier: "unknown",
      outputSchemaFingerprint: fingerprintSchema(z.object({ foo: z.string() })._def),
    });

    expect(res.driftDetected).toBe(true);
    expect(res.correctionApplied).toBe(true);
    expect(res.correctionType).toBe("risk_tier_fallback");
    expect(res.requestedRiskTier).toBe("unknown");
    expect(res.appliedRiskTier).toBe("discovery");
  });
});
