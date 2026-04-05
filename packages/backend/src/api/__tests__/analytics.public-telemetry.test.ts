import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInvalidateEndpoint,
  mockGetOrLoad,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockInvalidateEndpoint: vi.fn().mockResolvedValue(0),
  mockGetOrLoad: vi.fn().mockResolvedValue({ success: true }),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("../../services/cache/ReadThroughCacheService.js", () => ({
  ReadThroughCacheService: {
    invalidateEndpoint: mockInvalidateEndpoint,
    getOrLoad: mockGetOrLoad,
  },
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  }),
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

async function makeApp(): Promise<express.Application> {
  const { default: analyticsRouter } = await import("../analytics.js");
  const app = express();
  app.use(express.json());
  app.use("/api/analytics", analyticsRouter);
  return app;
}

describe("public analytics telemetry routes", () => {
  const originalTelemetryKey = process.env.BROWSER_TELEMETRY_INGESTION_KEY;
  const originalTelemetryOrigins = process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS;
  const originalHashSalt = process.env.TELEMETRY_LOG_HASH_SALT;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockInvalidateEndpoint.mockClear();
    mockGetOrLoad.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    delete process.env.BROWSER_TELEMETRY_INGESTION_KEY;
    delete process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS;
    process.env.TELEMETRY_LOG_HASH_SALT = "unit-test-hash-salt";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalTelemetryKey === undefined) {
      delete process.env.BROWSER_TELEMETRY_INGESTION_KEY;
    } else {
      process.env.BROWSER_TELEMETRY_INGESTION_KEY = originalTelemetryKey;
    }
    if (originalTelemetryOrigins === undefined) {
      delete process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS;
    } else {
      process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS = originalTelemetryOrigins;
    }
    if (originalHashSalt === undefined) {
      delete process.env.TELEMETRY_LOG_HASH_SALT;
    } else {
      process.env.TELEMETRY_LOG_HASH_SALT = originalHashSalt;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("uses public cache scope for invalidation, not spoofed x-tenant-id", async () => {
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("x-tenant-id", "spoofed-tenant")
      .send({ name: "LCP", value: 900 });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-tenant", "api-analytics-summary");
  });

  it("uses public cache scope for performance invalidation, not spoofed x-organization-id", async () => {
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/performance")
      .set("x-organization-id", "spoofed-org")
      .send({ type: "paint", data: { duration: 11 } });

    expect(response.status).toBe(200);
    expect(mockInvalidateEndpoint).toHaveBeenCalledWith("public-telemetry", "api-analytics-summary");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalledWith("spoofed-org", "api-analytics-summary");
  });

  it("rejects unexpected fields in web vitals payloads", async () => {
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP", value: 900, unexpected: "field" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid telemetry payload");
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
  });

  it("rejects oversized user agents and invalid performance field types", async () => {
    const app = await makeApp();

    const tooLongUserAgent = "u".repeat(257);
    const webVitalsResponse = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP", value: 1200, userAgent: tooLongUserAgent });

    expect(webVitalsResponse.status).toBe(400);

    const performanceResponse = await request(app)
      .post("/api/analytics/performance")
      .send({ type: "paint", data: { duration: "11ms" } });

    expect(performanceResponse.status).toBe(400);
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
  });

  it("rejects log-injection strings in metric names and event types", async () => {
    const app = await makeApp();

    const webVitalsResponse = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP\nforged-entry", value: 700 });

    expect(webVitalsResponse.status).toBe(400);

    const performanceResponse = await request(app)
      .post("/api/analytics/performance")
      .send({ type: "paint\r\nspoof", data: { duration: 10 } });

    expect(performanceResponse.status).toBe(400);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("logs only hashed or reduced browser metadata for web vitals", async () => {
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("User-Agent", "Browser/1.0 telemetry-test")
      .set("Referer", "https://valueos.example/app/dashboard?token=secret")
      .send({
        name: "LCP",
        value: 1234.5678,
        delta: 12.3456,
        url: "https://valueos.example/app/dashboard?token=secret",
        userAgent: "Browser/1.0 telemetry-test",
      });

    expect(response.status).toBe(200);
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);

    const [, logContext] = mockLoggerInfo.mock.calls[0] as [string, Record<string, unknown>];
    expect(logContext.metricName).toBe("LCP");
    expect(logContext.value).toBe(1234.568);
    expect(logContext.delta).toBe(12.346);
    expect(logContext.sourceOrigin).toBe("https://valueos.example");
    expect(logContext.userAgentHash).toEqual(expect.any(String));
    expect(logContext.ipHash).toEqual(expect.any(String));
    expect(logContext.userAgentLength).toBe(26);
    expect(logContext).not.toHaveProperty("ip");
    expect(logContext).not.toHaveProperty("userAgent");
    expect(logContext).not.toHaveProperty("url");
  });

  it("requires a dedicated telemetry ingestion key when configured", async () => {
    process.env.BROWSER_TELEMETRY_INGESTION_KEY = "browser-telemetry-secret";
    const app = await makeApp();

    const missingKeyResponse = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP", value: 900 });

    expect(missingKeyResponse.status).toBe(401);

    const successResponse = await request(app)
      .post("/api/analytics/web-vitals")
      .set("x-telemetry-key", "browser-telemetry-secret")
      .send({ name: "LCP", value: 900 });

    expect(successResponse.status).toBe(200);
  });

  it("allows telemetry in non-secure envs when TELEMETRY_LOG_HASH_SALT is missing", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.TELEMETRY_LOG_HASH_SALT;
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .send({ name: "LCP", value: 900 });

    expect(response.status).toBe(200);
  });

  it("rejects browser telemetry in staging when ingestion key configuration is missing", async () => {
    process.env.NODE_ENV = "staging";
    process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS = "https://app.valueos.example";
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("Origin", "https://app.valueos.example")
      .send({ name: "LCP", value: 900 });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Telemetry key required");
  });

  it("fails fast in staging when TELEMETRY_LOG_HASH_SALT is missing", async () => {
    process.env.NODE_ENV = "staging";
    process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS = "https://app.valueos.example";
    delete process.env.TELEMETRY_LOG_HASH_SALT;
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/web-vitals")
      .set("Origin", "https://app.valueos.example")
      .send({ name: "LCP", value: 900 });

    expect(response.status).toBe(500);
  });

  it("rejects browser telemetry from disallowed origins when an allowlist is configured", async () => {
    process.env.BROWSER_TELEMETRY_ALLOWED_ORIGINS = "https://app.valueos.example";
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/performance")
      .set("Origin", "https://evil.example")
      .send({ type: "paint", data: { duration: 15 } });

    expect(response.status).toBe(403);
    expect(mockInvalidateEndpoint).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it("rejects browser telemetry in staging when allowed origins configuration is missing", async () => {
    process.env.NODE_ENV = "staging";
    process.env.BROWSER_TELEMETRY_INGESTION_KEY = "browser-telemetry-secret";
    const app = await makeApp();

    const response = await request(app)
      .post("/api/analytics/performance")
      .set("x-telemetry-key", "browser-telemetry-secret")
      .set("Origin", "https://app.valueos.example")
      .send({ type: "paint", data: { duration: 15 } });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Origin not allowed for browser telemetry");
  });
});
