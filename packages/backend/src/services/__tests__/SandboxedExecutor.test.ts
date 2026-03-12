// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import {
  SandboxedExecutor,
  type SandboxProvider,
  type SandboxedExecutionRequest,
} from "../SandboxedExecutor.js";

class FakeProvider implements SandboxProvider {
  constructor(private readonly fn: SandboxProvider["execute"]) {}

  async execute(request: Parameters<SandboxProvider["execute"]>[0]) {
    return this.fn(request);
  }
}

function makeRequest(overrides: Partial<SandboxedExecutionRequest> = {}): SandboxedExecutionRequest {
  return {
    tenantId: "tenant-123",
    language: "python",
    code: "print('ok')",
    ...overrides,
  };
}

describe("SandboxedExecutor", () => {
  it("returns typed completed result on happy path", async () => {
    const executor = new SandboxedExecutor(
      new FakeProvider(async () => ({
        stdout: "ok\n",
        stderr: "",
        exitCode: 0,
        cpuTimeMs: 12,
        memoryBytes: 1024,
      }))
    );

    const result = await executor.execute(makeRequest());

    expect(result.status).toBe("completed");
    expect(result.stdout).toBe("ok\n");
    expect(result.exitCode).toBe(0);
    expect(result.tenantId).toBe("tenant-123");
    expect(result.resourceUsage.requestedMemoryLimitMb).toBeGreaterThan(0);
  });

  it("returns timeout when provider exceeds timeout", async () => {
    const executor = new SandboxedExecutor(
      new FakeProvider(
        async () => await new Promise((resolve) => setTimeout(() => resolve({ stdout: "", stderr: "", exitCode: 0 }), 50))
      )
    );

    const result = await executor.execute(makeRequest({ timeoutMs: 10 }));

    expect(result.status).toBe("timeout");
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out");
  });

  it("blocks dangerous commands before provider execution", async () => {
    const providerExecute = vi.fn();
    const executor = new SandboxedExecutor(new FakeProvider(providerExecute));

    const result = await executor.execute(makeRequest({ code: "eval('2+2')" }));

    expect(result.status).toBe("blocked");
    expect(result.error).toContain("not allowed");
    expect(providerExecute).not.toHaveBeenCalled();
  });

  it("translates provider errors into provider_error status", async () => {
    const executor = new SandboxedExecutor(
      new FakeProvider(async () => {
        throw new Error("provider unavailable");
      })
    );

    const result = await executor.execute(makeRequest());

    expect(result.status).toBe("provider_error");
    expect(result.error).toContain("provider unavailable");
    expect(result.exitCode).toBeNull();
  });
});
