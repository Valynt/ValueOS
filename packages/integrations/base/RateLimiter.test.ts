import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "./RateLimiter.js";
import { RateLimitError } from "./errors.js";

describe("RateLimiter", () => {
  const provider = "test-provider";
  const tenantId = "tenant-1";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with max tokens (burstLimit or requestsPerMinute)", () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });
    expect(limiter.getAvailableTokens(tenantId)).toBe(60);

    const burstLimiter = new RateLimiter({
      provider,
      requestsPerMinute: 60,
      burstLimit: 100,
    });
    expect(burstLimiter.getAvailableTokens(tenantId)).toBe(100);
  });

  it("should consume tokens correctly using acquire", async () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    await limiter.acquire(tenantId, 10);
    expect(limiter.getAvailableTokens(tenantId)).toBe(50);

    await limiter.acquire(tenantId, 50);
    expect(limiter.getAvailableTokens(tenantId)).toBe(0);
  });

  it("should consume tokens correctly using tryAcquire", async () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    const success1 = await limiter.tryAcquire(tenantId, 10);
    expect(success1).toBe(true);
    expect(limiter.getAvailableTokens(tenantId)).toBe(50);

    const success2 = await limiter.tryAcquire(tenantId, 60);
    expect(success2).toBe(false);
    expect(limiter.getAvailableTokens(tenantId)).toBe(50); // Tokens should not be consumed if tryAcquire fails
  });

  it("should throw RateLimitError when limit is exceeded via acquire", async () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    await expect(limiter.acquire(tenantId, 61)).rejects.toThrow(RateLimitError);

    await limiter.acquire(tenantId, 60);
    await expect(limiter.acquire(tenantId, 1)).rejects.toThrow(RateLimitError);
  });

  it("should refill tokens over time", async () => {
    // 60 requests per minute = 1 request per second
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    await limiter.acquire(tenantId, 60);
    expect(limiter.getAvailableTokens(tenantId)).toBe(0);

    // Fast-forward 30 seconds
    vi.advanceTimersByTime(30000);
    expect(limiter.getAvailableTokens(tenantId)).toBe(30);

    // Fast-forward another 30 seconds
    vi.advanceTimersByTime(30000);
    expect(limiter.getAvailableTokens(tenantId)).toBe(60);

    // Fast-forward past the limit to ensure it doesn't exceed max tokens
    vi.advanceTimersByTime(60000);
    expect(limiter.getAvailableTokens(tenantId)).toBe(60);
  });

  it("should maintain separate token buckets for separate tenant IDs", async () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });
    const tenant2 = "tenant-2";

    await limiter.acquire(tenantId, 60);
    expect(limiter.getAvailableTokens(tenantId)).toBe(0);

    // tenant2 should still have its full bucket
    expect(limiter.getAvailableTokens(tenant2)).toBe(60);
    await limiter.acquire(tenant2, 30);
    expect(limiter.getAvailableTokens(tenant2)).toBe(30);

    // tenantId bucket should remain empty
    expect(limiter.getAvailableTokens(tenantId)).toBe(0);
  });

  it("should correctly reset a bucket", async () => {
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    await limiter.acquire(tenantId, 60);
    expect(limiter.getAvailableTokens(tenantId)).toBe(0);

    limiter.reset(tenantId);

    // Should re-initialize the bucket with full tokens
    expect(limiter.getAvailableTokens(tenantId)).toBe(60);
  });

  it("should wait the correct amount of time when rejecting in RateLimitError", async () => {
    // 60 requests per minute = 1 request per second = 1 ms per 0.001 token = 1000ms per 1 token
    const limiter = new RateLimiter({ provider, requestsPerMinute: 60 });

    await limiter.acquire(tenantId, 60); // bucket is empty

    try {
        await limiter.acquire(tenantId, 1);
        expect.unreachable("Should have thrown RateLimitError");
    } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        // We need 1 token. Refill rate is 1 token per second (1/1000 tokens per ms)
        // Wait time = Math.ceil(1 / (60/60000)) = Math.ceil(1 / 0.001) = 1000 ms
        expect((e as RateLimitError).retryAfter).toBe(1000);
    }
  });
});
