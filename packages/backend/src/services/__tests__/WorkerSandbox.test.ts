import { describe, expect, it, vi } from "vitest";

import {
  executeInWorkerSandbox,
  validateSandboxCode,
} from "../WorkerSandbox.js";

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("validateSandboxCode", () => {
  it("accepts safe arithmetic code", () => {
    const result = validateSandboxCode("return 2 + 2;");
    expect(result.safe).toBe(true);
  });

  it("rejects require()", () => {
    const result = validateSandboxCode('require("fs")');
    expect(result.safe).toBe(false);
    expect(result).toHaveProperty("reason");
    if (!result.safe) {
      expect(result.reason).toContain("require()");
    }
  });

  it("rejects eval()", () => {
    const result = validateSandboxCode('eval("malicious")');
    expect(result.safe).toBe(false);
  });

  it("rejects import statements", () => {
    const result = validateSandboxCode('import fs from "fs"');
    expect(result.safe).toBe(false);
  });

  it("rejects dynamic import()", () => {
    const result = validateSandboxCode('import("fs")');
    expect(result.safe).toBe(false);
  });

  it("rejects process access", () => {
    const result = validateSandboxCode("process.exit(1)");
    expect(result.safe).toBe(false);
  });

  it("rejects Function constructor", () => {
    const result = validateSandboxCode('Function("return this")()');
    expect(result.safe).toBe(false);
  });

  it("rejects fetch()", () => {
    const result = validateSandboxCode('fetch("https://evil.com")');
    expect(result.safe).toBe(false);
  });

  it("rejects code exceeding max length", () => {
    const longCode = "x".repeat(50_001);
    const result = validateSandboxCode(longCode);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("max length");
    }
  });
});

describe("executeInWorkerSandbox", () => {
  it("executes simple arithmetic", async () => {
    const result = await executeInWorkerSandbox("return 2 + 3;");
    expect(result.success).toBe(true);
    expect(result.result).toBe(5);
    expect(result.timedOut).toBe(false);
  });

  it("captures console output", async () => {
    const result = await executeInWorkerSandbox(
      'console.log("hello"); console.log("world"); return 42;'
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.consoleOutput).toContain("hello");
    expect(result.consoleOutput).toContain("world");
  });

  it("injects context variables", async () => {
    const result = await executeInWorkerSandbox("return a + b;", {
      context: { a: 10, b: 20 },
    });
    expect(result.success).toBe(true);
    expect(result.result).toBe(30);
  });

  it("rejects dangerous code before execution", async () => {
    const result = await executeInWorkerSandbox('require("fs")');
    expect(result.success).toBe(false);
    expect(result.error).toContain("Blocked pattern");
  });

  it("handles runtime errors gracefully", async () => {
    const result = await executeInWorkerSandbox(
      "throw new Error('test error');"
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("test error");
  });

  it("enforces timeout", async () => {
    const result = await executeInWorkerSandbox(
      "while(true) {}",
      { timeoutMs: 500 }
    );
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(400);
  }, 10_000);

  it("provides Math and JSON in sandbox", async () => {
    const result = await executeInWorkerSandbox(
      'return JSON.stringify({ pi: Math.round(Math.PI * 100) / 100 });'
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe('{"pi":3.14}');
  });

  it("blocks access to process inside worker", async () => {
    // "process" is in the blocked patterns, so this should fail at validation
    const result = await executeInWorkerSandbox(
      "return typeof process;"
    );
    expect(result.success).toBe(false);
  });

  it("can run array operations", async () => {
    const result = await executeInWorkerSandbox(
      "return [1,2,3,4,5].reduce((a,b) => a + b, 0);",
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe(15);
  });

  it("can use Date", async () => {
    const result = await executeInWorkerSandbox(
      "return typeof new Date().getTime();"
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe("number");
  });
});
