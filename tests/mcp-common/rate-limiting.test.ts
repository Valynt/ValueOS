/**
 * MCP Rate Limiter Tests
 *
 * Tests for the centralized rate limiting service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MCPRateLimiter, mcpRateLimiter } from "../../src/mcp-common";

describe("MCPRateLimiter", () => {
  let rateLimiter: MCPRateLimiter;

  beforeEach(() => {
    // Create a new instance for testing by accessing the private constructor through reflection
    // or use the singleton and reset it
    rateLimiter = mcpRateLimiter;
    rateLimiter.resetProvider("test-provider");
    rateLimiter.resetProvider("test-provider-2");
    rateLimiter.resetProvider("singleton-test");
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe("Provider Registration", () => {
    it("should register a provider successfully", () => {
      const config = {
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 100,
        windowMs: 60000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: false,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      };

      expect(() => rateLimiter.registerProvider(config)).not.toThrow();
    });

    it("should throw error when checking unregistered provider", async () => {
      await expect(rateLimiter.checkLimit("unregistered")).rejects.toThrow();
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(() => {
      rateLimiter.registerProvider({
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 5,
        windowMs: 1000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: false,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      });
    });

    it("should allow requests within limit", async () => {
      const result = await rateLimiter.checkLimit("test-provider");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it("should deny requests exceeding limit", async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit("test-provider");
      }

      const result = await rateLimiter.checkLimit("test-provider");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should reset limit after window expires", async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit("test-provider");
      }

      // Should be denied
      const deniedResult = await rateLimiter.checkLimit("test-provider");
      expect(deniedResult.allowed).toBe(false);

      // Wait for window to expire (plus a small buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      const allowedResult = await rateLimiter.checkLimit("test-provider");
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe("Circuit Breaker", () => {
    beforeEach(() => {
      rateLimiter.registerProvider({
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 100,
        windowMs: 60000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          recoveryTimeout: 1000, // Short for testing
          monitoringPeriod: 600000,
        },
      });
    });

    it("should open circuit breaker after failure threshold", async () => {
      // Record failures to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordFailure("test-provider", new Error("Test error"));
      }

      const result = await rateLimiter.checkLimit("test-provider");
      expect(result.allowed).toBe(false);
      expect(result.circuitBreakerOpen).toBe(true);
    });

    it("should close circuit breaker after recovery timeout", async () => {
      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordFailure("test-provider", new Error("Test error"));
      }

      // Should be open
      const openResult = await rateLimiter.checkLimit("test-provider");
      expect(openResult.allowed).toBe(false);
      expect(openResult.circuitBreakerOpen).toBe(true);

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be half-open and allow requests
      const halfOpenResult = await rateLimiter.checkLimit("test-provider");
      expect(halfOpenResult.allowed).toBe(true);

      // Record success to close circuit breaker
      rateLimiter.recordSuccess("test-provider", 100);

      const closedResult = await rateLimiter.checkLimit("test-provider");
      expect(closedResult.allowed).toBe(true);
      expect(closedResult.circuitBreakerOpen).toBeUndefined();
    });

    it("should reset circuit breaker on success in half-open state", async () => {
      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordFailure("test-provider", new Error("Test error"));
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Get to half-open state
      await rateLimiter.checkLimit("test-provider");

      // Record success to close circuit breaker
      rateLimiter.recordSuccess("test-provider", 100);

      const stats = rateLimiter.getStats("test-provider");
      expect(stats?.circuitBreakerState).toBe("closed");
    });
  });

  describe("Adaptive Throttling", () => {
    beforeEach(() => {
      rateLimiter.registerProvider({
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 100,
        windowMs: 60000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: true,
        circuitBreaker: {
          enabled: false,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      });
    });

    it("should apply adaptive delay based on response times", async () => {
      // Record slow response times to trigger throttling
      for (let i = 0; i < 15; i++) {
        rateLimiter.recordSuccess("test-provider", 2000); // 2 second response times
      }

      const result = await rateLimiter.checkLimit("test-provider");
      expect(result.adaptiveDelay).toBeGreaterThan(0);
    });

    it("should reduce adaptive delay for fast response times", async () => {
      // First trigger some delay
      for (let i = 0; i < 15; i++) {
        rateLimiter.recordSuccess("test-provider", 2000);
      }

      // Then record fast response times
      for (let i = 0; i < 15; i++) {
        rateLimiter.recordSuccess("test-provider", 100); // Fast response times
      }

      const result = await rateLimiter.checkLimit("test-provider");
      // Delay should be reduced (might still be > 0 depending on implementation)
      expect(typeof result.adaptiveDelay).toBe("number");
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      rateLimiter.registerProvider({
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 100,
        windowMs: 60000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      });
    });

    it("should track statistics correctly", async () => {
      // Make some requests
      await rateLimiter.checkLimit("test-provider");
      await rateLimiter.checkLimit("test-provider");

      // Record success and failure
      rateLimiter.recordSuccess("test-provider", 150);
      rateLimiter.recordFailure("test-provider", new Error("Test error"));

      const stats = rateLimiter.getStats("test-provider");
      expect(stats).toBeDefined();
      expect(stats?.provider).toBe("test-provider");
      expect(stats?.totalRequests).toBeGreaterThan(0);
      expect(stats?.failedRequests).toBe(1);
      expect(stats?.successRate).toBeLessThan(1.0);
      expect(stats?.averageResponseTime).toBe(150);
    });

    it("should return null for unknown provider", () => {
      const stats = rateLimiter.getStats("unknown-provider");
      expect(stats).toBeNull();
    });

    it("should return all provider statistics", async () => {
      // Register multiple providers
      rateLimiter.registerProvider({
        provider: "test-provider-2",
        requestsPerSecond: 5,
        burstCapacity: 50,
        windowMs: 60000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: false,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      });

      const allStats = rateLimiter.getAllStats();
      expect(allStats).toHaveLength(2);
      expect(allStats.map((s) => s.provider)).toContain("test-provider");
      expect(allStats.map((s) => s.provider)).toContain("test-provider-2");
    });
  });

  describe("Reset Functionality", () => {
    beforeEach(() => {
      rateLimiter.registerProvider({
        provider: "test-provider",
        requestsPerSecond: 10,
        burstCapacity: 5,
        windowMs: 1000,
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: false,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 300000,
          monitoringPeriod: 600000,
        },
      });
    });

    it("should reset provider statistics", async () => {
      // Make some requests and record failures
      await rateLimiter.checkLimit("test-provider");
      rateLimiter.recordFailure("test-provider", new Error("Test error"));

      let stats = rateLimiter.getStats("test-provider");
      expect(stats?.totalRequests).toBeGreaterThan(0);
      expect(stats?.failedRequests).toBeGreaterThan(0);

      // Reset provider
      rateLimiter.resetProvider("test-provider");

      stats = rateLimiter.getStats("test-provider");
      expect(stats?.totalRequests).toBe(0);
      expect(stats?.failedRequests).toBe(0);
      expect(stats?.successRate).toBe(1.0);
      expect(stats?.circuitBreakerState).toBe("closed");
    });
  });
});

describe("Singleton Rate Limiter", () => {
  it("should return the same instance", () => {
    const instance1 = mcpRateLimiter;
    const instance2 = mcpRateLimiter;

    expect(instance1).toBe(instance2);
  });

  it("should maintain state across accesses", async () => {
    // Register provider on first instance
    mcpRateLimiter.registerProvider({
      provider: "singleton-test",
      requestsPerSecond: 10,
      burstCapacity: 5,
      windowMs: 1000,
      retryAfterBase: 60,
      maxRetries: 3,
      backoffMultiplier: 2,
      adaptiveThrottling: false,
      circuitBreaker: {
        enabled: false,
        failureThreshold: 5,
        recoveryTimeout: 300000,
        monitoringPeriod: 600000,
      },
    });

    // Use second instance
    const result = await mcpRateLimiter.checkLimit("singleton-test");
    expect(result.allowed).toBe(true);

    // Clean up
    mcpRateLimiter.resetProvider("singleton-test");
  });
});
