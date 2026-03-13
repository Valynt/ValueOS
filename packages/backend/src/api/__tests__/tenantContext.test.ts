/**
 * Integration tests for POST/GET /api/v1/tenant/context
 */

import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/tenant/TenantContextIngestionService.js", () => ({
  TenantContextPayloadSchema: {
    safeParse: (body: unknown) => {
      const b = body as Record<string, unknown>;
      if (!b || typeof b !== "object" || !Array.isArray(b.products)) {
        return { success: false, error: { errors: [{ message: "products required" }] } };
      }
      return { success: true, data: b };
    },
  },
  tenantContextIngestionService: {
    ingest: vi.fn().mockResolvedValue({ memoryEntries: 3, status: "ok" }),
    getSummary: vi.fn().mockResolvedValue({ products: ["ProductA"], icps: [] }),
  },
}));

vi.mock("../../middleware/auditHooks.js", () => ({
  auditOperation: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { tenantId?: string };
    if (!r.tenantId) return res.status(401).json({ error: "Unauthorized" });
    next();
  },
}));

// Mirror USER_ROLE_PERMISSIONS: admin has all permissions; member/viewer have settings:view only.
const ROLE_GRANTS: Record<string, string[]> = {
    const r = req as Request & { user?: { role: string; permissions?: string[] } };
    const permissions = r.user?.permissions ?? [];
    if (!permissions.includes(required)) {
  viewer: ["settings:view"],
};

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: (required: string) => (req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { user?: { role: string } };
    const granted = ROLE_GRANTS[r.user?.role ?? ""] ?? [];
    if (!granted.includes(required)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  },
}));
    const r = req as Request & {
      tenantId: string;
      user: { id: string; role: string; permissions: string[] };
    };
const { tenantContextRouter } = await import("../tenantContext.js");
    const permissionsByRole: Record<"admin" | "viewer", string[]> = {
      admin: ["tenant:context:read", "tenant:context:write"],
      viewer: ["tenant:context:read"],
    };
    r.user = { id: "user-123", role, permissions: permissionsByRole[role as "admin" | "viewer"] };
function buildApp(role: "admin" | "viewer" | "none") {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (role === "none") return next();
    const r = req as Request & { tenantId: string; user: { id: string; role: string } };
    r.tenantId = "tenant-abc";
    r.user = { id: "user-123", role };
    next();
  });
  app.use("/api/v1/tenant/context", tenantContextRouter);
  return app;
}

describe("POST /api/v1/tenant/context", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 and calls ingest() with tenantId for admin", async () => {
    const { tenantContextIngestionService } = await import(
      "../../services/tenant/TenantContextIngestionService.js"
    );
    const res = await request(buildApp("admin"))
      .post("/api/v1/tenant/context")
      .send({ products: ["ProductA"], icps: ["SMB"], competitors: [], personas: [] })
      .expect(200);

    expect(res.body.memoryEntries).toBe(3);
    expect(tenantContextIngestionService.ingest).toHaveBeenCalledWith(
      "tenant-abc",
      expect.objectContaining({ products: ["ProductA"] })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    await request(buildApp("none"))
      .post("/api/v1/tenant/context")
      .send({ products: ["ProductA"] })
      .expect(401);
  });

  it("returns 403 for viewer role", async () => {
    await request(buildApp("viewer"))
      .post("/api/v1/tenant/context")
      .send({ products: ["ProductA"] })
      .expect(403);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await request(buildApp("admin"))
      .post("/api/v1/tenant/context")
      .send({ notProducts: true })
      .expect(400);
    expect(res.body.error).toBe("Invalid request");
  });
});

describe("GET /api/v1/tenant/context", () => {
  it("returns 200 with context summary for viewer", async () => {
    const res = await request(buildApp("viewer"))
      .get("/api/v1/tenant/context")
      .expect(200);
    expect(res.body.data.products).toContain("ProductA");
  });
});
