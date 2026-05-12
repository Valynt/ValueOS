import { describe, it, expect } from "vitest";
import { AgentDriftGuard, fingerprintSchema } from "../AgentDriftGuard.js";
import { z } from "zod";

describe("AgentDriftGuard", () => {
  const baselineVersion = "release-2026.05.12+abc1234";

  it("reports no correction when there is no drift", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion });
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
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion });
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

  it("regenerates invalid schema fingerprints deterministically across repeated instantiations", () => {
    const createGuard = () =>
      new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion });

    const first = createGuard().check({
      agentName: "TestAgent",
      riskTier: "discovery",
      outputSchemaFingerprint: "",
    });
    const second = createGuard().check({
      agentName: "TestAgent",
      riskTier: "discovery",
      outputSchemaFingerprint: "",
    });

    expect(first.correctionType).toBe("schema_fingerprint_regenerated");
    expect(first.appliedSchemaFingerprint).toBe(second.appliedSchemaFingerprint);
  });

  it("maintains deterministic schema fingerprint regeneration across simulated process restarts", () => {
    const processA = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion: "gitsha-7f3a9cd" });
    const processB = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion: "gitsha-7f3a9cd" });

    const runCheck = (guard: AgentDriftGuard) =>
      guard.check({
        agentName: "OpportunityAgent",
        riskTier: "discovery",
        outputSchemaFingerprint: "invalid",
      });

    const a = runCheck(processA);
    const b = runCheck(processB);

    expect(a.appliedSchemaFingerprint).toBe(b.appliedSchemaFingerprint);
    expect(a.baselineVersion).toBe("gitsha-7f3a9cd");
    expect(b.baselineVersion).toBe("gitsha-7f3a9cd");
  });
});
