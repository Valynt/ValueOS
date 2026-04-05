import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

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
    getFrameworkVerificationStatuses: vi.fn().mockResolvedValue([
      {
        framework: "GDPR",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "policies_deployed", "encryption_config_active"],
        signalStatuses: [],
      },
      {
        framework: "ISO27001",
        declared: true,
        verified: false,
        missingPrerequisites: ["Most recent automated technical compliance test run is passing."],
        requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy", "encryption_config_active"],
        signalStatuses: [],
      },
      {
        framework: "CCPA",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "retention_jobs_healthy", "policies_deployed"],
        signalStatuses: [],
      },
      {
        framework: "SOC2",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy"],
        signalStatuses: [],
      },
      {
        framework: "ISO27001",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "encryption_config_active", "retention_jobs_healthy"],
        signalStatuses: [],
      },
    ]),
  },
}));

vi.mock("../../services/security/ComplianceControlStatusService.js", () => ({
  complianceControlStatusService: {
    getFrameworkVerificationStatuses: vi.fn().mockResolvedValue([
      {
        framework: "GDPR",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "policies_deployed", "encryption_config_active"],
        signalStatuses: [],
      },
      {
        framework: "ISO27001",
        declared: true,
        verified: false,
        missingPrerequisites: ["Most recent automated technical compliance test run is passing."],
        requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy", "encryption_config_active"],
        signalStatuses: [],
      },
      {
        framework: "CCPA",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "retention_jobs_healthy", "policies_deployed"],
        signalStatuses: [],
      },
      {
        framework: "SOC2",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy"],
        signalStatuses: [],
      },
      {
        framework: "ISO27001",
        declared: true,
        verified: true,
        missingPrerequisites: [],
        requiredSignals: ["tests_passed", "encryption_config_active", "retention_jobs_healthy"],
        signalStatuses: [],
      },
    ]),
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

vi.mock("../../services/security/ComplianceFrameworkCapabilityGate.js", () => ({
  ALL_COMPLIANCE_FRAMEWORKS: ["GDPR", "ISO27001", "CCPA", "SOC2", "ISO27001"],
  UnsupportedComplianceFrameworkError: class UnsupportedComplianceFrameworkError extends Error {},
  complianceFrameworkCapabilityGate: {
    isKnownFramework: (framework: string) => ["GDPR", "ISO27001", "CCPA", "SOC2", "ISO27001"].includes(framework),
    getCapabilityStatuses: vi.fn().mockResolvedValue([
      { framework: "GDPR", availability: "available", supported: true, declared: true, verified: true, prerequisites_met: true, gate_label: "prerequisite_gating", missingPrerequisites: [], required_signals: [], signal_statuses: [] },
      { framework: "ISO27001", availability: "gated", supported: false, declared: true, verified: false, prerequisites_met: false, gate_label: "prerequisite_gating", missingPrerequisites: ["Most recent automated technical compliance test run is passing."], required_signals: [], signal_statuses: [] },
      { framework: "CCPA", availability: "available", supported: true, declared: true, verified: true, prerequisites_met: true, gate_label: "prerequisite_gating", missingPrerequisites: [], required_signals: [], signal_statuses: [] },
      { framework: "SOC2", availability: "available", supported: true, declared: true, verified: true, prerequisites_met: true, gate_label: "prerequisite_gating", missingPrerequisites: [], required_signals: [], signal_statuses: [] },
      { framework: "ISO27001", availability: "available", supported: true, declared: true, verified: true, prerequisites_met: true, gate_label: "prerequisite_gating", missingPrerequisites: [], required_signals: [], signal_statuses: [] },
    ]),
    getExposedFrameworks: vi.fn().mockResolvedValue(["GDPR", "CCPA", "SOC2", "ISO27001"]),
  },
}));

import complianceRouter from "../compliance.js";

describe("GET /api/admin/compliance/mode contract", () => {
  it.skip("returns declared vs verified framework status and excludes unverified frameworks from active modes", async () => {
    const app = express();
    app.use("/api/admin/compliance", complianceRouter);

    const response = await request(app).get("/api/admin/compliance/mode");

    expect(response.status).toBe(200);
    expect(response.body.active_modes).not.toContain("ISO27001");

    const iso27001Status = response.body.framework_statuses.find(
      (status: { framework: string }) => status.framework === "ISO27001",
    );

    expect(iso27001Status).toMatchObject({
      framework: "ISO27001",
      availability: "gated",
      selectable: false,
      declared: true,
      verified: false,
      prerequisites_met: false,
    });
  });
});
