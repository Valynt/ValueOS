import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AgentDriftGuard, fingerprintSchema, readDriftGuardConfigFromEnv, validateDriftGuardIntervalMs } from "../AgentDriftGuard.js";
import { HardenedAgentRunner, type HardenedAgentRunnerConfig } from "../HardenedAgentRunner.js";
import type { AgentOutput, LifecycleContext } from "../../../../types/agent.js";
import type { HardenedInvokeOptions, RequestEnvelope } from "../AgentHardeningTypes.js";

import { logger } from "../../../logger.js";

const TEST_SCHEMA = z.object({
  result: z.string(),
  confidence: z.number().min(0).max(1),
  hallucination_check: z.boolean(),
});

const ENVELOPE: RequestEnvelope = {
  request_id: "req-drift-001",
  trace_id: "trace-drift-001",
  session_id: "session-drift-001",
  user_id: "user-drift-001",
  organization_id: "org-drift-001",
  received_at: new Date().toISOString(),
};

const CONTEXT: LifecycleContext = {
  workspace_id: "ws-drift-001",
  organization_id: "org-drift-001",
  lifecycle_stage: "DISCOVERY",
  user_id: "user-drift-001",
} as LifecycleContext;

const BASE_OPTIONS: HardenedInvokeOptions & { prompt: string; toolsRequested?: string[] } = {
  prompt: "Generate hypotheses with evidence.",
  outputSchema: TEST_SCHEMA,
  requiresIntegrityVeto: false,
  requiresHumanApproval: false,
};

function makeSuccessOutput(): AgentOutput {
  return {
    agent_id: "TestAgent",
    agent_type: "discovery" as AgentOutput["agent_type"],
    lifecycle_stage: "DISCOVERY" as AgentOutput["lifecycle_stage"],
    status: "success",
    confidence: "high",
    result: {
      result: "ok",
      confidence: 0.8,
      hallucination_check: true,
    },
    metadata: {
      execution_time_ms: 12,
      model_version: "gpt-4o",
      timestamp: new Date().toISOString(),
    },
  };
}

function makeRunner(overrides: Partial<HardenedAgentRunnerConfig> = {}): HardenedAgentRunner {
  return new HardenedAgentRunner({
    agentName: "TestAgent",
    agentVersion: "1.0.0",
    lifecycleStage: "DISCOVERY",
    organizationId: "org-drift-001",
    allowedTools: new Set(["memory_query"]),
    riskTier: "discovery",
    integrityVetoService: null,
    hitlPort: null,
    ...overrides,
  });
}

describe("AgentDriftGuard config/env parsing", () => {
  it("uses defaults when optional env vars are missing", () => {
    const cfg = readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_BASELINE_VERSION: "release-2026.05.12+abc1234" });

    expect(cfg.enabled).toBe(true);
    expect(cfg.strictMode).toBe(false);
    expect(cfg.reconciliationIntervalMs).toBe(300_000);
    expect(cfg.baselineVersion).toBe("release-2026.05.12+abc1234");
  });

  it("falls back to default and logs warning on malformed interval", () => {
    const warn = vi.spyOn(logger, "warn");
    const cfg = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_BASELINE_VERSION: "release-2026.05.12+abc1234",
      AGENT_DRIFT_GUARD_INTERVAL_MS: "not-a-number",
    });

    expect(cfg.reconciliationIntervalMs).toBe(300_000);
    expect(warn).toHaveBeenCalledWith(
      "agent.drift_guard.invalid_interval_ms",
      expect.objectContaining({
        env_var: "AGENT_DRIFT_GUARD_INTERVAL_MS",
        raw_value: "not-a-number",
        default_value: 300_000,
        min_value: 1_000,
        max_value: 3_600_000,
      })
    );
  });

  it("parses explicit disable and strict toggles", () => {
    const cfg = readDriftGuardConfigFromEnv({
      AGENT_DRIFT_GUARD_BASELINE_VERSION: "release-2026.05.12+abc1234",
      AGENT_DRIFT_GUARD_ENABLED: "false",
      AGENT_DRIFT_GUARD_STRICT: "true",
    });

    expect(cfg.enabled).toBe(false);
    expect(cfg.strictMode).toBe(true);
  });
});

describe("AgentDriftGuard shouldRun", () => {
  it("returns false in disabled mode", () => {
    const guard = new AgentDriftGuard({ enabled: false, strictMode: false, reconciliationIntervalMs: 1000, baselineVersion: "release-2026.05.12+abc1234" });
    expect(guard.shouldRun(0)).toBe(false);
    expect(guard.shouldRun(5000)).toBe(false);
  });

  it("honors timing boundaries before and at interval", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 1000, baselineVersion: "release-2026.05.12+abc1234" });

    expect(guard.shouldRun(999)).toBe(false);
    expect(guard.shouldRun(1000)).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(1500);
    guard.check({ agentName: "A", riskTier: "discovery", outputSchemaFingerprint: fingerprintSchema(TEST_SCHEMA._def) });

    expect(guard.shouldRun(2499)).toBe(false);
    expect(guard.shouldRun(2500)).toBe(true);
  });
});

