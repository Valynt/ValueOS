import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { complianceFrameworkCapabilityGate } from "../../services/security/ComplianceFrameworkCapabilityGate.js";

function setHipaaSupport(enabled: boolean): void {
  const value = enabled ? "true" : undefined;

  process.env.HIPAA_PHI_DATA_CLASSIFICATION_ENABLED = value;
  process.env.HIPAA_DISCLOSURE_ACCOUNTING_AND_AUDIT_RETENTION_ENABLED = value;
  process.env.HIPAA_PHI_STORE_AND_BACKUP_ENCRYPTION_ENABLED = value;
  process.env.HIPAA_BREAK_GLASS_ACCESS_LOGGING_ENABLED = value;
  process.env.HIPAA_RETENTION_AND_DELETION_POLICIES_DOCUMENTED = value;
}

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const typedReq = req as express.Request & { user: { id: string; permissions: string[] } };
    typedReq.user = { id: "user-1", permissions: ["compliance.read"] };
    next();
  },
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const typedReq = req as express.Request & { tenantId: string };
    typedReq.tenantId = "tenant-1";
    next();
  },
}));

vi.mock("../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../services/integrity/ComplianceControlStatusService.js", () => ({
  complianceControlStatusService: {
    getLatestControlStatus: vi.fn().mockResolvedValue([]),
    summarize: vi.fn().mockReturnValue({}),
    refreshControlStatus: vi.fn().mockResolvedValue([]),
    getPolicyHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../services/integrity/ComplianceReportGeneratorService.js", () => ({
  MissingEvidenceError: class MissingEvidenceError extends Error {},
  complianceReportGeneratorService: {
    generateReport: vi.fn(),
    getReportById: vi.fn(),
    auditDownloadAccess: vi.fn(),
  },
}));

vi.mock("../../services/AuditLogService.js", () => ({
  auditLogService: {
    query: vi.fn().mockResolvedValue([]),
    createEntry: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../services/security/ComplianceControlCheckService.js", () => ({
  complianceControlCheckService: {
    getLatestStatus: vi.fn().mockResolvedValue(null),
    runChecksForTenant: vi.fn().mockResolvedValue({}),
  },
}));

import complianceRouter from "../compliance.js";

describe("GET /api/admin/compliance/mode contract", () => {
  afterEach(() => {
    setHipaaSupport(false);
  });

  it("returns frontend-selectable modes from the capability gate and marks gated HIPAA prerequisites", async () => {
    const app = express();
    app.use("/api/admin/compliance", complianceRouter);

    const response = await request(app).get("/api/admin/compliance/mode");

    expect(response.status).toBe(200);
    expect(response.body.active_modes).toEqual(complianceFrameworkCapabilityGate.getExposedFrameworks());

    const hipaaStatus = response.body.framework_statuses.find(
      (status: { framework: string }) => status.framework === "HIPAA",
    );

    expect(hipaaStatus).toMatchObject({
      framework: "HIPAA",
      availability: "gated",
      selectable: false,
      prerequisites_met: false,
    });
    expect(hipaaStatus.missing_prerequisites).toEqual(
      complianceFrameworkCapabilityGate.getCapabilityStatus("HIPAA").missingPrerequisites,
    );
  });

  it("adds HIPAA to selectable modes once every prerequisite is satisfied", async () => {
    setHipaaSupport(true);

    const app = express();
    app.use("/api/admin/compliance", complianceRouter);

    const response = await request(app).get("/api/admin/compliance/mode");

    expect(response.status).toBe(200);
    expect(response.body.active_modes).toContain("HIPAA");
    expect(response.body.active_modes).toEqual(complianceFrameworkCapabilityGate.getExposedFrameworks());

    const hipaaStatus = response.body.framework_statuses.find(
      (status: { framework: string }) => status.framework === "HIPAA",
    );

    expect(hipaaStatus).toMatchObject({
      framework: "HIPAA",
      availability: "available",
      selectable: true,
      prerequisites_met: true,
      missing_prerequisites: [],
    });
  });
});
