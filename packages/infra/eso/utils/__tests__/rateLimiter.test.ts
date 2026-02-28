import { beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimiter } from "../rateLimiter.js";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(10, 1000); // 10 requests per second
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should allow requests within limit without waiting", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(rateLimiter.waitForToken()).resolves.toBeUndefined();
    }
  });

  it("should wait for token when limit exceeded", async () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      await rateLimiter.waitForToken();
    }
    // Next should wait
    const promise = rateLimiter.waitForToken();
    vi.advanceTimersByTime(100); // Advance time to refill
    await expect(promise).resolves.toBeUndefined();
  });

  it("should refill tokens over time", () => {
    // Consume all
    for (let i = 0; i < 10; i++) {
      rateLimiter["waitForToken"](); // Direct call to avoid async
    }
    expect(rateLimiter["tokens"]).toBe(0);
    vi.advanceTimersByTime(500); // Half second, should refill 5 tokens
    rateLimiter["refill"]();
    expect(rateLimiter["tokens"]).toBe(5);
  });

  it("should not exceed max tokens on refill", () => {
    vi.advanceTimersByTime(2000); // More than enough time
    rateLimiter["refill"]();
    expect(rateLimiter["tokens"]).toBe(10);
  });
});
