import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { logger } from "../../../logger.js";
import {
  AgentDriftGuard,
  fingerprintSchema,
  readDriftGuardConfigFromEnv,
  type DriftGuardConfig,
} from "../AgentDriftGuard.js";
import { CONFIDENCE_THRESHOLDS } from "../AgentHardeningTypes.js";
import { HardenedAgentRunner } from "../HardenedAgentRunner.js";
import type { LifecycleContext, AgentOutput } from "../../../../types/agent.js";

describe("readDriftGuardConfigFromEnv", () => {
  it("uses defaults when env vars are missing", () => {
    const config = readDriftGuardConfigFromEnv({});

    expect(config.enabled).toBe(true);
    expect(config.strictMode).toBe(false);
    expect(config.reconciliationIntervalMs).toBe(300_000);
  });

  it("returns NaN for invalid numeric interval", () => {
    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_INTERVAL_MS: "not-a-number",
    });

    expect(Number.isNaN(config.reconciliationIntervalMs)).toBe(true);
  });

  it("parses explicit disable and strict toggles", () => {
    const config = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_ENABLED: "false",
      AGENT_DRIFT_GUARD_STRICT: "true",
      AGENT_DRIFT_GUARD_INTERVAL_MS: "1234",
    });

    expect(config).toEqual({
      enabled: false,
      strictMode: true,
      reconciliationIntervalMs: 1234,
    });
  });
});

describe("AgentDriftGuard.shouldRun", () => {
  it("respects timing boundaries", () => {
    const guard = new AgentDriftGuard({
      enabled: true,
      strictMode: false,
      reconciliationIntervalMs: 1000,
    });

    expect(guard.shouldRun(1000)).toBe(true);

    guard.check({
      agentName: "TestAgent",
      riskTier: "discovery",
      outputSchemaFingerprint: "0123456789abcdef",
    });

    const afterCheckNow = Date.now();
    expect(guard.shouldRun(afterCheckNow + 999)).toBe(false);
    expect(guard.shouldRun(afterCheckNow + 1000)).toBe(true);
  });

  it("never runs when guard is disabled", () => {
    const guard = new AgentDriftGuard({
      enabled: false,
      strictMode: true,
      reconciliationIntervalMs: 1,
    });

    expect(guard.shouldRun(1)).toBe(false);
    expect(guard.shouldRun(999999)).toBe(false);
  });
});

describe("AgentDriftGuard.check", () => {
  const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    // restore potentially mutated global thresholds
    Object.assign(CONFIDENCE_THRESHOLDS, {
      financial: { accept: 0.75, review: 0.60, block: 0.40 },
      commitment: { accept: 0.70, review: 0.55, block: 0.35 },
      discovery: { accept: 0.55, review: 0.40, block: 0.25 },
      narrative: { accept: 0.65, review: 0.50, block: 0.30 },
      compliance: { accept: 0.80, review: 0.65, block: 0.45 },
    });
  });

  it("generates reasons for unknown tier and missing/short schema fingerprint", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 1 });

    const result = guard.check({
      agentName: "TestAgent",
      riskTier: "unknown-tier",
      outputSchemaFingerprint: "short",
    });

    expect(result.driftDetected).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["unknown_risk_tier", "schema_fingerprint_missing_or_invalid"])
    );
    expect(result.correctionApplied).toBe(true);
    expect(result.baselineVersion).toMatch(/\d{4}-\d{2}-\d{2}T/);

    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_detected",
      expect.objectContaining({
        agent: "TestAgent",
        risk_tier: "unknown-tier",
        reasons: expect.arrayContaining(["unknown_risk_tier"]),
        drift_guard_strict: false,
      })
    );
  });

  it("detects threshold fingerprint drift simulation", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 1 });

    CONFIDENCE_THRESHOLDS.discovery.accept = 0.56;

    const result = guard.check({
      agentName: "TestAgent",
      riskTier: "discovery",
      outputSchemaFingerprint: "0123456789abcdef",
    });

    expect(result.driftDetected).toBe(true);
    expect(result.reasons).toContain("confidence_thresholds_drift");
    expect(result.correctionApplied).toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_detected",
      expect.objectContaining({
        agent: "TestAgent",
        risk_tier: "discovery",
        reasons: expect.arrayContaining(["confidence_thresholds_drift"]),
        drift_guard_strict: false,
      })
    );
  });
});


