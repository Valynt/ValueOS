import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetBaseline } = vi.hoisted(() => ({
  mockGetBaseline: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    next();
  },
}));

vi.mock("../../middleware/tenantContext", () => ({
  tenantContextMiddleware: () => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const tenantIdHeader = req.header("x-test-tenant-id");

    if (!tenantIdHeader) {
      res.status(403).json({
        error: "tenant_required",
        message: "Tenant context is required.",
      });
      return;
    }

    req.tenantId = tenantIdHeader;
    next();
  },
}));

vi.mock("../../services/realization/RealizationService.js", () => ({
  RealizationService: class {
    getBaseline = mockGetBaseline;
  },
}));

import realizationRouter from "../realization";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(realizationRouter);
  return app;
}

describe("realization baseline route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBaseline.mockResolvedValue({
      id: "baseline-1",
      case_id: "case-123",
      organization_id: "tenant-a",
      scenario_id: "scenario-1",
      scenario_name: "Committed",
      approval_date: "2026-01-01T00:00:00.000Z",
      kpi_targets: [],
      assumptions: [],
      handoff_notes: {},
    });
  });

  it("denies unauthenticated baseline requests", async () => {
    const app = makeApp();

    const response = await request(app).get("/api/cases/case-123/realization/baseline");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Authentication required" });
    expect(mockGetBaseline).not.toHaveBeenCalled();
  });

  it("does not return baseline data across tenants", async () => {
    mockGetBaseline.mockImplementation(async (_caseId: string, organizationId: string) => {
      if (organizationId === "tenant-a") {
        return {
          id: "baseline-1",
          case_id: "case-123",
          organization_id: "tenant-a",
          scenario_id: "scenario-1",
          scenario_name: "Committed",
          approval_date: "2026-01-01T00:00:00.000Z",
          kpi_targets: [],
          assumptions: [],
          handoff_notes: {},
        };
      }

      return null;
    });

    const app = makeApp();

    const response = await request(app)
      .get("/api/cases/case-123/realization/baseline")
      .set("Authorization", "Bearer test-token")
      .set("x-test-tenant-id", "tenant-b");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Baseline not found for this case" },
    });
    expect(mockGetBaseline).toHaveBeenCalledWith("case-123", "tenant-b");
  });

  it("returns 403 when tenant context is missing after authentication", async () => {
    const app = makeApp();

    const response = await request(app)
      .get("/api/cases/case-123/realization/baseline")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "tenant_required",
      message: "Tenant context is required.",
    });
    expect(mockGetBaseline).not.toHaveBeenCalled();
  });
});
