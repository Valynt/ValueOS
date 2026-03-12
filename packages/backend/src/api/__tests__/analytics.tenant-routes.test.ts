import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRecord, mockGetInsights, mockSafeParse } = vi.hoisted(() => ({
  mockRecord: vi.fn().mockResolvedValue(undefined),
  mockGetInsights: vi.fn().mockResolvedValue({}),
  mockSafeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
}));

vi.mock("../../services/ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: vi.fn().mockResolvedValue(0),
    getOrLoad: vi.fn().mockResolvedValue({ success: true }),
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
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => {
    (_req as { user?: { id: string } }).user = { id: "user-1" };
    next();
  },
}));

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware: () => (req: unknown, _res: unknown, next: () => void) => {
    (req as { tenantId?: string }).tenantId = "tenant-a";
    next();
  },
}));

vi.mock("../../analytics/ValueLoopAnalytics.js", () => ({
  ValueLoopAnalytics: { record: mockRecord, getInsights: mockGetInsights },
  RecordEventInputSchema: { safeParse: mockSafeParse },
}));

describe("tenant analytics routes", () => {
  let app: express.Application;

  beforeAll(async () => {
    const { default: analyticsRouter } = await import("../analytics.js");
    app = express();
    app.use(express.json());
    app.use("/api/analytics", analyticsRouter);
  });

  beforeEach(() => {
    mockRecord.mockClear();
    mockSafeParse.mockClear();
  });

  it("rejects payload organizationId mismatch against req.tenantId", async () => {
    const response = await request(app)
      .post("/api/analytics/value-loop/events")
      .send({ organizationId: "tenant-b", eventType: "opportunity.updated" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Tenant context mismatch" });
    expect(mockSafeParse).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
