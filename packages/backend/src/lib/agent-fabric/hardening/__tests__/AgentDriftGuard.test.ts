import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../../../logger.js";
import { parseDriftGuardConfig, readDriftGuardConfigFromEnv } from "../AgentDriftGuard.js";

describe("AgentDriftGuard env config", () => {
  const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockReset();
  });

  it("uses the default when interval env var is malformed and logs structured warning", () => {
    const config = readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_INTERVAL_MS: "abc" });

    expect(config.reconciliationIntervalMs).toBe(300000);
    expect(warnSpy).toHaveBeenCalledWith(
      "agent.drift_guard_config_invalid",
      expect.objectContaining({
        field: "AGENT_DRIFT_GUARD_INTERVAL_MS",
        raw_value: "abc",
        fallback_value: 300000,
        min_ms: 1000,
        max_ms: 3600000,
      })
    );
  });

  it("rejects boundary violations and falls back to defaults", () => {
    expect(readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_INTERVAL_MS: "999" }).reconciliationIntervalMs).toBe(300000);
    expect(readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_INTERVAL_MS: "3600001" }).reconciliationIntervalMs).toBe(
      300000
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("accepts min and max boundary values", () => {
    expect(readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_INTERVAL_MS: "1000" }).reconciliationIntervalMs).toBe(1000);
    expect(readDriftGuardConfigFromEnv({ AGENT_DRIFT_GUARD_INTERVAL_MS: "3600000" }).reconciliationIntervalMs).toBe(
      3600000
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("enforces typed shape via parseDriftGuardConfig", () => {
    expect(() =>
      parseDriftGuardConfig({ enabled: true, strictMode: false, reconciliationIntervalMs: 10.5 })
    ).toThrowError();
  });
});
