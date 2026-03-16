import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/secureRouter.js", () => ({
  createSecureRouter: () => {
    const r = express.Router();
    return r;
  },
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = "tenant-test-123";
    next();
  },
}));

vi.mock("../../services/security/AuditLogService.js", () => ({
  auditLogService: {
    query: vi.fn(),
  },
}));

import { auditLogService } from "../../services/security/AuditLogService.js";
import { auditLogsRouter } from "../auditLogs.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/audit-logs", auditLogsRouter);
  return app;
}

const SAMPLE_ENTRIES = [
  { id: "1", timestamp: "2026-01-01T10:00:00Z", action: "agent.llm_invocation", resource_type: "agent_session", resource_id: "sess-1", user_id: "user-1", user_email: "a@b.com", tenant_id: "tenant-test-123" },
  { id: "2", timestamp: "2026-01-01T09:00:00Z", action: "agent.veto_decision", resource_type: "value_case", resource_id: "case-1", user_id: "user-2", user_email: "c@d.com", tenant_id: "tenant-test-123" },
];

describe("GET /api/v1/audit-logs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated audit log entries for the tenant", async () => {
    vi.mocked(auditLogService.query).mockResolvedValue(SAMPLE_ENTRIES as never);

    const res = await request(buildApp()).get("/api/v1/audit-logs");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.has_next_page).toBe(false);
    expect(res.body.pagination.next_cursor).toBeNull();
  });

  it("passes tenantId to AuditLogService.query", async () => {
    vi.mocked(auditLogService.query).mockResolvedValue([]);

    await request(buildApp()).get("/api/v1/audit-logs");

    expect(auditLogService.query).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-test-123" }),
    );
  });

  it("filters by action when provided", async () => {
    vi.mocked(auditLogService.query).mockResolvedValue([]);

    await request(buildApp()).get("/api/v1/audit-logs?action=agent.veto_decision");

    expect(auditLogService.query).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.veto_decision" }),
    );
  });

  it("sets has_next_page true when results exceed limit", async () => {
    // Return limit+1 entries to trigger next-page detection
    const many = Array.from({ length: 51 }, (_, i) => ({ ...SAMPLE_ENTRIES[0], id: String(i) }));
    vi.mocked(auditLogService.query).mockResolvedValue(many as never);

    const res = await request(buildApp()).get("/api/v1/audit-logs?limit=50");

    expect(res.body.pagination.has_next_page).toBe(true);
    expect(res.body.data).toHaveLength(50);
    expect(res.body.pagination.next_cursor).toBeDefined();
  });

  it("returns 400 for invalid limit", async () => {
    const res = await request(buildApp()).get("/api/v1/audit-logs?limit=abc");
    expect(res.status).toBe(400);
  });
});
