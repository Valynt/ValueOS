/**
 * Test Suite for Robust Testing Foundation
 *
 * Demonstrates the unified test setup with infrastructure fault-injection
 * capabilities and factory for isolated tenant data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LLMProviderMock, LLMFailureMode } from "../LLMProviderMock";
import { InfrastructureFaultInjector, FaultMode } from "../integration/testcontainers-global-setup";
import { CleanTenantFactory, generateRandomTenantId } from "../test-utils";

describe("Robust Testing Foundation", () => {
  describe("LLM Provider Mock - Failure Modes", () => {
    let mock: LLMProviderMock;

    beforeEach(() => {
      mock = new LLMProviderMock();
    });

    afterEach(() => {
      mock.reset();
    });

    it("should handle SlowResponse failure mode", async () => {
      mock.setFailureMode({
        mode: LLMFailureMode.SLOW_RESPONSE,
        latencyMs: 100,
      });

      const startTime = Date.now();
      await mock.complete("test prompt");
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(mock.getCallHistory().length).toBe(1);
      expect(mock.getAverageLatency()).toBeGreaterThanOrEqual(100);
    });

    it("should handle TokenLimitExceeded failure mode", async () => {
      mock.setFailureMode({
        mode: LLMFailureMode.TOKEN_LIMIT_EXCEEDED,
        errorMessage: "Token limit exceeded",
      });

      await expect(mock.complete("test prompt")).rejects.toThrow("Token limit exceeded");
      expect(mock.verifyFailureModeTriggered(LLMFailureMode.TOKEN_LIMIT_EXCEEDED)).toBe(true);
    });

    it("should handle MalformedJSON failure mode", async () => {
      mock.setFailureMode({
        mode: LLMFailureMode.MALFORMED_JSON,
      });

      const result = await mock.complete("test prompt");
      expect(typeof result).toBe("string");
      expect(mock.getCallHistory()[0].success).toBe(true);
    });

    it("should track call metrics", async () => {
      await mock.complete("prompt 1");
      await mock.complete("prompt 2");

      expect(mock.getCallCount()).toBe(2);
      expect(mock.getSuccessRate()).toBe(1);
      expect(mock.getCallHistory().length).toBe(2);
    });
  });

  describe("Infrastructure Fault Injector", () => {
    let injector: InfrastructureFaultInjector;

    beforeEach(() => {
      injector = new InfrastructureFaultInjector();
    });

    afterEach(() => {
      injector.clearFaults();
    });

    it("should inject Redis connection refused fault", async () => {
      injector.setRedisFault(FaultMode.CONNECTION_REFUSED, {
        errorMessage: "Redis connection failed",
      });

      await expect(
        injector.injectRedisFault(async () => {
          throw new Error("Should not reach here");
        })
      ).rejects.toThrow("Redis connection failed");
    });

    it("should inject PostgreSQL delay fault", async () => {
      injector.setPostgresFault(FaultMode.DELAY, { delayMs: 50 });

      const startTime = Date.now();
      await injector.injectPostgresFault(async () => "success");
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it("should allow normal operation when no faults configured", async () => {
      const result = await injector.injectRedisFault(async () => "normal operation");
      expect(result).toBe("normal operation");
    });
  });

  describe("Clean Tenant Factory", () => {
    it("should generate random tenant IDs", () => {
      const id1 = generateRandomTenantId();
      const id2 = generateRandomTenantId();

      expect(id1).toMatch(/^tenant-/);
      expect(id2).toMatch(/^tenant-/);
      expect(id1).not.toBe(id2);
    });

    it("should create tenant factory instance", () => {
      // Mock Supabase client for testing
      const mockClient = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "test-tenant" } }),
            }),
          }),
        }),
      } as any;

      const factory = new CleanTenantFactory(mockClient);
      expect(factory).toBeInstanceOf(CleanTenantFactory);
      expect(factory.getCreatedTenantCount()).toBe(0);
    });
  });

  describe("Integration Test Setup", () => {
    it("should provide unified test infrastructure", () => {
      // This test demonstrates that all components can be imported and instantiated
      const mock = new LLMProviderMock();
      const injector = new InfrastructureFaultInjector();

      expect(mock).toBeDefined();
      expect(injector).toBeDefined();

      // Configure failure modes
      mock.setFailureMode({ mode: LLMFailureMode.SLOW_RESPONSE, latencyMs: 200 });
      injector.setRedisFault(FaultMode.HIGH_LATENCY, { delayMs: 150 });

      expect(mock.getFailureConfig().mode).toBe(LLMFailureMode.SLOW_RESPONSE);
      expect(injector.getConfig().redis?.mode).toBe(FaultMode.HIGH_LATENCY);
    });
  });
});
