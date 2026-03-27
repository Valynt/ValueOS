/**
 * logger.ts — LOG_LEVEL gating tests
 *
 * Verifies that each log method respects the LOG_LEVEL hierarchy:
 *   debug < info < warn < error
 *
 * error always emits regardless of LOG_LEVEL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opentelemetry/api", () => ({
  context: { active: () => ({}) },
  trace: { getSpan: () => undefined },
}));

vi.mock("@shared/observability/logSchema", () => ({
  structuredLogSchema: {
    safeParse: (entry: unknown) => ({ success: true, data: entry }),
  },
}));

// secureSerialization is a passthrough in tests — no mock needed.

import { logger } from "../logger.js";

describe("logger — LOG_LEVEL gating", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    // Restore original LOG_LEVEL
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  describe("LOG_LEVEL=debug", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("emits debug", () => {
      logger.debug("test.debug");
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("emits info", () => {
      logger.info("test.info");
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("emits warn", () => {
      logger.warn("test.warn");
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("emits error", () => {
      logger.error("test.error");
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LOG_LEVEL=info (default)", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "info";
    });

    it("suppresses debug", () => {
      logger.debug("test.debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("emits info", () => {
      logger.info("test.info");
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("emits warn", () => {
      logger.warn("test.warn");
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("emits error", () => {
      logger.error("test.error");
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LOG_LEVEL=warn", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "warn";
    });

    it("suppresses debug", () => {
      logger.debug("test.debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses info", () => {
      logger.info("test.info");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("emits warn", () => {
      logger.warn("test.warn");
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("emits error", () => {
      logger.error("test.error");
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LOG_LEVEL=error", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "error";
    });

    it("suppresses debug", () => {
      logger.debug("test.debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses info", () => {
      logger.info("test.info");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses warn", () => {
      logger.warn("test.warn");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("emits error", () => {
      logger.error("test.error");
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LOG_LEVEL unset", () => {
    beforeEach(() => {
      delete process.env.LOG_LEVEL;
    });

    it("defaults to info — suppresses debug", () => {
      logger.debug("test.debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("defaults to info — emits info", () => {
      logger.info("test.info");
      expect(logSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LOG_LEVEL invalid value", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "verbose"; // not a valid level
    });

    it("falls back to info — suppresses debug", () => {
      logger.debug("test.debug");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("falls back to info — emits info", () => {
      logger.info("test.info");
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("always emits error", () => {
      logger.error("test.error");
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });
});
