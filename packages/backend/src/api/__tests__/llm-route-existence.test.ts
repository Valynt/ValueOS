import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase.js");

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../middleware/tenantContext", () => ({
  tenantContextMiddleware: () => (_req: any, _res: any, next: any) => next(),
  tenantContextStorage: { getStore: vi.fn() },
  getCurrentTenantContext: vi.fn(),
}));

vi.mock("@shared/lib/tenantVerification", () => ({
  getUserTenantId: vi.fn().mockResolvedValue("tenant-123"),
  verifyTenantExists: vi.fn().mockResolvedValue(true),
  verifyTenantMembership: vi.fn().mockResolvedValue(true),
}));

describe("LLM route existence", () => {
  let app: typeof import("express").Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
    process.env.TCT_SECRET = process.env.TCT_SECRET || "test-tct-secret";
    process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost";
    process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "anon-key";

    const serverModule = await import("../../server");
    app = serverModule.default;
  });

  it("returns 401 for /api/llm/chat without auth", async () => {
    const response = await request(app)
      .post("/api/llm/chat")
      .send({ prompt: "Hello", model: "gpt-4" });

    expect(response.status).toBe(401);
  });

  it("returns 200/4xx for /api/llm/chat with auth", async () => {
    const token = jwt.sign(
      { sub: "user-123", email: "user@example.com", tenant_id: "tenant-123" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const response = await request(app)
      .post("/api/llm/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "Hello", model: "gpt-4" });

    expect(response.status).not.toBe(401);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });
});
