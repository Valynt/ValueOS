/**
 * Unit tests for AsyncExportWorker.
 *
 * Tests cover:
 * - Queue creation and configuration
 * - Queue name constant
 * - Queue singleton behavior
 * - Default job options (retries, backoff, cleanup)
 *
 * Note: processJob, processPptxExport, and processPdfExport are internal
 * functions. Their behavior is tested indirectly through the queue worker
 * integration tests. These unit tests focus on the exported factory functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueueAdd = vi.fn();
const mockQueueGetJobs = vi.fn();
const mockQueueClean = vi.fn();
const mockQueueClose = vi.fn();

const MockQueue = vi.fn().mockImplementation(() => ({
  add: mockQueueAdd,
  getJobs: mockQueueGetJobs,
  clean: mockQueueClean,
  close: mockQueueClose,
}));

vi.mock("bullmq", () => ({
  Queue: MockQueue,
  Worker: vi.fn(),
}));

vi.mock("../config/ServiceConfigManager.js", () => ({
  getAgentMessageQueueConfig: () => ({
    redis: { url: "redis://localhost:6379" },
  }),
}));

vi.mock("../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../observability/queueMetrics.js", () => ({
  attachQueueMetrics: vi.fn(),
}));

vi.mock("./IdempotentJobProcessor.js", () => ({
  withIdempotency: vi.fn((_queue, fn) => fn),
}));

vi.mock("./tenantContextBootstrap.js", () => ({
  runJobWithTenantContext: vi.fn((_opts, handler) => handler()),
}));

vi.mock("../services/export/ExportJobRepository.js", () => ({
  ExportJobRepository: class {
    markRunning = vi.fn().mockResolvedValue(undefined);
    markCompleted = vi.fn().mockResolvedValue(undefined);
    markFailed = vi.fn().mockResolvedValue(undefined);
    updateProgress = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../services/export/PptxExportService.js", () => ({
  PptxExportService: class {
    exportValueCase = vi.fn().mockResolvedValue({
      storagePath: "org-1/case-1/result.pptx",
      signedUrl: "https://signed.pptx.url",
      sizeBytes: 1234567,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  },
}));

vi.mock("../services/export/PdfExportService.js", () => ({
  PdfExportService: class {
    exportValueCase = vi.fn().mockResolvedValue({
      storagePath: "org-1/case-1/result.pdf",
      signedUrl: "https://signed.pdf.url",
      sizeBytes: 2345678,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getAsyncExportQueue, ASYNC_EXPORT_QUEUE_NAME } from "../AsyncExportWorker.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AsyncExportWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module to clear the singleton queue
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // getAsyncExportQueue()
  // ---------------------------------------------------------------------------

  describe("getAsyncExportQueue", () => {
    it("creates a Queue with the correct name", async () => {
      const { getAsyncExportQueue: getQueue } = await import("../AsyncExportWorker.js");
      getQueue();

      expect(MockQueue).toHaveBeenCalledWith(
        "export-jobs",
        expect.objectContaining({
          connection: { url: "redis://localhost:6379" },
        })
      );
    });

    it("configures default job options with 3 attempts", async () => {
      const { getAsyncExportQueue: getQueue } = await import("../AsyncExportWorker.js");
      getQueue();

      const callArgs = MockQueue.mock.calls[0] as unknown as [string, { defaultJobOptions: Record<string, unknown> }];
      const jobOptions = callArgs[1];
      expect(jobOptions.defaultJobOptions.attempts).toBe(3);
    });

    it("configures exponential backoff with 5s delay", async () => {
      const { getAsyncExportQueue: getQueue } = await import("../AsyncExportWorker.js");
      getQueue();

      const callArgs = MockQueue.mock.calls[0] as unknown as [string, { defaultJobOptions: Record<string, unknown> }];
      const jobOptions = callArgs[1];
      expect(jobOptions.defaultJobOptions.backoff).toEqual({
        type: "exponential",
        delay: 5000,
      });
    });

    it("configures removeOnComplete to keep 10 jobs", async () => {
      const { getAsyncExportQueue: getQueue } = await import("../AsyncExportWorker.js");
      getQueue();

      const callArgs = MockQueue.mock.calls[0] as unknown as [string, { defaultJobOptions: Record<string, unknown> }];
      const jobOptions = callArgs[1];
      expect(jobOptions.defaultJobOptions.removeOnComplete).toBe(10);
    });

    it("configures removeOnFail to keep 5 jobs", async () => {
      const { getAsyncExportQueue: getQueue } = await import("../AsyncExportWorker.js");
      getQueue();

      const callArgs = MockQueue.mock.calls[0] as unknown as [string, { defaultJobOptions: Record<string, unknown> }];
      const jobOptions = callArgs[1];
      expect(jobOptions.defaultJobOptions.removeOnFail).toBe(5);
    });

    it("returns the same queue on subsequent calls (singleton)", async () => {
      const { getAsyncExportQueue: getQueue1 } = await import("../AsyncExportWorker.js");
      const queue1 = getQueue1();

      const { getAsyncExportQueue: getQueue2 } = await import("../AsyncExportWorker.js");
      const queue2 = getQueue2();

      expect(queue1).toBe(queue2);
      // Queue should only be created once
      expect(MockQueue).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // ASYNC_EXPORT_QUEUE_NAME
  // ---------------------------------------------------------------------------

  describe("ASYNC_EXPORT_QUEUE_NAME", () => {
    it("exports the queue name", async () => {
      const { ASYNC_EXPORT_QUEUE_NAME } = await import("../AsyncExportWorker.js");
      expect(ASYNC_EXPORT_QUEUE_NAME).toBe("export-jobs");
    });
  });
});
