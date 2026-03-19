import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockError,
  mockGetOrLoad,
  mockInfo,
  mockInvalidateEndpoint,
  mockWarn,
} = vi.hoisted(() => ({
  mockError: vi.fn(),
  mockGetOrLoad: vi.fn().mockResolvedValue({ success: true }),
  mockInfo: vi.fn(),
  mockInvalidateEndpoint: vi.fn().mockResolvedValue(0),
  mockWarn: vi.fn(),
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ info: mockInfo, warn: mockWarn, error: mockError, debug: vi.fn() }),
}));

vi.mock("../../services/cache/ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: mockInvalidateEndpoint,
    getOrLoad: mockGetOrLoad,
  },
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
    app.use("/api/analytics", analyticsRouter);
  });

  beforeEach(() => {
    mockError.mockClear();
    mockInfo.mockClear();
    mockInvalidateEndpoint.mockClear();
    mockWarn.mockClear();
    delete process.env.PUBLIC_TELEMETRY_INGESTION_TOKEN;
    delete process.env.PUBLIC_TELEMETRY_ALLOWED_ORIGINS;
  });

  it("uses public cache scope for invalidation, not spoofed x-tenant-id", async () => {
    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("x-tenant-id", "spoofed-tenant")
      .set("user-agent", "test-browser/1.0")
      .set("referer", "https://valueos.example/dashboard?tenant=spoofed")
      .send({
        name: "LCP",
        value: 900,
        rating: "good",
        delta: 12,
        url: "https://valueos.example/dashboard?customer=acme",
        userAgent: "Mozilla/5.0 telemetry",
        timestamp: "2026-03-19T00:00:00.000Z",
      });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-tenant", "api-analytics-summary");

    expect(mockInfo).toHaveBeenCalledWith(
      "Web Vital recorded",
      expect.objectContaining({
        name: "LCP",
        value: 900,
        rating: "good",
        delta: 12,
        userAgentHash: expect.stringMatching(/^[a-f0-9]{16}$/),
        urlHash: expect.stringMatching(/^[a-f0-9]{16}$/),
        referrerHash: expect.stringMatching(/^[a-f0-9]{16}$/),
        ipHash: expect.stringMatching(/^[a-f0-9]{16}$/),
      }),
    );

    const [, loggedContext] = mockInfo.mock.calls[0] as [string, Record<string, unknown>];
    expect(loggedContext.userAgent).toBeUndefined();
    expect(loggedContext.url).toBeUndefined();
    expect(loggedContext.referrer).toBeUndefined();
    expect(loggedContext.userAgentHash).not.toBe("Mozilla/5.0 telemetry");
  });

  it("rejects unexpected fields on web-vitals payloads", async () => {
    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP", value: 1200, entries: [{ name: "secret" }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid payload");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it("rejects invalid types and log-injection strings on performance payloads", async () => {
    const invalidTypeResponse = await request(app)
      .post("/api/analytics/performance")
      .send({ type: "paint\nWARN: spoof", data: { duration: 11 } });

    expect(invalidTypeResponse.status).toBe(400);
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();

    const invalidValueResponse = await request(app)
      .post("/api/analytics/performance")
      .send({ type: "paint", data: { duration: "11" } });

    expect(invalidValueResponse.status).toBe(400);
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it("rejects oversized field values before logging them", async () => {
    const oversizedUserAgent = "a".repeat(513);
    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "CLS", value: 0.2, userAgent: oversizedUserAgent });

    expect(response.status).toBe(400);
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
  });

  it("rejects payloads larger than the telemetry body limit", async () => {
    const response = await request(app)
      .post("/api/analytics/performance")
      .send({
        type: "paint",
        data: { metricName: "paint-time" },
        userAgent: "browser",
        url: `https://valueos.example/${"x".repeat(20_000)}`,
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "Telemetry payload too large" });
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
  });

  it("requires an ingestion token when configured", async () => {
    process.env.PUBLIC_TELEMETRY_INGESTION_TOKEN = "expected-token";

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "FID", value: 18 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Telemetry ingestion key required" });
    expect(mockWarn).toHaveBeenCalledWith(
      "Rejected public telemetry request",
      expect.objectContaining({ reason: "invalid_ingestion_token" }),
    );
  });

  it("enforces configured telemetry origins", async () => {
    process.env.PUBLIC_TELEMETRY_ALLOWED_ORIGINS = "https://telemetry.valueos.com";

    const response = await request(app)
      .post("/api/analytics/performance")
      .set("origin", "https://evil.example")
      .send({ type: "paint", data: { duration: 11 } });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Origin not allowed for telemetry ingestion" });
    expect(mockWarn).toHaveBeenCalledWith(
      "Rejected public telemetry request",
      expect.objectContaining({ reason: "origin_not_allowed" }),
    );
  });

  it("uses public cache scope for performance invalidation, not spoofed x-organization-id", async () => {
    const response = await request(app)
      .post("/api/analytics/performance")
      .set("x-organization-id", "spoofed-org")
      .send({
        type: "paint",
        data: { duration: 11, metricName: "paint-time" },
        timestamp: "2026-03-19T00:00:00.000Z",
      });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-org", "api-analytics-summary");
  });
});
