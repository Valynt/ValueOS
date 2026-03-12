import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvalidateEndpoint, mockGetOrLoad } = vi.hoisted(() => ({
  mockInvalidateEndpoint: vi.fn().mockResolvedValue(0),
  mockGetOrLoad: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../services/ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: mockInvalidateEndpoint,
    getOrLoad: mockGetOrLoad,
  },
}));

vi.mock("../../lib/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("../../middleware/rateLimiter.js", () => ({
  createRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/auth.js", () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../analytics/ValueLoopAnalytics.js", () => ({
  ValueLoopAnalytics: { record: vi.fn(), getInsights: vi.fn() },
  RecordEventInputSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
}));

describe("public analytics telemetry routes", () => {
  let app: express.Application;

  beforeAll(async () => {
    const { default: analyticsRouter } = await import("../analytics.js");
    app = express();
    app.use(express.json());
    app.use("/api/analytics", analyticsRouter);
  });

  beforeEach(() => {
    mockInvalidateEndpoint.mockClear();
  });

  it("uses public cache scope for invalidation, not spoofed x-tenant-id", async () => {
    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("x-tenant-id", "spoofed-tenant")
      .send({ name: "LCP", value: 900 });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-tenant", "api-analytics-summary");
  });

  it("uses public cache scope for performance invalidation, not spoofed x-organization-id", async () => {
    const response = await request(app)
      .post("/api/analytics/performance")
      .set("x-organization-id", "spoofed-org")
      .send({ type: "paint", data: { duration: 11 } });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-org", "api-analytics-summary");
  });
});
