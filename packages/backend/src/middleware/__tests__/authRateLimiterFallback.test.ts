/**
 * Tests that the auth rate limiter emits the fallback counter when Redis
 * is unavailable and in-memory enforcement is active.
 *
 * Uses the _setRedisReady(false) test hook to simulate Redis unavailability
 * without requiring a live Redis instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Counter capture ──────────────────────────────────────────────────────────
// vi.mock is hoisted above variable declarations, so the registry must be
// declared with vi.hoisted() to be available inside the mock factory.

const { counterRegistry } = vi.hoisted(() => ({
  counterRegistry: new Map<string, ReturnType<typeof vi.fn>>(),
}));

vi.mock("../../lib/observability/index.js", () => ({
  createCounter: (name: string) => {
    const spy = vi.fn();
    counterRegistry.set(name, spy);
    return { inc: spy };
  },
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@shared/lib/redisClient", () => ({
  getRedisClient: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
}));

// Import after mocks are registered
import { AUTH_CONFIGS, AuthRateLimitStore } from "../authRateLimiter.js";

const FALLBACK_COUNTER = "auth_rate_limiter_fallback_active_total";

describe("AuthRateLimitStore — degraded mode fallback counter", () => {
  let store: AuthRateLimitStore;

  beforeEach(() => {
    counterRegistry.get(FALLBACK_COUNTER)?.mockClear();
    store = new AuthRateLimitStore();
    // Force Redis to unavailable state
    store._setRedisReady(false, null);
  });

  afterEach(() => {
    store.destroy();
  });

  it("increments fallback counter on increment() when Redis is unavailable", async () => {
    await store.increment("10.0.0.1", undefined, AUTH_CONFIGS.login);

    const spy = counterRegistry.get(FALLBACK_COUNTER);
    expect(spy, "fallback counter must be registered").toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("increments fallback counter on recordFailure() when Redis is unavailable", async () => {
    counterRegistry.get(FALLBACK_COUNTER)?.mockClear();

    await store.recordFailure("10.0.0.1", "user@example.com", AUTH_CONFIGS.login);

    const spy = counterRegistry.get(FALLBACK_COUNTER);
    expect(spy).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("increments fallback counter on isLocked() when Redis is unavailable", async () => {
    counterRegistry.get(FALLBACK_COUNTER)?.mockClear();

    await store.isLocked("10.0.0.1", undefined);

    const spy = counterRegistry.get(FALLBACK_COUNTER);
    expect(spy).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does NOT increment fallback counter when Redis is available", async () => {
    // Provide a mock Redis client with pipeline support matching the store's usage.
    const pipeline = {
      incr: vi.fn().mockReturnThis(),
      pExpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([1, 1]),
    };
    const mockRedis = {
      multi: vi.fn().mockReturnValue(pipeline),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      on: vi.fn(),
    };
    store._setRedisReady(true, mockRedis as any);
    counterRegistry.get(FALLBACK_COUNTER)?.mockClear();

    await store.increment("10.0.0.1", undefined, AUTH_CONFIGS.login);

    const spy = counterRegistry.get(FALLBACK_COUNTER);
    expect(spy).not.toHaveBeenCalled();
  });
});
