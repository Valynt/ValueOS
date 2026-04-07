/**
 * Unit tests for ExportJobRepository.
 *
 * Tests cover:
 * - Job creation with progress step initialization
 * - Idempotency query correctness (findActiveJob)
 * - Tenant isolation enforcement (findById, findCompletedByCase)
 * - State transitions (markRunning, markCompleted, markFailed, cancel)
 * - Progress step array mutation (updateProgress)
 * - Event lifecycle (createEvent, getEvents)
 * - Signed URL refresh (refreshSignedUrl)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGt = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

// Terminal methods return promises, chain methods return this
const createMockChain = () => {
  const chain = {
    insert: vi.fn((...args: any[]) => {
      if (args.length > 0) mockInsert(...args);
      return chain;
    }),
    select: vi.fn((...args: any[]) => {
      if (args.length > 0) mockSelect(...args);
      return chain;
    }),
    update: vi.fn((...args: any[]) => {
      if (args.length > 0) mockUpdate(...args);
      return chain;
    }),
    eq: vi.fn((...args: any[]) => {
      mockEq(...args);
      return chain;
    }),
    in: vi.fn((...args: any[]) => {
      mockIn(...args);
      return chain;
    }),
    order: vi.fn((...args: any[]) => {
      mockOrder(...args);
      return chain;
    }),
    gt: vi.fn((...args: any[]) => {
      mockGt(...args);
      return chain;
    }),
    limit: vi.fn((...args: any[]) => {
      mockLimit(...args);
      // Return a thenable with maybeSingle method
      return {
        maybeSingle: mockMaybeSingle,
        then: (onFulfilled: any) => onFulfilled(mockLimit.mock.results[mockLimit.mock.results.length - 1]?.value),
      };
    }),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  };
  return chain;
};

const mockSupabase = {
  from: vi.fn((table: string) => createMockChain()),
};

vi.mock("../../../lib/supabase/privileged/createWorkerServiceSupabaseClient.js", () => ({
  createWorkerServiceSupabaseClient: vi.fn(() => mockSupabase),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { ExportJobRepository, type ExportFormat, type CreateExportJobInput } from "../ExportJobRepository.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCreateInput(overrides: Partial<CreateExportJobInput> = {}): CreateExportJobInput {
  return {
    tenantId: "tenant-1",
    organizationId: "org-1",
    caseId: "case-1",
    userId: "user-1",
    format: "pdf",
    exportType: "full",
    title: "Test Export",
    ownerName: "Test Owner",
    renderUrl: "https://example.com/export/case-1",
    ...overrides,
  };
}

function makeJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    tenant_id: "tenant-1",
    organization_id: "org-1",
    case_id: "case-1",
    user_id: "user-1",
    format: "pdf",
    export_type: "full",
    title: "Test Export",
    owner_name: "Test Owner",
    render_url: "https://example.com/export/case-1",
    status: "queued",
    progress_percent: 0,
    current_step: null,
    progress_steps: [],
    storage_path: null,
    signed_url: null,
    signed_url_expires_at: null,
    file_size_bytes: null,
    integrity_score_at_export: null,
    readiness_score_at_export: null,
    error_message: null,
    error_code: null,
    retry_count: 0,
    created_at: "2024-01-01T00:00:00.000Z",
    started_at: null,
    completed_at: null,
    failed_at: null,
    cancelled_at: null,
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function resetMockChain() {
  vi.clearAllMocks();
  mockInsert.mockReturnThis();
  mockSelect.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockEq.mockReturnThis();
  mockIn.mockReturnThis();
  mockOrder.mockReturnThis();
  mockLimit.mockReturnThis();
  mockGt.mockReturnThis();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExportJobRepository", () => {
  beforeEach(() => {
    resetMockChain();
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  describe("constructor", () => {
    it("creates a Supabase client when none is provided", async () => {
      // Create a new repository without providing a client
      // The mock factory should be called during construction
      new ExportJobRepository();

      // Verify that the mock factory was called with the correct justification
      const { createWorkerServiceSupabaseClient } = vi.mocked(
        await import("../../../lib/supabase/privileged/createWorkerServiceSupabaseClient.js")
      );
      expect(createWorkerServiceSupabaseClient).toHaveBeenCalledWith({
        justification: "service-role:justified background-worker requires elevated DB access for export job state management",
      });
    });

    it("uses the provided Supabase client", () => {
      const customClient = { from: vi.fn() } as any;
      const repo = new ExportJobRepository(customClient);
      // The repo should use the custom client, not create a new one
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("creates a job with PDF progress steps", async () => {
      const input = makeCreateInput({ format: "pdf" });
      const insertedRow = makeJobRow({ status: "queued" });
      mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const repo = new ExportJobRepository();
      await repo.create(input);

      expect(mockSupabase.from).toHaveBeenCalledWith("export_jobs");
      expect(mockInsert).toHaveBeenCalled();

      const insertArg = mockInsert.mock.calls[0]?.[0];
      expect(insertArg).toMatchObject({
        tenant_id: "tenant-1",
        organization_id: "org-1",
        case_id: "case-1",
        user_id: "user-1",
        format: "pdf",
        status: "queued",
        progress_percent: 0,
        retry_count: 0,
      });

      // Verify PDF progress steps
      const progressSteps = insertArg.progress_steps;
      expect(progressSteps).toHaveLength(6);
      expect(progressSteps[0]).toEqual({
        name: "validate_integrity",
        label: "Validating integrity",
        status: "pending",
        percent: 0,
      });
      expect(progressSteps[1].name).toBe("launch_browser");
      expect(progressSteps[2].name).toBe("render_page");
      expect(progressSteps[3].name).toBe("generate_pdf");
      expect(progressSteps[4].name).toBe("upload");
      expect(progressSteps[5].name).toBe("finalize");
    });

    it("creates a job with PPTX progress steps", async () => {
      const input = makeCreateInput({ format: "pptx" });
      const insertedRow = makeJobRow({ format: "pptx", status: "queued" });
      mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const repo = new ExportJobRepository();
      await repo.create(input);

      const insertArg = mockInsert.mock.calls[0]?.[0];
      const progressSteps = insertArg.progress_steps;
      expect(progressSteps).toHaveLength(5);
      expect(progressSteps[0].name).toBe("fetch_data");
      expect(progressSteps[1].name).toBe("build_deck");
      expect(progressSteps[2].name).toBe("add_slides");
      expect(progressSteps[3].name).toBe("upload");
      expect(progressSteps[4].name).toBe("finalize");
    });

    it("defaults exportType to full when not provided", async () => {
      const input = makeCreateInput({ exportType: undefined });
      const insertedRow = makeJobRow({ status: "queued" });
      mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const repo = new ExportJobRepository();
      await repo.create(input);

      const insertArg = mockInsert.mock.calls[0]?.[0];
      expect(insertArg.export_type).toBe("full");
    });

    it("throws when insert fails", async () => {
      const input = makeCreateInput();
      mockSingle.mockResolvedValue({ data: null, error: { message: "constraint violation" } });

      const repo = new ExportJobRepository();
      await expect(repo.create(input)).rejects.toThrow("Failed to create export job: constraint violation");
    });

    it("includes integrity and readiness scores when provided", async () => {
      const input = makeCreateInput({
        integrityScoreAtExport: 0.85,
        readinessScoreAtExport: 0.92,
      });
      const insertedRow = makeJobRow({
        integrity_score_at_export: 0.85,
        readiness_score_at_export: 0.92,
        status: "queued",
      });
      mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.create(input);

      const insertArg = mockInsert.mock.calls[0]?.[0];
      expect(insertArg.integrity_score_at_export).toBe(0.85);
      expect(insertArg.readiness_score_at_export).toBe(0.92);
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveJob()
  // ---------------------------------------------------------------------------

  describe("findActiveJob", () => {
    it("queries for queued or running jobs matching case/format/tenant", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const repo = new ExportJobRepository();
      await repo.findActiveJob("case-1", "pdf", "tenant-1");

      expect(mockSupabase.from).toHaveBeenCalledWith("export_jobs");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("case_id", "case-1");
      expect(mockEq).toHaveBeenCalledWith("format", "pdf");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-1");
      expect(mockIn).toHaveBeenCalledWith("status", ["queued", "running"]);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(mockMaybeSingle).toHaveBeenCalled();
    });

    it("returns the job when found", async () => {
      const jobRow = makeJobRow({ status: "running" });
      mockMaybeSingle.mockResolvedValue({ data: jobRow, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.findActiveJob("case-1", "pdf", "tenant-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("job-1");
      expect(result?.status).toBe("running");
    });

    it("returns null when no job found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.findActiveJob("case-1", "pdf", "tenant-1");

      expect(result).toBeNull();
    });

    it("returns null and logs error when query fails", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection timeout" } });

      const repo = new ExportJobRepository();
      const result = await repo.findActiveJob("case-1", "pdf", "tenant-1");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findById()
  // ---------------------------------------------------------------------------

  describe("findById", () => {
    it("queries by job id and tenant id", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const repo = new ExportJobRepository();
      await repo.findById("job-1", "tenant-1");

      expect(mockEq).toHaveBeenCalledWith("id", "job-1");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    });

    it("returns the job when found", async () => {
      const jobRow = makeJobRow();
      mockMaybeSingle.mockResolvedValue({ data: jobRow, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.findById("job-1", "tenant-1");

      expect(result?.id).toBe("job-1");
      expect(result?.tenant_id).toBe("tenant-1");
    });

    it("throws when query fails", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "permission denied" } });

      const repo = new ExportJobRepository();
      await expect(repo.findById("job-1", "tenant-1")).rejects.toThrow(
        "Failed to fetch export job: permission denied"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findCompletedByCase()
  // ---------------------------------------------------------------------------

  describe("findCompletedByCase", () => {
    it("queries completed jobs for a case with default limit", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const repo = new ExportJobRepository();
      await repo.findCompletedByCase("case-1", "tenant-1");

      expect(mockEq).toHaveBeenCalledWith("case_id", "case-1");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-1");
      expect(mockEq).toHaveBeenCalledWith("status", "completed");
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("uses custom limit when provided", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const repo = new ExportJobRepository();
      await repo.findCompletedByCase("case-1", "tenant-1", 5);

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("returns completed jobs", async () => {
      const jobs = [makeJobRow({ id: "job-1" }), makeJobRow({ id: "job-2" })];
      mockLimit.mockResolvedValue({ data: jobs, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.findCompletedByCase("case-1", "tenant-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("job-1");
    });

    it("returns empty array when no jobs found", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.findCompletedByCase("case-1", "tenant-1");

      expect(result).toEqual([]);
    });

    it("throws when query fails", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "table not found" } });

      const repo = new ExportJobRepository();
      await expect(repo.findCompletedByCase("case-1", "tenant-1")).rejects.toThrow(
        "Failed to fetch export history: table not found"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // markRunning()
  // ---------------------------------------------------------------------------

  describe("markRunning", () => {
    it("updates job status to running", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null }); // for createEvent

      const repo = new ExportJobRepository();
      await repo.markRunning("job-1", "tenant-1");

      // Verify update was called with running status
      const updateCalls = mockUpdate.mock.calls.filter(
        (call) => call[0]?.status === "running"
      );
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][0]).toMatchObject({
        status: "running",
        current_step: "initializing",
      });
    });

    it("emits a step_start event", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markRunning("job-1", "tenant-1");

      // Check that createEvent was called (via insert on export_job_events)
      const eventInsertCalls = mockInsert.mock.calls.filter(
        (call) => call[0]?.event_type === "step_start"
      );
      expect(eventInsertCalls.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updateProgress()
  // ---------------------------------------------------------------------------

  describe("updateProgress", () => {
    it("fetches current job progress_steps", async () => {
      mockSingle.mockResolvedValue({
        data: { progress_steps: [{ name: "fetch_data", status: "pending", percent: 0 }] },
        error: null,
      });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.updateProgress("job-1", "tenant-1", "fetch_data", "in_progress", 50, 25, "Loading...");

      // First call should be select for progress_steps
      expect(mockSelect).toHaveBeenCalledWith("progress_steps");
      expect(mockSingle).toHaveBeenCalled();
    });

    it("updates the matching step in progress_steps array", async () => {
      const existingSteps = [
        { name: "fetch_data", label: "Fetching", status: "pending", percent: 0 },
        { name: "build_deck", label: "Building", status: "pending", percent: 0 },
      ];
      mockSingle.mockResolvedValue({ data: { progress_steps: existingSteps }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.updateProgress("job-1", "tenant-1", "fetch_data", "in_progress", 50, 25, "Loading...");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      const updatedSteps = updateArg.progress_steps;
      expect(updatedSteps[0]).toEqual({
        name: "fetch_data",
        label: "Fetching",
        status: "in_progress",
        percent: 50,
      });
      // Non-matching step should be unchanged
      expect(updatedSteps[1]).toEqual(existingSteps[1]);
    });

    it("updates overall progress percent and current step", async () => {
      mockSingle.mockResolvedValue({ data: { progress_steps: [] }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.updateProgress("job-1", "tenant-1", "fetch_data", "in_progress", 50, 25, "Loading...");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg.progress_percent).toBe(25);
      expect(updateArg.current_step).toBe("Loading...");
    });

    it("emits a progress event", async () => {
      mockSingle.mockResolvedValue({ data: { progress_steps: [] }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.updateProgress("job-1", "tenant-1", "fetch_data", "in_progress", 50, 25, "Loading...");

      // Second insert call should be for the progress event
      const eventInsertCalls = mockInsert.mock.calls.filter(
        (call) => call[0]?.event_type === "progress"
      );
      expect(eventInsertCalls.length).toBeGreaterThan(0);
      expect(eventInsertCalls[0][0]).toMatchObject({
        event_type: "progress",
        event_data: {
          step: "fetch_data",
          step_status: "in_progress",
          step_percent: 50,
          overall_percent: 25,
          message: "Loading...",
        },
      });
    });

    it("returns early when fetch fails", async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: "fetch error" } });

      const repo = new ExportJobRepository();
      await repo.updateProgress("job-1", "tenant-1", "fetch_data", "in_progress", 50, 25, "Loading...");

      // Should not call update when fetch fails
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // markCompleted()
  // ---------------------------------------------------------------------------

  describe("markCompleted", () => {
    it("updates job with completion result", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markCompleted("job-1", "tenant-1", {
        storagePath: "org-1/case-1/result.pdf",
        signedUrl: "https://signed.url",
        signedUrlExpiresAt: new Date("2024-01-02T00:00:00.000Z"),
        fileSizeBytes: 1234567,
      });

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg).toMatchObject({
        status: "completed",
        progress_percent: 100,
        current_step: "complete",
        storage_path: "org-1/case-1/result.pdf",
        signed_url: "https://signed.url",
        signed_url_expires_at: "2024-01-02T00:00:00.000Z",
        file_size_bytes: 1234567,
      });
    });

    it("emits a complete event", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markCompleted("job-1", "tenant-1", {
        storagePath: "org-1/case-1/result.pdf",
        signedUrl: "https://signed.url",
        signedUrlExpiresAt: new Date("2024-01-02T00:00:00.000Z"),
        fileSizeBytes: 1234567,
      });

      const eventInsertCalls = mockInsert.mock.calls.filter(
        (call) => call[0]?.event_type === "complete"
      );
      expect(eventInsertCalls.length).toBeGreaterThan(0);
      expect(eventInsertCalls[0][0].event_data).toMatchObject({
        storage_path: "org-1/case-1/result.pdf",
        file_size_bytes: 1234567,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // markFailed()
  // ---------------------------------------------------------------------------

  describe("markFailed", () => {
    it("updates job with failure details", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markFailed("job-1", "tenant-1", "Export failed: timeout", "TIMEOUT");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg).toMatchObject({
        status: "failed",
        error_message: "Export failed: timeout",
        error_code: "TIMEOUT",
      });
    });

    it("truncates error message to 2000 characters", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const longMessage = "x".repeat(3000);
      const repo = new ExportJobRepository();
      await repo.markFailed("job-1", "tenant-1", longMessage);

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg.error_message).toHaveLength(2000);
    });

    it("sets error_code to null when not provided", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markFailed("job-1", "tenant-1", "Generic error");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg.error_code).toBeNull();
    });

    it("emits an error event", async () => {
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.markFailed("job-1", "tenant-1", "Export failed", "ERROR");

      const eventInsertCalls = mockInsert.mock.calls.filter(
        (call) => call[0]?.event_type === "error"
      );
      expect(eventInsertCalls.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cancel()
  // ---------------------------------------------------------------------------

  describe("cancel", () => {
    it("cancels a queued job", async () => {
      mockSingle.mockResolvedValue({ data: { status: "queued" }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.cancel("job-1", "tenant-1");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg.status).toBe("cancelled");
    });

    it("cancels a running job", async () => {
      mockSingle.mockResolvedValue({ data: { status: "running" }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.cancel("job-1", "tenant-1");

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg.status).toBe("cancelled");
    });

    it("throws when job is already completed", async () => {
      mockSingle.mockResolvedValue({ data: { status: "completed" }, error: null });

      const repo = new ExportJobRepository();
      await expect(repo.cancel("job-1", "tenant-1")).rejects.toThrow(
        "Cannot cancel job with status: completed"
      );
    });

    it("throws when job is already failed", async () => {
      mockSingle.mockResolvedValue({ data: { status: "failed" }, error: null });

      const repo = new ExportJobRepository();
      await expect(repo.cancel("job-1", "tenant-1")).rejects.toThrow(
        "Cannot cancel job with status: failed"
      );
    });

    it("throws when fetch fails", async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

      const repo = new ExportJobRepository();
      await expect(repo.cancel("job-1", "tenant-1")).rejects.toThrow(
        "Failed to fetch job for cancellation: not found"
      );
    });

    it("emits a cancelled event", async () => {
      mockSingle.mockResolvedValue({ data: { status: "queued" }, error: null });
      mockUpdate.mockResolvedValue({ error: null });
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.cancel("job-1", "tenant-1");

      const eventInsertCalls = mockInsert.mock.calls.filter(
        (call) => call[0]?.event_type === "cancelled"
      );
      expect(eventInsertCalls.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createEvent()
  // ---------------------------------------------------------------------------

  describe("createEvent", () => {
    it("inserts an event record", async () => {
      mockInsert.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.createEvent("job-1", "tenant-1", "progress", {
        step: "fetch_data",
        percent: 50,
      });

      expect(mockInsert).toHaveBeenCalledWith({
        export_job_id: "job-1",
        tenant_id: "tenant-1",
        event_type: "progress",
        event_data: { step: "fetch_data", percent: 50 },
      });
    });

    it("logs error but does not throw on insert failure", async () => {
      mockInsert.mockResolvedValue({ error: { message: "constraint violation" } });

      const repo = new ExportJobRepository();
      await repo.createEvent("job-1", "tenant-1", "progress", {});

      // Verify that insert was called - the mock logger.error would be called internally
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getEvents()
  // ---------------------------------------------------------------------------

  describe("getEvents", () => {
    it("fetches events for a job ordered by created_at", async () => {
      const events = [
        { id: "evt-1", event_type: "progress", created_at: "2024-01-01T00:00:00.000Z" },
        { id: "evt-2", event_type: "complete", created_at: "2024-01-01T00:01:00.000Z" },
      ];
      mockMaybeSingle.mockResolvedValue({ data: { id: "job-1" }, error: null });
      mockLimit.mockResolvedValue({ data: events, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.getEvents("job-1", "tenant-1", "case-1");

      expect(mockEq).toHaveBeenCalledWith("id", "job-1");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-1");
      expect(mockEq).toHaveBeenCalledWith("case_id", "case-1");
      expect(mockEq).toHaveBeenCalledWith("export_job_id", "job-1");
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(result).toEqual(events);
    });

    it("filters events by since timestamp when provided", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: "job-1" }, error: null });
      mockLimit.mockResolvedValue({ data: [], error: null });

      const repo = new ExportJobRepository();
      await repo.getEvents("job-1", "tenant-1", "case-1", "2024-01-01T00:00:00.000Z");

      // Should call gt() for the since filter
      expect(mockGt).toHaveBeenCalledWith("created_at", "2024-01-01T00:00:00.000Z");
    });

    it("returns empty array when no events found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: "job-1" }, error: null });
      mockLimit.mockResolvedValue({ data: null, error: null });

      const repo = new ExportJobRepository();
      const result = await repo.getEvents("job-1", "tenant-1", "case-1");

      expect(result).toEqual([]);
    });

    it("throws when query fails", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: "job-1" }, error: null });
      mockLimit.mockResolvedValue({ data: null, error: { message: "table not found" } });

      const repo = new ExportJobRepository();
      await expect(repo.getEvents("job-1", "tenant-1", "case-1")).rejects.toThrow(
        "Failed to fetch events: table not found"
      );
    });

    it("throws when job not found or doesn't belong to case", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

      const repo = new ExportJobRepository();
      await expect(repo.getEvents("job-1", "tenant-1", "case-1")).rejects.toThrow(
        "Export job not found or access denied"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refreshSignedUrl()
  // ---------------------------------------------------------------------------

  describe("refreshSignedUrl", () => {
    it("updates signed URL and expiry", async () => {
      mockUpdate.mockResolvedValue({ error: null });

      const repo = new ExportJobRepository();
      await repo.refreshSignedUrl(
        "job-1",
        "tenant-1",
        "https://new-signed.url",
        new Date("2024-01-03T00:00:00.000Z")
      );

      const updateArg = mockUpdate.mock.calls[0]?.[0];
      expect(updateArg).toMatchObject({
        signed_url: "https://new-signed.url",
        signed_url_expires_at: "2024-01-03T00:00:00.000Z",
      });
    });
  });
});
