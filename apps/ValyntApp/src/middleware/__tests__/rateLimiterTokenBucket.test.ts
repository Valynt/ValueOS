import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "../rateLimiter";
import { InMemoryRateLimitStore } from "../rateLimitStorage";

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    path: "/api/test",
    method: "GET",
    headers: {},
    ip: "1.1.1.1",
    socket: { remoteAddress: "1.1.1.1" },
    user: { id: "user-1" },
    ...overrides,
  }) as any;

const makeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string | number) => {
      headers[name] = String(value);
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
};

describe("rateLimiter token bucket", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns 429 when the limit is exceeded", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = createRateLimiter("standard", {
      windowMs: 1000,
      max: 2,
      ipMax: 2,
      store,
    });

    const res1 = makeRes();
    const next1 = vi.fn();
    await limiter(makeReq(), res1 as any, next1);
    expect(next1).toHaveBeenCalled();
    expect(res1.headers["X-RateLimit-Remaining"]).toBe("1");

    const res2 = makeRes();
    const next2 = vi.fn();
    await limiter(makeReq(), res2 as any, next2);
    expect(next2).toHaveBeenCalled();
    expect(res2.headers["X-RateLimit-Remaining"]).toBe("0");

    const res3 = makeRes();
    const next3 = vi.fn();
    await limiter(makeReq(), res3 as any, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.status).toHaveBeenCalledWith(429);
    expect(res3.headers["Retry-After"]).toBeDefined();
  });

  it("resets tokens after the window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const store = new InMemoryRateLimitStore();
    const limiter = createRateLimiter("standard", {
      windowMs: 1000,
      max: 1,
      ipMax: 1,
      store,
    });

    const res1 = makeRes();
    const next1 = vi.fn();
    await limiter(makeReq(), res1 as any, next1);
    expect(next1).toHaveBeenCalled();

    vi.setSystemTime(new Date(1500));

    const res2 = makeRes();
    const next2 = vi.fn();
    await limiter(makeReq(), res2 as any, next2);
    expect(next2).toHaveBeenCalled();
    expect(res2.status).not.toHaveBeenCalledWith(429);
  });
});
