import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tenantContextMiddleware } from "../../middleware/tenantContext.js";

const tenantVerificationMocks = vi.hoisted(() => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock("@shared/lib/tenantVerification", () => tenantVerificationMocks);

const ORIGINAL_ENV = { ...process.env };

describe("Agent API tenant context integration", () => {
  let app: express.Express;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test", TCT_SECRET: "test-secret" };

    app = express();
    app.use(express.json());

    app.use("/api/agents", (req, _res, next) => {
      (req as any).user = {
        id: "user-a",
        tenant_id: "tenant-a",
        role: "authenticated",
      };
      (req as any).tenantId = "tenant-a";
      (req as any).serviceIdentityVerified = req.header("x-service-verified") === "true";
      next();
    });

    app.use("/api/agents", tenantContextMiddleware(), (_req, res) => {
      res.status(200).json({ ok: true });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("denies cross-tenant service header overrides on agent endpoints", async () => {
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    const response = await request(app)
      .post("/api/agents/execute")
      .set("x-tenant-id", "tenant-b")
      .send({ action: "run" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Tenant header is restricted to internal service requests.",
    });
  });

  it("denies agent requests when verified internal header tenant diverges from JWT tenant", async () => {
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    const response = await request(app)
      .post("/api/agents/execute")
      .set("x-service-verified", "true")
      .set("x-tenant-id", "tenant-b")
      .send({ action: "run" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "tenant_mismatch",
      message: "Requested tenant does not match authenticated tenant.",
    });
  });
});
