/**
 * logger.production.test.ts
 *
 * Verifies that the shared logger honours LOG_LEVEL and emits info/warn/error
 * in production. Regression guard for the silent-drop bug where minLevel was
 * hard-coded to "warn" and consoleOutput only wrote errors.
 *
 * In production the logger emits structured JSON via console.log for all
 * levels (for log-ingestion pipelines). Tests assert on console.log call
 * count and the `level` field in the emitted JSON.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/environment.js", () => ({
  isDevelopment: vi.fn(() => false),
  isProduction: vi.fn(() => true),
  isTest: vi.fn(() => false),
  getEnvironment: vi.fn(() => "production"),
}));

vi.mock("../config/telemetry.js", () => ({
  getTraceContextForLogging: vi.fn(() => ({})),
}));

vi.mock("./context.js", () => ({
  getContext: vi.fn(() => ({})),
}));

vi.mock("./piiFilter.js", () => ({
  sanitizeForLogging: vi.fn((v: unknown) => v),
  sanitizeError: vi.fn((e: unknown) => e),
  sanitizeRequest: vi.fn((v: unknown) => v),
  sanitizeUser: vi.fn((v: unknown) => v),
  validateLogMessage: vi.fn(),
}));

// Re-import a fresh Logger instance so each test picks up the current LOG_LEVEL.
async function freshLogger(logLevel?: string) {
  vi.resetModules();

  vi.mock("../config/environment.js", () => ({
    isDevelopment: vi.fn(() => false),
    isProduction: vi.fn(() => true),
    isTest: vi.fn(() => false),
    getEnvironment: vi.fn(() => "production"),
  }));
  vi.mock("../config/telemetry.js", () => ({
    getTraceContextForLogging: vi.fn(() => ({})),
  }));
  vi.mock("./context.js", () => ({
    getContext: vi.fn(() => ({})),
  }));
  vi.mock("./piiFilter.js", () => ({
    sanitizeForLogging: vi.fn((v: unknown) => v),
    sanitizeError: vi.fn((e: unknown) => e),
    sanitizeRequest: vi.fn((v: unknown) => v),
    sanitizeUser: vi.fn((v: unknown) => v),
    validateLogMessage: vi.fn(),
  }));

  if (logLevel !== undefined) {
    process.env.LOG_LEVEL = logLevel;
  } else {
    delete process.env.LOG_LEVEL;
  }

  const mod = await import("./logger.js");
  return mod.logger;
}

/** Parse the JSON string passed to console.log and return the `level` field. */
function parsedLevel(spy: ReturnType<typeof vi.spyOn>, callIndex = 0): string {
  const raw = spy.mock.calls[callIndex]?.[0] as string;
  return (JSON.parse(raw) as { level: string }).level;
}

describe("shared logger — production level behaviour", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    // Production path uses console.log for all levels (structured JSON).
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
    vi.resetModules();
  });

  // AC-3: LOG_LEVEL unset → production default is "info"
  describe("LOG_LEVEL unset — production default is info", () => {
    it("emits info", async () => {
      const log = await freshLogger(undefined);
      log.info("user.login.success", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("info");
    });

    it("emits warn", async () => {
      const log = await freshLogger(undefined);
      log.warn("audit.lookup.failed", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("warn");
    });

    it("emits error", async () => {
      const log = await freshLogger(undefined);
      log.error("login.failed", new Error("bad credentials"), { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("error");
    });

    it("suppresses debug", async () => {
      const log = await freshLogger(undefined);
      log.debug("verbose.trace", { tenant_id: "t1" });
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // AC-4: LOG_LEVEL=warn → suppresses info, emits warn+error
  describe("LOG_LEVEL=warn — suppresses info, emits warn and error", () => {
    it("suppresses info", async () => {
      const log = await freshLogger("warn");
      log.info("user.login.success", { tenant_id: "t1" });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("emits warn", async () => {
      const log = await freshLogger("warn");
      log.warn("audit.lookup.failed", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("warn");
    });

    it("emits error", async () => {
      const log = await freshLogger("warn");
      log.error("login.failed", new Error("bad credentials"));
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("error");
    });
  });

  // AC-5: LOG_LEVEL=debug → emits all levels
  describe("LOG_LEVEL=debug — emits all levels", () => {
    it("emits debug", async () => {
      const log = await freshLogger("debug");
      log.debug("cache.hit", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("debug");
    });

    it("emits info", async () => {
      const log = await freshLogger("debug");
      log.info("user.login.success", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("info");
    });
  });

  describe("LOG_LEVEL=error — suppresses info and warn", () => {
    it("suppresses info", async () => {
      const log = await freshLogger("error");
      log.info("user.login.success", { tenant_id: "t1" });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses warn", async () => {
      const log = await freshLogger("error");
      log.warn("audit.lookup.failed", { tenant_id: "t1" });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("emits error", async () => {
      const log = await freshLogger("error");
      log.error("login.failed", new Error("bad credentials"));
      expect(logSpy).toHaveBeenCalledOnce();
      expect(parsedLevel(logSpy)).toBe("error");
    });
  });

  describe("invalid LOG_LEVEL — falls back to production default (info)", () => {
    it("treats unknown level as unset and defaults to info", async () => {
      const log = await freshLogger("verbose"); // not a valid LogLevel
      log.info("user.login.success", { tenant_id: "t1" });
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("suppresses debug when falling back to info default", async () => {
      const log = await freshLogger("verbose");
      log.debug("cache.hit", { tenant_id: "t1" });
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
