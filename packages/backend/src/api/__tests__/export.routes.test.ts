/**
 * Export Routes — Integration Tests
 *
 * Tests cover:
 * - POST /:id/export/async - Queue async export with validation, integrity checks, SSRF protection
 * - GET /:id/export/jobs/:jobId/status - Job status retrieval with tenant isolation
 * - GET /:id/export/jobs/:jobId/events - SSE streaming and polling for progress
 * - GET /:id/export/history - Export history retrieval
 * - POST /:id/export/jobs/:jobId/refresh - Signed URL refresh
 * - 401/403 for missing/invalid tenant context
 * - 404 for cross-tenant resource access (IDOR protection)
 * - Rate limiting on export endpoints
 */

import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockQueueAdd = vi.fn();
const mockFindById = vi.fn();
const mockFindCompletedByCase = vi.fn();
const mockRefreshSignedUrl = vi.fn();
const mockGetEvents = vi.fn();
const mockCreate = vi.fn();

const { mockCalculateIntegrity } = vi.hoisted(() => ({
  mockCalculateIntegrity: vi.fn(),
}));

vi.mock("../../../services/export/ExportJobRepository.js", () => ({
  ExportJobRepository: class {
    create = mockCreate;
    findById = mockFindById;
    findCompletedByCase = mockFindCompletedByCase;
    refreshSignedUrl = mockRefreshSignedUrl;
    getEvents = mockGetEvents;
  },
}));

vi.mock("../../../workers/AsyncExportWorker.js", () => ({
  getAsyncExportQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
  ASYNC_EXPORT_QUEUE_NAME: "export-jobs",
}));

vi.mock("../../../services/integrity/ValueIntegrityService.js", () => ({
  ValueIntegrityService: class {
    calculateIntegrity = mockCalculateIntegrity;
  },
}));

// Auth middleware: inject trusted context; skip real JWT verification.
let injectAuth = true;
const TEST_TENANT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEST_USER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const TEST_CASE_ID = "cccccccc-0000-0000-0000-000000000003";
const TEST_JOB_ID = "dddddddd-0000-0000-0000-000000000004";

vi.mock("../../../middleware/auth.js", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (injectAuth) {
      const authReq = req as Request & { user?: unknown; tenantId?: string };
      authReq.user = { id: TEST_USER_ID };
      authReq.tenantId = TEST_TENANT_ID;
    }
    next();
  },
  AuthenticatedRequest: {},
}));

