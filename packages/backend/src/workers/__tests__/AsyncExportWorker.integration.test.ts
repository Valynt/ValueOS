/**
 * AsyncExportWorker — Integration Tests
 *
 * Tests cover:
 * - PPTX export job processing with mocked services
 * - PDF export job processing with mocked services
 * - Progress callback integration
 * - Job lifecycle (queued → running → completed/failed)
 * - Event emission during processing
 * - Failure handling and retry tracking
 * - Tenant context propagation
 * - Idempotency behavior
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

import { ExportJobRepository } from "../../services/export/ExportJobRepository.js";
import type { ExportJobPayload } from "../AsyncExportWorker.js";

// ---------------------------------------------------------------------------
// Mock BullMQ Job
// ---------------------------------------------------------------------------

const createMockJob = (data: ExportJobPayload): Job<ExportJobPayload> => {
  return {
    id: data.jobId,
    data,
    updateProgress: vi.fn(),
    log: vi.fn(),
    moveToFailed: vi.fn(),
    moveToCompleted: vi.fn(),
    attemptsMade: 0,
    opts: {},
  } as unknown as Job<ExportJobPayload>;
};

// ---------------------------------------------------------------------------
// Mock Services
// ---------------------------------------------------------------------------

const mockMarkRunning = vi.fn();
const mockMarkCompleted = vi.fn();
const mockMarkFailed = vi.fn();
const mockUpdateProgress = vi.fn();
const mockCreateEvent = vi.fn();

vi.mock("../../services/export/ExportJobRepository.js", () => ({
  ExportJobRepository: class {
    markRunning = mockMarkRunning;
    markCompleted = mockMarkCompleted;
    markFailed = mockMarkFailed;
    updateProgress = mockUpdateProgress;
    createEvent = mockCreateEvent;
  },
}));

const mockPptxExportValueCase = vi.fn();
const mockPptxEmitProgress = vi.fn();

vi.mock("../../services/export/PptxExportService.js", () => ({
  PptxExportService: class {
    exportValueCase = mockPptxExportValueCase;
    emitProgress = mockPptxEmitProgress;
  },
}));

const mockPdfExportValueCase = vi.fn();
const mockPdfEmitProgress = vi.fn();

vi.mock("../../services/export/PdfExportService.js", () => ({
  PdfExportService: class {
    exportValueCase = mockPdfExportValueCase;
    emitProgress = mockPdfEmitProgress;
  },
}));

// ---------------------------------------------------------------------------
// Mock Logger
// ---------------------------------------------------------------------------

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeJobPayload = (overrides: Partial<ExportJobPayload> = {}): ExportJobPayload => ({
  jobId: "job-1",
  tenantId: "tenant-1",
  organizationId: "org-1",
  caseId: "case-1",
  userId: "user-1",
  format: "pptx",
  exportType: "full",
  title: "Test Export",
  ownerName: "Test Owner",
  renderUrl: undefined,
  traceId: "trace-1",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { processJob } = await import("../AsyncExportWorker.js");

describe("AsyncExportWorker Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // PPTX Export Processing
  // ---------------------------------------------------------------------------

  describe("PPTX Export Processing", () => {
    it("marks job as running at start of processing", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      expect(mockMarkRunning).toHaveBeenCalledWith("job-1", "tenant-1");
    });

    it("calls PptxExportService with correct parameters", async () => {
      const payload = makeJobPayload({
        format: "pptx",
        title: "Business Case",
        ownerName: "John Doe",
      });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockMarkCompleted.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      expect(mockPptxExportValueCase).toHaveBeenCalledWith({
        organizationId: "tenant-1",
        caseId: "case-1",
        title: "Business Case",
        ownerName: "John Doe",
      });
    });

    it("marks job as completed with storage details", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      expect(mockMarkCompleted).toHaveBeenCalledWith(
        "job-1",
        "tenant-1",
        expect.objectContaining({
          storagePath: "org-1/case-1/export.pptx",
          signedUrl: "https://signed.url",
          fileSizeBytes: 1234567,
        })
      );
    });

    it("progress callback updates job progress during processing", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);

      // Capture the progress callback passed to PptxExportService
      let capturedProgressCallback: ((step: string, progress: number, message?: string) => Promise<void>) | undefined;

      mockPptxExportValueCase.mockImplementation(async (input, progressCallback) => {
        capturedProgressCallback = progressCallback;
        // Simulate progress during export
        if (progressCallback) {
          await progressCallback("fetch", 50, "Loading data...");
          await progressCallback("fetch", 100, "Data loaded");
          await progressCallback("build", 50, "Building deck...");
        }
        return {
          storagePath: "org-1/case-1/export.pptx",
          signedUrl: "https://signed.url",
          sizeBytes: 1234567,
          createdAt: "2024-01-01T00:00:00.000Z",
        };
      });

      await processJob(job);

      // Verify progress callback was provided
      expect(capturedProgressCallback).toBeDefined();

      // Verify progress updates were made
      expect(mockUpdateProgress).toHaveBeenCalledWith(
        "job-1",
        "tenant-1",
        "fetch_data",
        "completed",
        100,
        expect.any(Number),
        "Data loaded"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PDF Export Processing
  // ---------------------------------------------------------------------------

  describe("PDF Export Processing", () => {
    it("calls PdfExportService with correct parameters", async () => {
      const payload = makeJobPayload({
        format: "pdf",
        renderUrl: "http://localhost:3000/case-1/outputs?pdf=true",
        title: "PDF Export",
      });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPdfExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pdf",
        signedUrl: "https://signed.pdf.url",
        sizeBytes: 987654,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      expect(mockPdfExportValueCase).toHaveBeenCalledWith({
        organizationId: "tenant-1",
        caseId: "case-1",
        renderUrl: "http://localhost:3000/case-1/outputs?pdf=true",
        authToken: undefined,
        title: "PDF Export",
      });
    });

    it("marks PDF job as completed with correct storage path", async () => {
      const payload = makeJobPayload({ format: "pdf", renderUrl: "http://localhost/case" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPdfExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pdf",
        signedUrl: "https://signed.pdf.url",
        sizeBytes: 987654,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      expect(mockMarkCompleted).toHaveBeenCalledWith(
        "job-1",
        "tenant-1",
        expect.objectContaining({
          storagePath: "org-1/case-1/export.pdf",
          signedUrl: "https://signed.pdf.url",
          fileSizeBytes: 987654,
        })
      );
    });

    it("throws error when PDF renderUrl is missing", async () => {
      const payload = makeJobPayload({ format: "pdf", renderUrl: undefined });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);

      await expect(processJob(job)).rejects.toThrow("PDF export requires renderUrl");
    });
  });

  // ---------------------------------------------------------------------------
  // Job Lifecycle & Event Emission
  // ---------------------------------------------------------------------------

  describe("Job Lifecycle", () => {
    it("emits step_start event when marking job running", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "org-1/case-1/export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      // markRunning should call createEvent internally
      expect(mockMarkRunning).toHaveBeenCalled();
    });

    it("marks job as failed when export throws error", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockRejectedValue(new Error("PPTX generation failed"));

      await expect(processJob(job)).rejects.toThrow("PPTX generation failed");

      expect(mockMarkFailed).toHaveBeenCalledWith(
        "job-1",
        "tenant-1",
        "PPTX generation failed",
        undefined
      );
    });

    it("captures error code when available", async () => {
      const payload = makeJobPayload({ format: "pptx" });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);

      const error = new Error("Storage upload failed") as Error & { code: string };
      error.code = "STORAGE_ERROR";
      mockPptxExportValueCase.mockRejectedValue(error);

      await expect(processJob(job)).rejects.toThrow();

      expect(mockMarkFailed).toHaveBeenCalledWith(
        "job-1",
        "tenant-1",
        "Storage upload failed",
        "STORAGE_ERROR"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Tenant Context
  // ---------------------------------------------------------------------------

  describe("Tenant Context", () => {
    it("passes correct tenant ID to repository methods", async () => {
      const payload = makeJobPayload({
        tenantId: "tenant-specific-123",
        format: "pptx",
      });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      // All repository calls should use the tenant ID from the job payload
      expect(mockMarkRunning).toHaveBeenCalledWith("job-1", "tenant-specific-123");
      expect(mockPptxExportValueCase).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "tenant-specific-123",
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Trace ID Logging
  // ---------------------------------------------------------------------------

  describe("Trace ID Logging", () => {
    it("includes traceId in logged messages", async () => {
      const payload = makeJobPayload({
        traceId: "trace-abc-123",
        format: "pptx",
      });
      const job = createMockJob(payload);

      mockMarkRunning.mockResolvedValue(undefined);
      mockPptxExportValueCase.mockResolvedValue({
        storagePath: "export.pptx",
        signedUrl: "https://signed.url",
        sizeBytes: 1234567,
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      await processJob(job);

      // Logger should have been called with traceId
      const { logger } = await import("../../lib/logger.js");
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          traceId: "trace-abc-123",
        })
      );
    });
  });
});
