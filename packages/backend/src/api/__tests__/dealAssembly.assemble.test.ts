import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecuteWorkflow = vi.fn();
const mockAssertCaseReadable = vi.fn();
const mockLogImmediate = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const tenantId = req.header("x-test-tenant-id") ?? "org-1";
    req.tenantId = tenantId;
    req.organizationId = tenantId;
    req.userId = "user-1";
    req.requestId = "req-123";
    req.sessionId = "sess-1";
    req.supabase = {} as never;
    next();
  },
}));

vi.mock("../../runtime/execution-runtime/index.js", () => ({
  createExecutionRuntime: () => ({
    executeWorkflow: mockExecuteWorkflow,
  }),
}));

vi.mock("../../services/security/AuditTrailService.js", () => ({
  getAuditTrailService: () => ({
    logImmediate: mockLogImmediate,
  }),
}));

vi.mock("../../services/value/RequestScopedValueCaseAccessService.js", () => ({
  RequestScopedValueCaseAccessService: class {
    async assertCaseReadable(...args: unknown[]) {
      return mockAssertCaseReadable(...args);
    }
  },
}));

vi.mock("../../services/deal/DealAssemblyService", () => ({
  DealAssemblyService: class {
    async getContext() {
      return null;
    }
    async fillGap() {
      return undefined;
    }
    async confirmAssembly() {
      return undefined;
    }
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import dealAssemblyRouter from "../dealAssembly";

describe("POST /api/cases/:caseId/assemble", () => {
  const app = express();
  app.use(express.json());
  app.use("/api", dealAssemblyRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCaseReadable.mockResolvedValue({ id: "case-1", status: "draft" });
    mockExecuteWorkflow.mockResolvedValue({
      executionId: "wf-exec-123",
      status: "initiated",
      currentStage: "crm_ingestion",
      completedStages: [],
    });
    mockLogImmediate.mockResolvedValue("audit-1");
  });

  it("returns accepted with a persisted workflow execution id and running status", async () => {
    const response = await request(app)
      .post("/api/cases/45b4d4bf-c8ea-44b2-a3f2-b9169302b649/assemble")
      .send({
        opportunity_id: "125ef0ce-ce7d-4c70-8bc8-c2812b88e7e3",
      });

    expect(response.status).toBe(202);
    expect(response.body.job_id).toBe("wf-exec-123");
    expect(response.body.status).toBe("running");
    expect(mockExecuteWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        entryPoint: "api.dealAssembly.assemble",
      }),
      "deal-assembly-v1",
      expect.objectContaining({
        tenantId: "org-1",
        organizationId: "org-1",
        caseId: "45b4d4bf-c8ea-44b2-a3f2-b9169302b649",
      }),
      "user-1",
    );
    expect(mockLogImmediate).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "req-123",
        details: expect.objectContaining({
          workflowJobId: "wf-exec-123",
          requestId: "req-123",
        }),
      }),
    );
  });

  it("denies case access when tenant context does not match case visibility", async () => {
    mockAssertCaseReadable.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/cases/45b4d4bf-c8ea-44b2-a3f2-b9169302b649/assemble")
      .set("x-test-tenant-id", "org-2")
      .send({
        opportunity_id: "125ef0ce-ce7d-4c70-8bc8-c2812b88e7e3",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("tenant_mismatch");
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  it("returns enqueue failure when orchestration runtime cannot start workflow", async () => {
    mockExecuteWorkflow.mockRejectedValue(new Error("queue unavailable"));

    const response = await request(app)
      .post("/api/cases/45b4d4bf-c8ea-44b2-a3f2-b9169302b649/assemble")
      .send({
        opportunity_id: "125ef0ce-ce7d-4c70-8bc8-c2812b88e7e3",
      });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("workflow_enqueue_failed");
    expect(response.body.request_id).toBe("req-123");
  });
});
