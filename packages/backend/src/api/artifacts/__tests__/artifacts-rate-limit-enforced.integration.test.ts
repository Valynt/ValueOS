/**
 * artifacts-rate-limit-enforced -- integration test
 *
 * Confirms the rate limiter attached to the artifacts routes is not a no-op.
 * The standard tier allows 60 requests per minute; the 61st request within
 * that window must return HTTP 429.
 */

import { describe, expect, it, vi } from "vitest";

// -- Mock Redis store so we get in-memory rate limiting ---
vi.mock("../../../middleware/redisRateLimitStore.js", () => {
  // Simple in-memory store that mirrors the RedisRateLimitStore interface
  const buckets = new Map<string, { count: number; resetTime: number }>();
  return {
    RedisRateLimitStore: class {
      isRedisAvailable() {
        return false;
      }
      async increment(key: string, windowMs: number, _opts?: unknown) {
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetTime <= now) {
          bucket = { count: 0, resetTime: now + windowMs };
          buckets.set(key, bucket);
        }
        bucket.count++;
        return { count: bucket.count, resetTime: bucket.resetTime };
      }
      async get(key: string) {
        return buckets.get(key) ?? null;
      }
      async reset(key: string) {
        buckets.delete(key);
      }
      async getKeys() {
        return [];
      }
      async getStats() {
        return { totalKeys: 0, keys: [] };
      }
      cleanup() {}
    },
  };
});

// Stub observability counters
vi.mock("../../../lib/observability/index.js", () => ({
  createCounter: () => ({ inc: vi.fn() }),
  createHistogram: () => ({ observe: vi.fn(), startTimer: () => vi.fn() }),
}));

// Stub the key service
vi.mock("../../../services/post-v1/RateLimitKeyService.js", () => ({
  RateLimitKeyService: class {
    static generateSecureKey(
      req: { ip?: string; user?: { id?: string } },
      opts: { service?: string; tier?: string }
    ) {
      const id = req.user?.id ?? req.ip ?? "anonymous";
      return `rl:${opts.tier ?? "standard"}:${id}`;
    }
    static generateKey(
      tier: string,
      req: { ip?: string; user?: { id?: string } }
    ) {
      const id = req.user?.id ?? req.ip ?? "anonymous";
      return `rl:${tier}:${id}`;
    }
  },
}));

// Import after mocks
const { createRateLimiter } =
  await import("../../../middleware/rateLimiter.js");

// -- Helpers --
function callMiddleware(
  middleware: (
    req: unknown,
    res: unknown,
    next: () => void
  ) => void | Promise<void>,
  ip = "127.0.0.1"
): Promise<{ status: number; allowed: boolean }> {
  return new Promise(resolve => {
    let statusCode = 200;
    const req = {
      ip,
      path: "/api/artifacts",
      method: "GET",
      user: { id: "user-rate-test" },
      headers: {},
      get: () => undefined,
    };
    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: unknown) => {
        // When json is called by rate limiter, the request was blocked
        resolve({ status: statusCode, allowed: false });
        return res;
      },
      setHeader: () => res,
      headersSent: false,
    };
    const next = () => {
      resolve({ status: 200, allowed: true });
    };
    // Handle both sync and async middleware
    const result = middleware(req, res, next);
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => {
        resolve({ status: 500, allowed: false });
      });
    }
  });
}

// -- Tests --
describe("artifacts-rate-limit-enforced", () => {
  it("61st request within 1 min returns 429", async () => {
    // Standard tier: 60 req/min
    const limiter = createRateLimiter("standard");
    const results: Array<{ status: number; allowed: boolean }> = [];

    for (let i = 1; i <= 61; i++) {
      const result = await callMiddleware(limiter);
      results.push(result);
    }

    // First 60 should be allowed
    const allowed = results.filter(r => r.allowed);
    const blocked = results.filter(r => !r.allowed);

    expect(allowed.length).toBe(60);
    expect(blocked.length).toBe(1);
    expect(blocked[0].status).toBe(429);
  });
});
