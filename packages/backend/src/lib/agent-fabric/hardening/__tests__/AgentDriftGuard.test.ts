import { describe, it, expect } from "vitest";
import { AgentDriftGuard, fingerprintSchema, type DriftEvaluationArtifact, type DriftSharedStateAdapter } from "../AgentDriftGuard.js";
import { z } from "zod";

class InMemorySharedDriftState implements DriftSharedStateAdapter {
  private lockHeld = false;
  private artifact: DriftEvaluationArtifact | null = null;
  async acquireReconciliationLock(): Promise<boolean> {
    if (this.lockHeld) return false;
    this.lockHeld = true;
    return true;
  }
  async readLatestArtifact(): Promise<DriftEvaluationArtifact | null> { return this.artifact; }
  async writeLatestArtifact(_k: string, artifact: DriftEvaluationArtifact): Promise<void> { this.artifact = artifact; }
}

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

  it("uses shared cached result when another instance holds the lock", async () => {
    const shared = new InMemorySharedDriftState();
    const guardA = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0 }, shared);
    const guardB = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0 }, shared);
    const fp = fingerprintSchema(z.object({ foo: z.string() })._def);

    const a = await guardA.reconcile({ agentName: "A", riskTier: "unknown", outputSchemaFingerprint: fp });
    const b = await guardB.reconcile({ agentName: "B", riskTier: "unknown", outputSchemaFingerprint: fp });

    expect(a.source).toBe("local");
    expect(b.source).toBe("shared_cache");
    expect(b.correctionType).toBe(a.correctionType);
    expect(b.appliedRiskTier).toBe(a.appliedRiskTier);
  });
});