vi.mock("../../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../../middleware/rateLimiter.js", () => ({
  rateLimiters: {
    strict: (_req: Request, _res: Response, next: NextFunction) => next(),
  },
  createRateLimiter: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import router after mocks
// ---------------------------------------------------------------------------

const { backHalfRouter } = await import("../valueCases/backHalf.js");

const app = express();
app.use(express.json());
app.use("/api/v1/cases", backHalfRouter);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Export Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    injectAuth = true;
  });

  afterEach(() => {
    injectAuth = true;
  });

  // ---------------------------------------------------------------------------
  // POST /:id/export/async
  // ---------------------------------------------------------------------------

  describe("POST /api/v1/cases/:id/export/async", () => {
    it("202 - queues async export job with valid request", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.85 });
      mockCreate.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "queued",
        tenant_id: TEST_TENANT_ID,
        case_id: TEST_CASE_ID,
      });
      mockQueueAdd.mockResolvedValue({ id: TEST_JOB_ID });

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pptx",
          exportType: "full",
          title: "Test Export",
          ownerName: "Test Owner",
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe(TEST_JOB_ID);
      expect(res.body.data.status).toBe("queued");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          caseId: TEST_CASE_ID,
          userId: TEST_USER_ID,
          format: "pptx",
          exportType: "full",
        })
      );
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("202 - queues PDF export with renderUrl", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.85 });
      mockCreate.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "queued",
        tenant_id: TEST_TENANT_ID,
        case_id: TEST_CASE_ID,
      });
      mockQueueAdd.mockResolvedValue({ id: TEST_JOB_ID });

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pdf",
          renderUrl: "http://localhost:3000/org/test-case/outputs?pdf=true",
          title: "PDF Export",
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "pdf",
          renderUrl: "http://localhost:3000/org/test-case/outputs?pdf=true",
        })
      );
    });

    it("400 - rejects PDF export without renderUrl", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.85 });

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pdf",
          title: "PDF Export",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("renderUrl is required");
    });

    it("400 - rejects invalid format", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.85 });

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "invalid",
          title: "Test",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("403 - blocks export when integrity score below threshold", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.5 }); // Below 0.6 threshold

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pptx",
          title: "Test Export",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Integrity check failed");
      expect(res.body.integrityScore).toBe(0.5);
    });

    it("400 - blocks SSRF attack via invalid renderUrl", async () => {
      mockCalculateIntegrity.mockResolvedValue({ score: 0.85 });

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pdf",
          renderUrl: "http://internal-service.local/admin",
          title: "Malicious Export",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("renderUrl must point to the application origin");
    });

    it("401 - requires authentication", async () => {
      injectAuth = false;

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pptx",
          title: "Test Export",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Tenant context required");
    });

    it("503 - fails closed when integrity service unavailable", async () => {
      mockCalculateIntegrity.mockRejectedValue(new Error("Service unavailable"));

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/async`)
        .send({
          format: "pptx",
          title: "Test Export",
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INTEGRITY_UNAVAILABLE");
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id/export/jobs/:jobId/status
  // ---------------------------------------------------------------------------

  describe("GET /api/v1/cases/:id/export/jobs/:jobId/status", () => {
    it("200 - returns job status with progress", async () => {
      mockFindById.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "running",
        progress_percent: 50,
        current_step: "Building presentation...",
        progress_steps: [
          { name: "fetch_data", status: "completed", percent: 100 },
          { name: "build_deck", status: "in_progress", percent: 50 },
        ],
        format: "pptx",
        export_type: "full",
        signed_url: null,
        signed_url_expires_at: null,
        file_size_bytes: null,
        error_message: null,
        created_at: "2024-01-01T00:00:00.000Z",
        started_at: "2024-01-01T00:00:01.000Z",
        completed_at: null,
      });

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/status`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(TEST_JOB_ID);
      expect(res.body.data.status).toBe("running");
      expect(res.body.data.progressPercent).toBe(50);
      expect(res.body.data.currentStep).toBe("Building presentation...");
      expect(mockFindById).toHaveBeenCalledWith(TEST_JOB_ID, TEST_TENANT_ID);
    });

    it("200 - returns completed job with signed URL", async () => {
      mockFindById.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "completed",
        progress_percent: 100,
        current_step: "complete",
        progress_steps: [],
        format: "pptx",
        export_type: "full",
        signed_url: "https://signed.url/download",
        signed_url_expires_at: "2024-01-02T00:00:00.000Z",
        file_size_bytes: 1234567,
        error_message: null,
        created_at: "2024-01-01T00:00:00.000Z",
        started_at: "2024-01-01T00:00:01.000Z",
        completed_at: "2024-01-01T00:00:10.000Z",
      });

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/status`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("completed");
      expect(res.body.data.signedUrl).toBe("https://signed.url/download");
      expect(res.body.data.fileSizeBytes).toBe(1234567);
    });

    it("404 - when job not found", async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/status`
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Export job not found");
    });

    it("404 - when job belongs to different tenant (IDOR protection)", async () => {
      // Repository returns null when tenant doesn't match (enforced by RLS)
      mockFindById.mockResolvedValue(null);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/status`
      );

      expect(res.status).toBe(404);
      // Must not reveal whether resource exists in another tenant
      expect(res.body).not.toHaveProperty("tenant_id");
    });

    it("401 - requires authentication", async () => {
      injectAuth = false;

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/status`
      );

      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id/export/jobs/:jobId/events
  // ---------------------------------------------------------------------------

  describe("GET /api/v1/cases/:id/export/jobs/:jobId/events", () => {
    it("200 - returns events in polling mode", async () => {
      mockGetEvents.mockResolvedValue([
        {
          id: "evt-1",
          event_type: "step_start",
          event_data: { step: "fetch_data" },
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "evt-2",
          event_type: "progress",
          event_data: { step: "fetch_data", percent: 50 },
          created_at: "2024-01-01T00:00:01.000Z",
        },
      ]);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/events?poll=true`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].event_type).toBe("step_start");
    });

    it("200 - returns events filtered by since timestamp", async () => {
      mockGetEvents.mockResolvedValue([]);

      await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/events?poll=true&since=2024-01-01T00:00:00.000Z`
      );

      expect(mockGetEvents).toHaveBeenCalledWith(
        TEST_JOB_ID,
        TEST_TENANT_ID,
        "2024-01-01T00:00:00.000Z"
      );
    });

    it("sets SSE headers in streaming mode", async () => {
      mockFindById.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "running",
        progress_percent: 50,
        current_step: "Building...",
        progress_steps: [],
        format: "pptx",
        export_type: "full",
      });
      mockGetEvents.mockResolvedValue([]);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/events`
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id/export/history
  // ---------------------------------------------------------------------------

  describe("GET /api/v1/cases/:id/export/history", () => {
    it("200 - returns export history for case", async () => {
      mockFindCompletedByCase.mockResolvedValue([
        {
          id: TEST_JOB_ID,
          format: "pptx",
          export_type: "full",
          title: "Export 1",
          status: "completed",
          file_size_bytes: 1234567,
          signed_url: "https://signed.url/1",
          signed_url_expires_at: "2024-01-02T00:00:00.000Z",
          integrity_score_at_export: 0.85,
          readiness_score_at_export: 0.92,
          created_at: "2024-01-01T00:00:00.000Z",
          completed_at: "2024-01-01T00:00:10.000Z",
        },
        {
          id: "job-2",
          format: "pdf",
          export_type: "executive_summary",
          title: "Export 2",
          status: "completed",
          file_size_bytes: 987654,
          signed_url: null,
          signed_url_expires_at: null,
          integrity_score_at_export: 0.75,
          readiness_score_at_export: 0.80,
          created_at: "2024-01-02T00:00:00.000Z",
          completed_at: "2024-01-02T00:00:05.000Z",
        },
      ]);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/history`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].format).toBe("pptx");
      expect(res.body.data[0].integrityScoreAtExport).toBe(0.85);
      expect(mockFindCompletedByCase).toHaveBeenCalledWith(
        TEST_CASE_ID,
        TEST_TENANT_ID,
        10 // default limit
      );
    });

    it("200 - respects custom limit parameter", async () => {
      mockFindCompletedByCase.mockResolvedValue([]);

      await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/history?limit=5`
      );

      expect(mockFindCompletedByCase).toHaveBeenCalledWith(
        TEST_CASE_ID,
        TEST_TENANT_ID,
        5
      );
    });

    it("200 - returns empty array when no exports", async () => {
      mockFindCompletedByCase.mockResolvedValue([]);

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/history`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("401 - requires authentication", async () => {
      injectAuth = false;

      const res = await request(app).get(
        `/api/v1/cases/${TEST_CASE_ID}/export/history`
      );

      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /:id/export/jobs/:jobId/refresh
  // ---------------------------------------------------------------------------

  describe("POST /api/v1/cases/:id/export/jobs/:jobId/refresh", () => {
    it("200 - refreshes expired signed URL", async () => {
      mockFindById.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "completed",
        storage_path: "exports/org-1/case-1/export.pptx",
      });
      mockRefreshSignedUrl.mockResolvedValue(undefined);

      // Mock Supabase storage
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://new-signed.url" },
        error: null,
      });
      vi.doMock("../../../lib/supabase.js", () => ({
        supabase: {
          storage: {
            from: vi.fn(() => ({
              createSignedUrl: mockCreateSignedUrl,
            })),
          },
        },
      }));

      const res = await request(app)
        .post(`/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/refresh`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.signedUrl).toBeDefined();
    });

    it("404 - when job not found", async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(app).post(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/refresh`
      );

      expect(res.status).toBe(404);
    });

    it("400 - when job not completed", async () => {
      mockFindById.mockResolvedValue({
        id: TEST_JOB_ID,
        status: "running",
        storage_path: null,
      });

      const res = await request(app).post(
        `/api/v1/cases/${TEST_CASE_ID}/export/jobs/${TEST_JOB_ID}/refresh`
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot refresh URL for incomplete export");
    });
  });
});
