import { describe, it, expect, vi, afterEach } from "vitest";
import { AgentDriftGuard, fingerprintSchema, readDriftGuardConfigFromEnv } from "../AgentDriftGuard.js";
import { z } from "zod";
import { logger } from "../../../logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("falls back and warns for malformed AGENT_DRIFT_GUARD_INTERVAL_MS", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_INTERVAL_MS: "abc",
    });

    expect(config.reconciliationIntervalMs).toBe(300_000);
    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_guard.invalid_interval_ms",
      expect.objectContaining({ offending_value: "abc" })
    );
  });

  it("falls back and warns for zero AGENT_DRIFT_GUARD_INTERVAL_MS", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_INTERVAL_MS: "0",
    });

    expect(config.reconciliationIntervalMs).toBe(300_000);
    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_guard.invalid_interval_ms",
      expect.objectContaining({ offending_value: "0" })
    );
  });

  it("falls back and warns for negative AGENT_DRIFT_GUARD_INTERVAL_MS", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_INTERVAL_MS: "-1000",
    });

    expect(config.reconciliationIntervalMs).toBe(300_000);
    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_guard.invalid_interval_ms",
      expect.objectContaining({ offending_value: "-1000" })
    );
  });

  it("falls back and warns for extremely large AGENT_DRIFT_GUARD_INTERVAL_MS", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_INTERVAL_MS: "999999999999",
    });

    expect(config.reconciliationIntervalMs).toBe(300_000);
    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_guard.invalid_interval_ms",
      expect.objectContaining({ offending_value: "999999999999" })
    );
  });
});
