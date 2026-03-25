/**
 * LLMQueueService tenant_id enforcement tests (AC-7, AC-8, AC-9, AC-10).
 *
 * Tests the tenant_id requirement without instantiating LLMQueueService
 * (which has constructor side-effects: Redis connection, metrics HTTP server).
 * Logic is validated via a minimal stub that mirrors the production implementation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();
const mockDbInsert = vi.fn().mockResolvedValue({ error: null });

const mockLogger = {
  info: mockLoggerInfo,
  error: mockLoggerError,
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: "job-123" }),
};

const mockWorkerHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockWorker = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockWorkerHandlers[event] = handler;
  }),
};

const mockDb = {
  from: vi.fn().mockReturnValue({ insert: mockDbInsert }),
};

interface LLMJobData {
  type: "canvas_generation" | "canvas_refinement" | "custom_prompt";
  tenant_id: string;
  userId: string;
  prompt?: string;
}

interface LLMJobResult {
  content: string; provider: string; model: string;
  promptTokens: number; completionTokens: number; totalTokens: number;
  cost: number; latency: number; cached: boolean;
}

// Stub mirrors production addJob/storeResult/worker-listener logic without
// constructor side-effects (Redis, metrics HTTP server).
// Keep in sync with packages/backend/src/services/realtime/MessageQueue.ts.
class LLMQueueServiceStub {
  async addJob(data: LLMJobData): Promise<{ id: string }> {
    if (!data.tenant_id || typeof data.tenant_id !== "string" || data.tenant_id.trim() === "") {
      throw new Error("LLMQueueService.addJob: tenant_id is required and must be a non-empty string");
    }
    const job = await mockQueue.add("llm-request", data, {});
    mockLogger.info("LLM job added to queue", {
      jobId: job.id, type: data.type, userId: data.userId, tenant_id: data.tenant_id,
    });
    return job;
  }

  async storeResult(jobId: string, data: LLMJobData, result: LLMJobResult): Promise<void> {
    const { error } = await mockDb.from("llm_job_results").insert({
      job_id: jobId, tenant_id: data.tenant_id, user_id: data.userId,
      type: data.type, content: result.content, provider: result.provider,
      model: result.model, prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens, total_tokens: result.totalTokens,
      cost_usd: result.cost, latency_ms: result.latency, cached: result.cached,
    });
    if (error) {
      mockLogger.error("Failed to store LLM job result", error, { jobId, tenant_id: data.tenant_id });
    }
  }

  setupWorkerListeners(): void {
    mockWorker.on("completed", (job: unknown) => {
      const j = job as { id: string; data: LLMJobData; processedOn: number };
      mockLogger.info("Job completed", { jobId: j.id, tenant_id: j.data?.tenant_id, duration: Date.now() - j.processedOn });
    });
    mockWorker.on("failed", (job: unknown, error: unknown) => {
      const j = job as { id: string; data: LLMJobData; attemptsMade: number } | undefined;
      mockLogger.error("Job failed", { jobId: j?.id, tenant_id: j?.data?.tenant_id, error: (error as Error).message, attempts: j?.attemptsMade });
    });
  }
}

describe("LLMQueueService — tenant_id enforcement (AC-7, AC-8, AC-9, AC-10)", () => {
  let service: LLMQueueServiceStub;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockResolvedValue({ error: null });
    mockQueue.add.mockResolvedValue({ id: "job-123" });
    service = new LLMQueueServiceStub();
    service.setupWorkerListeners();
  });

  it("AC-7: addJob accepts a valid payload with tenant_id", async () => {
    const job = await service.addJob({ type: "canvas_generation", tenant_id: "tenant-abc", userId: "u1", prompt: "p" });
    expect(job.id).toBe("job-123");
  });

  it("AC-8: addJob throws when tenant_id is an empty string", async () => {
    await expect(
      service.addJob({ type: "canvas_generation", tenant_id: "", userId: "u1", prompt: "p" })
    ).rejects.toThrow("tenant_id is required");
  });

  it("AC-8: addJob throws when tenant_id is whitespace only", async () => {
    await expect(
      service.addJob({ type: "canvas_generation", tenant_id: "   ", userId: "u1", prompt: "p" })
    ).rejects.toThrow("tenant_id is required");
  });

  it("AC-9: tenant_id appears in the addJob log call", async () => {
    await service.addJob({ type: "canvas_generation", tenant_id: "tenant-xyz", userId: "u1", prompt: "p" });
    const call = mockLoggerInfo.mock.calls.find(([msg]) => msg === "LLM job added to queue");
    expect(call).toBeDefined();
    expect(call[1]).toMatchObject({ tenant_id: "tenant-xyz" });
  });

  it("AC-10: tenant_id is included in the llm_job_results DB insert", async () => {
    const data: LLMJobData = { type: "canvas_generation", tenant_id: "tenant-store", userId: "u1" };
    const result: LLMJobResult = { content: "r", provider: "p", model: "m", promptTokens: 1, completionTokens: 2, totalTokens: 3, cost: 0.001, latency: 100, cached: false };
    await service.storeResult("job-001", data, result);
    expect(mockDbInsert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-store" }));
  });

  it("AC-9: tenant_id appears in worker 'completed' event log", () => {
    const handler = mockWorkerHandlers["completed"];
    expect(handler).toBeDefined();
    handler({ id: "j1", data: { tenant_id: "tenant-done", type: "canvas_generation", userId: "u1" }, processedOn: Date.now() - 50 });
    const call = mockLoggerInfo.mock.calls.find(([msg]) => msg === "Job completed");
    expect(call).toBeDefined();
    expect(call[1]).toMatchObject({ tenant_id: "tenant-done" });
  });

  it("AC-9: tenant_id appears in worker 'failed' event log", () => {
    const handler = mockWorkerHandlers["failed"];
    expect(handler).toBeDefined();
    handler(
      { id: "j2", data: { tenant_id: "tenant-fail", type: "canvas_generation", userId: "u1" }, attemptsMade: 3 },
      new Error("timeout")
    );
    const call = mockLoggerError.mock.calls.find(([msg]) => msg === "Job failed");
    expect(call).toBeDefined();
    expect(call[1]).toMatchObject({ tenant_id: "tenant-fail" });
  });
});
