import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { tenantContextMiddleware } from "../tenantContext";
import { tenantDbContextMiddleware } from "../tenantDbContext";
import { getDatabaseUrl } from "../../config/database";

const testTenantId = "00000000-0000-0000-0000-000000000001";

vi.mock("@shared/lib/tenantVerification", () => ({
  getUserTenantId: vi.fn().mockResolvedValue(null),
  verifyTenantExists: vi.fn().mockResolvedValue(true),
  verifyTenantMembership: vi.fn().mockResolvedValue(true),
}));

const app = express();
app.use((req, _res, next) => {
  (req as any).user = {
    id: "user-123",
    tenant_id: testTenantId,
    role: "admin",
  };
  next();
});

app.get(
  "/api/test/tenant-context",
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  async (req, res) => {
    const db = (req as any).db as { query: (query: string) => Promise<{ rows: any[] }> };
    const result = await db.query("SELECT security.current_tenant_id_uuid() AS tenant_id;");
    res.json({ tenantId: result.rows[0]?.tenant_id });
  }
);

describe("tenantDbContextMiddleware integration", () => {
  it("sets app.tenant_id inside the request transaction", async () => {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      console.warn("DATABASE_URL not set, skipping tenant DB context integration test");
      return;
    }

    const response = await request(app).get("/api/test/tenant-context").expect(200);

    expect(response.body.tenantId).toBe(testTenantId);
  });
});
