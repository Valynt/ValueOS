import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/secureRouter.js", async () => {
  const express = await import("express");
  return { createSecureRouter: () => express.Router() };
});

import express from "express";
import request from "supertest";

// ... mock DSR mapped assets to return many assets to amplify N+1 issue
vi.mock("../../observability/dataAssetInventoryRegistry.js", () => ({
  getDsrMappedPiiAssets: () => {
    return Array.from({ length: 100 }, (_, i) => ({
      asset: `table_${i}`,
      dsr: {
        exportable: true,
        userColumn: "user_id",
        tenantColumn: "tenant_id",
        erasure: "delete"
      }
    }));
  }
}));

function makeSelectBuilder(result) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function makeInsertBuilder(insertSpy) {
  return {
    insert: insertSpy,
  };
}

async function makeApp(reqOverrides = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    Object.assign(req, { tenantId: "tenant-abc", requestId: "req-001", ...reqOverrides });
    next();
  });

  const { default: dsrRouter } = await import("../dataSubjectRequests.js");
  app.use("/api/dsr", dsrRouter);
  return app;
}

describe("DSR Performance", () => {
  it("measures export time", async () => {
    // Add artificial delay to supabase mock
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "users") {
        return makeSelectBuilder({ data: { id: "user-123" }, error: null });
      }
      if (table === "security_audit_log") {
        return makeInsertBuilder(auditInsert);
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(async (cb) => {
          await new Promise(r => setTimeout(r, 10)); // 10ms per query
          return cb({ data: [{ id: 1 }], error: null });
        })
      };
    });

    const mockSupabase = { from } as any;

    const app = await makeApp({ userId: "actor-123", supabase: mockSupabase });

    const start = performance.now();
    const res = await request(app)
      .post("/api/dsr/export")
      .send({ email: "user@example.com" });
    const end = performance.now();

    console.log(`DSR Export completed in ${end - start}ms`);
    expect(res.status).toBe(200);
  });
});
