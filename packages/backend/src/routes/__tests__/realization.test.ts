import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetBaseline } = vi.hoisted(() => ({
  mockGetBaseline: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  authenticate: (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.header("authorization");

    if (!authorization) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.user = {
      id: "user-123",
      tenant_id: authorization === "Bearer tenant-b-token" ? "tenant-b" : "tenant-a",
    };
    next();
  },
}));

vi.mock("../../middleware/tenantContext", () => ({
  tenantContextMiddleware: () => (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      return res.status(403).json({
        error: "tenant_required",
        message: "Tenant context is required.",
      });
    }

    req.tenantId = tenantId;
    next();
  },
}));

vi.mock("../../services/realization/RealizationService.js", () => ({
  RealizationService: class {
    getBaseline = mockGetBaseline;
  },
}));

import realizationRouter from "../realization";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(realizationRouter);
  return app;
};

describe("realization baseline route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBaseline.mockImplementation(async (caseId: string, tenantId: string) => {
      if (caseId === "case-123" && tenantId === "tenant-a") {
        return {
          id: "baseline-123",
          case_id: caseId,
          organization_id: tenantId,
          scenario_id: "scenario-123",
          scenario_name: "Best case",
          approval_date: "2026-01-01T00:00:00.000Z",
          kpi_targets: [],
          assumptions: [],
          handoff_notes: {},
        };
      }

      return null;
    });
  });

  it("denies unauthenticated requests", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/cases/case-123/realization/baseline");

    expect(response.status).toBe(401);
    expect(mockGetBaseline).not.toHaveBeenCalled();
  });

  it("does not return another tenant's baseline", async () => {
    const app = buildApp();

    const response = await request(app)
      .get("/api/cases/case-123/realization/baseline")
      .set("Authorization", "Bearer tenant-b-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Baseline not found for this case" },
    });
    expect(mockGetBaseline).toHaveBeenCalledWith("case-123", "tenant-b");
  });
});