function makeSuccessOutput(): AgentOutput {
  return {
    agent_id: "TestAgent",
    agent_type: "discovery" as AgentOutput["agent_type"],
    lifecycle_stage: "DISCOVERY" as AgentOutput["lifecycle_stage"],
    status: "success",
    confidence: "high",
    result: { result: "ok", confidence: 0.8, hallucination_check: true },
    metadata: { execution_time_ms: 10, model_version: "gpt-4o", timestamp: new Date().toISOString() },
  };
}

describe("HardenedAgentRunner drift guard integration", () => {
  const schema = z.object({ result: z.string(), confidence: z.number(), hallucination_check: z.boolean() });
  const envelope = {
    request_id: "req-1",
    trace_id: "trace-1",
    session_id: "sess-1",
    user_id: "user-1",
    organization_id: "org-1",
    received_at: new Date().toISOString(),
  };
  const context = {
    workspace_id: "ws-1",
    organization_id: "org-1",
    lifecycle_stage: "DISCOVERY",
    user_id: "user-1",
  } as LifecycleContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("continues execution in non-strict mode even when drift is detected", async () => {
    vi.spyOn(AgentDriftGuard.prototype, "shouldRun").mockReturnValue(true);
    vi.spyOn(AgentDriftGuard.prototype, "isStrictMode").mockReturnValue(false);
    vi.spyOn(AgentDriftGuard.prototype, "check").mockReturnValue({
      driftDetected: true,
      reasons: ["unknown_risk_tier"],
      correctionApplied: true,
      baselineVersion: "2026-01-01T00:00:00.000Z",
    });

    const runner = new HardenedAgentRunner({ agentName: "TestAgent", agentVersion: "1.0.0", lifecycleStage: "DISCOVERY", organizationId: "org-1", allowedTools: new Set(["memory_query"]), riskTier: "discovery", integrityVetoService: null, hitlPort: null });
    const executeFn = vi.fn().mockResolvedValue(makeSuccessOutput());

    const result = await runner.run(envelope, context, executeFn, { prompt: "safe prompt", outputSchema: schema, requiresIntegrityVeto: false, requiresHumanApproval: false });
    expect(result.output.result).toBe("ok");
    expect(executeFn).toHaveBeenCalledOnce();
  });

  it("blocks execution in strict mode when drift is detected", async () => {
    vi.spyOn(AgentDriftGuard.prototype, "shouldRun").mockReturnValue(true);
    vi.spyOn(AgentDriftGuard.prototype, "isStrictMode").mockReturnValue(true);
    vi.spyOn(AgentDriftGuard.prototype, "check").mockReturnValue({
      driftDetected: true,
      reasons: ["unknown_risk_tier"],
      correctionApplied: true,
      baselineVersion: "2026-01-01T00:00:00.000Z",
    });

    const runner = new HardenedAgentRunner({ agentName: "TestAgent", agentVersion: "1.0.0", lifecycleStage: "DISCOVERY", organizationId: "org-1", allowedTools: new Set(["memory_query"]), riskTier: "discovery", integrityVetoService: null, hitlPort: null });
    const executeFn = vi.fn().mockResolvedValue(makeSuccessOutput());

    await expect(runner.run(envelope, context, executeFn, { prompt: "safe prompt", outputSchema: schema, requiresIntegrityVeto: false, requiresHumanApproval: false })).rejects.toThrow(/Drift guard blocked execution/);
    expect(executeFn).not.toHaveBeenCalled();
  });

  it("skips drift checks completely when disabled", async () => {
    const shouldRunSpy = vi.spyOn(AgentDriftGuard.prototype, "shouldRun").mockReturnValue(false);
    const driftCheckSpy = vi.spyOn(AgentDriftGuard.prototype, "check");

    const runner = new HardenedAgentRunner({ agentName: "TestAgent", agentVersion: "1.0.0", lifecycleStage: "DISCOVERY", organizationId: "org-1", allowedTools: new Set(["memory_query"]), riskTier: "discovery", integrityVetoService: null, hitlPort: null });
    const executeFn = vi.fn().mockResolvedValue(makeSuccessOutput());

    await runner.run(envelope, context, executeFn, { prompt: "safe prompt", outputSchema: schema, requiresIntegrityVeto: false, requiresHumanApproval: false });

    expect(shouldRunSpy).toHaveBeenCalled();
    expect(driftCheckSpy).not.toHaveBeenCalled();
    expect(executeFn).toHaveBeenCalledOnce();
  });

it("produces deterministic schema fingerprints", () => {
    expect(fingerprintSchema({ b: 2, a: 1 })).toBe(fingerprintSchema({ a: 1, b: 2 }));
  });
});
