import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const permissionHeader = req.header("x-test-permissions") ?? "";
    (req as express.Request & { user: { id: string; email: string; permissions: string[] } }).user = {
      id: "user-1",
      email: "user@example.com",
      permissions: permissionHeader.split(",").filter(Boolean),
    };
    next();
  },
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { tenantId: string }).tenantId = "tenant-1";
    next();
  },
}));

vi.mock("../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission:
    (permission: string) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const typedReq = req as express.Request & { user?: { permissions?: string[] } };
      if (!typedReq.user?.permissions?.includes(permission)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    },
  requireAllPermissions:
    (...permissions: string[]) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const typedReq = req as express.Request & { user?: { permissions?: string[] } };
      const granted = typedReq.user?.permissions ?? [];
      if (!permissions.every((permission) => granted.includes(permission))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    },
}));

vi.mock("../../services/AuditLogService.js", () => ({
  auditLogService: {
    query: vi.fn().mockResolvedValue([]),
    logAudit: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../services/ComplianceControlStatusService.js", () => ({
  complianceControlStatusService: {
    getLatestControlStatus: vi.fn().mockResolvedValue([]),
    summarize: vi.fn().mockReturnValue({}),
    refreshControlStatus: vi.fn().mockResolvedValue([]),
    getPolicyHistory: vi.fn().mockResolvedValue([]),
  },
}));

import adminRouter from "../admin.js";
import complianceRouter from "../compliance.js";

describe("audit/compliance authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forbids admin audit logs endpoint without audit.read", async () => {
    const app = express();
    app.use("/api/admin", adminRouter);

    const response = await request(app).get("/api/admin/audit-logs");

    expect(response.status).toBe(403);
  });

  it("allows admin audit logs endpoint with audit.read", async () => {
    const app = express();
    app.use("/api/admin", adminRouter);

    const response = await request(app)
      .get("/api/admin/audit-logs")
      .set("x-test-permissions", "audit.read");

    expect(response.status).toBe(200);
  });

  it("forbids compliance control status without compliance.read", async () => {
    const app = express();
    app.use("/api/admin/compliance", complianceRouter);

    const response = await request(app).get("/api/admin/compliance/control-status");

    expect(response.status).toBe(403);
  });

  it("allows compliance control status with compliance.read", async () => {
    const app = express();
    app.use("/api/admin/compliance", complianceRouter);

    const response = await request(app)
      .get("/api/admin/compliance/control-status")
      .set("x-test-permissions", "compliance.read");

    expect(response.status).toBe(200);
  });
});
