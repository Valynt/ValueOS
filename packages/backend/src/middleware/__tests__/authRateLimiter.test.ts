import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_CONFIGS,
  authRateLimiter,
  AuthRateLimitStore,
  authRateLimitStore,
  recordAuthFailure,
} from "../authRateLimiter.js";

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../lib/observability/index.js", () => ({
  createCounter: () => ({ inc: vi.fn() }),
}));

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    ip: overrides.ip ?? "10.0.0.1",
    socket: { remoteAddress: overrides.ip ?? "10.0.0.1" },
    path: overrides.path ?? "/login",
    body: overrides.body ?? {},
    method: "POST",
  };
}

function mockRes(): any {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string | number) => {
      headers[name] = String(value);
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("authRateLimiter", () => {
  let store: AuthRateLimitStore;

  beforeEach(() => {
    // Reset the store between tests by clearing internal maps
    authRateLimitStore._getIpRecords().clear();
    authRateLimitStore._getEmailRecords().clear();
  });

  it("allows requests under the limit", async () => {
    const limiter = authRateLimiter("login");
    const req = mockReq({ body: { email: "user@test.com" } });
    const res = mockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks requests exceeding IP limit", async () => {
    const limiter = authRateLimiter("login");
    const config = AUTH_CONFIGS.login;
    const next = vi.fn();

    // Exhaust the limit
    for (let i = 0; i < config.maxAttempts; i++) {
      const req = mockReq({ ip: "10.0.0.99", body: { email: `user${i}@test.com` } });
      const res = mockRes();
      await limiter(req, res, next);
    }

    // Next request should be blocked
    const req = mockReq({ ip: "10.0.0.99", body: { email: "extra@test.com" } });
    const res = mockRes();
    next.mockClear();
    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("blocks requests exceeding per-email limit", async () => {
    const limiter = authRateLimiter("login");
    const config = AUTH_CONFIGS.login;
    const next = vi.fn();

    // Exhaust the limit from different IPs but same email
    for (let i = 0; i < config.maxAttempts; i++) {
      const req = mockReq({
        ip: `10.0.${i}.1`,
        body: { email: "target@test.com" },
      });
      const res = mockRes();
      await limiter(req, res, next);
    }

    // Next request with same email should be blocked
    const req = mockReq({
      ip: "10.0.99.1",
      body: { email: "target@test.com" },
    });
    const res = mockRes();
    next.mockClear();
    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Too Many Requests",
      })
    );
  });

  it("locks out IP after repeated failures", async () => {
    const config = AUTH_CONFIGS.login;

    // Call store.recordFailure directly (awaited) to avoid relying on
    // fire-and-forget timing in recordAuthFailure.
    for (let i = 0; i < config.lockoutThreshold; i++) {
      await authRateLimitStore.recordFailure("10.0.0.50", "victim@test.com", config);
    }

    // Subsequent request should be locked out
    const limiter = authRateLimiter("login");
    const req = mockReq({ ip: "10.0.0.50", body: { email: "other@test.com" } });
    const res = mockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("locked"),
      })
    );
  });

  it("locks out email after repeated failures", async () => {
    const config = AUTH_CONFIGS.login;

    // Record failures from different IPs but same email, awaited directly.
    for (let i = 0; i < config.lockoutThreshold; i++) {
      await authRateLimitStore.recordFailure(`10.0.${i}.1`, "locked@test.com", config);
    }

    // Request from new IP but same email should be locked
    const limiter = authRateLimiter("login");
    const req = mockReq({
      ip: "10.0.99.1",
      body: { email: "locked@test.com" },
    });
    const res = mockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("normalizes email case for tracking", async () => {
    const limiter = authRateLimiter("login");
    const config = AUTH_CONFIGS.login;
    const next = vi.fn();

    // Use mixed case emails that should all count as the same
    const emails = ["User@Test.COM", "user@test.com", "USER@TEST.COM"];
    for (let i = 0; i < config.maxAttempts; i++) {
      const req = mockReq({
        ip: `10.0.${i}.1`,
        body: { email: emails[i % emails.length] },
      });
      const res = mockRes();
      await limiter(req, res, next);
    }

    // Should be blocked now
    const req = mockReq({
      ip: "10.0.99.1",
      body: { email: "user@TEST.com" },
    });
    const res = mockRes();
    next.mockClear();
    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("uses different configs for different actions", () => {
    expect(AUTH_CONFIGS.login.maxAttempts).toBe(5);
    expect(AUTH_CONFIGS.signup.maxAttempts).toBe(3);
    expect(AUTH_CONFIGS.passwordReset.maxAttempts).toBe(3);
    expect(AUTH_CONFIGS.verifyResend.maxAttempts).toBe(3);
  });

  it("applies progressive delay after failures", async () => {
    const config = AUTH_CONFIGS.login;
    const ip = "10.0.0.77";
    const email = "delay@test.com";

    // Await store.recordFailure directly — no timing assumptions.
    for (let i = 0; i < 3; i++) {
      await authRateLimitStore.recordFailure(ip, email, config);
    }

    const delay = await authRateLimitStore.getProgressiveDelay(ip, email, config);
    // 3 failures => (3-1) * 500 = 1000ms
    expect(delay).toBe(1000);
  });

  it("caps progressive delay at maxDelayMs", async () => {
    const config = AUTH_CONFIGS.login;
    const ip = "10.0.0.88";
    const email = "maxdelay@test.com";

    // Record many failures (but below lockout threshold), awaited directly.
    for (let i = 0; i < config.lockoutThreshold - 1; i++) {
      await authRateLimitStore.recordFailure(ip, email, config);
    }

    const delay = await authRateLimitStore.getProgressiveDelay(ip, email, config);
    expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
  });
});
