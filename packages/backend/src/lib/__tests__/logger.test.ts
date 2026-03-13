/**
 * logger.ts — regression tests
 *
 * Covers the backward-compatibility fix for logger.error callers that pass a
 * plain object as the second argument instead of an Error instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @opentelemetry/api before importing logger so getSpan returns undefined
vi.mock("@opentelemetry/api", () => ({
  context: { active: () => ({}) },
  trace: { getSpan: () => undefined },
}));

// Mock the log schema so tests don't depend on its exact shape
vi.mock("@shared/observability/logSchema", () => ({
  structuredLogSchema: {
    safeParse: (entry: unknown) => ({ success: true, data: entry }),
  },
}));

vi.mock("../redaction.js", () => ({
  redactSensitiveData: (v: unknown) => v,
}));

import { logger } from "../logger.js";

describe("logger.error — backward-compatible plain-object second arg", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("preserves structured fields when a plain object is passed as second arg", () => {
    logger.error("job.failed", { jobId: "abc", error: "timeout" });

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.jobId).toBe("abc");
    expect(logged.error).toBe("timeout");
  });

  it("extracts Error fields when a real Error is passed as second arg", () => {
    const err = new Error("something broke");
    logger.error("op.failed", err);

    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.error_message).toBe("something broke");
    expect(logged.error_name).toBe("Error");
  });

  it("merges plain-object second arg with explicit meta third arg", () => {
    logger.error("op.failed", { code: 500 }, { tenant_id: "t1" });

    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.code).toBe(500);
    expect(logged.tenant_id).toBe("t1");
  });

  it("handles undefined second arg without throwing", () => {
    expect(() => logger.error("op.failed", undefined)).not.toThrow();
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.outcome).toBe("failure");
  });

  it("handles null second arg without throwing", () => {
    expect(() => logger.error("op.failed", null)).not.toThrow();
  });

  it("does not promote Error instances to meta", () => {
    const err = new Error("real error");
    logger.error("op.failed", err, { tenant_id: "t2" });

    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    // Error fields should be extracted, not the object itself spread into meta
    expect(logged.error_message).toBe("real error");
    expect(logged.tenant_id).toBe("t2");
    // The Error object itself should not appear as a key
    expect(logged.message).toBeUndefined();
  });
});