describe("AgentDriftGuard check reasons and logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates unknown tier and schema reasons with fallback/regeneration in non-strict mode", () => {
    const warn = vi.spyOn(logger, "warn");
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion: "release-2026.05.12+abc1234" });

    const res = guard.check({
      agentName: "TestAgent",
      riskTier: "unknown",
      outputSchemaFingerprint: "short",
    });

    expect(res.driftDetected).toBe(true);
    expect(res.reasons).toContain("unknown_risk_tier");
    expect(res.reasons).toContain("schema_fingerprint_missing_or_invalid");
    expect(res.correctionApplied).toBe(true);
    expect(res.correctionType).toBe("risk_tier_fallback");
    expect(res.appliedRiskTier).toBe("discovery");
    expect(res.appliedSchemaFingerprint.length).toBe(64);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "agent.drift_detected",
      expect.objectContaining({
        agent: "TestAgent",
        reasons: expect.arrayContaining(["unknown_risk_tier", "schema_fingerprint_missing_or_invalid"]),
        drift_guard_strict: false,
        requested_risk_tier: "unknown",
        applied_risk_tier: "discovery",
        correction_applied: true,
        correction_type: "risk_tier_fallback",
      })
    );
  });

  it("simulates threshold fingerprint drift reason", () => {
    const guard = new AgentDriftGuard({ enabled: true, strictMode: false, reconciliationIntervalMs: 0, baselineVersion: "release-2026.05.12+abc1234" });
    (guard as unknown as { baselineThresholdFingerprint: string }).baselineThresholdFingerprint = "stale-baseline-fingerprint";

    const res = guard.check({ agentName: "TestAgent", riskTier: "discovery", outputSchemaFingerprint: fingerprintSchema(TEST_SCHEMA._def) });

    expect(res.reasons).toContain("confidence_thresholds_drift");
    expect(res.driftDetected).toBe(true);
  });
});

describe("HardenedAgentRunner drift integration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws in strict mode when drift is detected", async () => {
    process.env.AGENT_DRIFT_GUARD_BASELINE_VERSION = "release-2026.05.12+abc1234";
    process.env.AGENT_DRIFT_GUARD_STRICT = "true";
    process.env.AGENT_DRIFT_GUARD_INTERVAL_MS = "0";

    const runner = makeRunner({ riskTier: "unknown" as never });

    await expect(
      runner.run(ENVELOPE, CONTEXT, async () => makeSuccessOutput(), { ...BASE_OPTIONS, riskTier: "unknown" as never })
    ).rejects.toThrow(/Drift guard blocked execution/);
  });

  it("continues in non-strict mode and applies fallback tier", async () => {
    process.env.AGENT_DRIFT_GUARD_BASELINE_VERSION = "release-2026.05.12+abc1234";
    process.env.AGENT_DRIFT_GUARD_STRICT = "false";
    process.env.AGENT_DRIFT_GUARD_INTERVAL_MS = "0";

    const warn = vi.spyOn(logger, "warn");
    const runner = makeRunner({ riskTier: "unknown" as never });
    const result = await runner.run(ENVELOPE, CONTEXT, async () => makeSuccessOutput(), { ...BASE_OPTIONS, riskTier: "unknown" as never });

    expect(result.output.result).toBe("ok");
    expect(warn).toHaveBeenCalledWith(
      "agent.drift_detected",
      expect.objectContaining({ requested_risk_tier: "unknown", applied_risk_tier: "discovery" })
    );
  });
});

describe("validateDriftGuardIntervalMs", () => {
  it("accepts inclusive boundaries", () => {
    expect(validateDriftGuardIntervalMs("1000").value).toBe(1000);
    expect(validateDriftGuardIntervalMs("3600000").value).toBe(3_600_000);
  });

  it("rejects out-of-range, non-integer, and non-finite values", () => {
    const warn = vi.spyOn(logger, "warn");

    expect(validateDriftGuardIntervalMs("999").value).toBe(300_000);
    expect(validateDriftGuardIntervalMs("3600001").value).toBe(300_000);
    expect(validateDriftGuardIntervalMs("1000.5").value).toBe(300_000);
    expect(validateDriftGuardIntervalMs("Infinity").value).toBe(300_000);

    expect(warn).toHaveBeenCalledTimes(4);
  });
});
