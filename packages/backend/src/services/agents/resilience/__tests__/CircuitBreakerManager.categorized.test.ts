import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
  CIRCUIT_BREAKER_CATEGORIES,
} from "../CircuitBreakerManager.categorized.js";

describe("CategorizedCircuitBreakerManager", () => {
  beforeEach(() => {
    resetCategorizedCircuitBreakerManager();
  });

  describe("Singleton management", () => {
    it("should return the same instance across multiple calls", () => {
      const instance1 = getCategorizedCircuitBreakerManager();
      const instance2 = getCategorizedCircuitBreakerManager();
      expect(instance1).toBe(instance2);
    });

    it("should create a new instance after reset", () => {
      const instance1 = getCategorizedCircuitBreakerManager();
      resetCategorizedCircuitBreakerManager();
      const instance2 = getCategorizedCircuitBreakerManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("getBreaker", () => {
    it("should create and return a breaker", () => {
      const manager = new CategorizedCircuitBreakerManager();
      const breaker = manager.getBreaker("test-breaker");
      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe("closed");
    });

    it("should return the same breaker for the same name", () => {
      const manager = new CategorizedCircuitBreakerManager();
      const breaker1 = manager.getBreaker("test-breaker");
      const breaker2 = manager.getBreaker("test-breaker");
      expect(breaker1).toBe(breaker2);
    });

    it("should apply category defaults when category is provided", () => {
      const manager = new CategorizedCircuitBreakerManager();
      // llm defaults: failureThreshold: 3
      const breaker = manager.getBreaker("llm-breaker", CIRCUIT_BREAKER_CATEGORIES.LLM);
      // Let's trigger 3 failures to see if it opens
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe("open");
    });

    it("should not fail when unknown category is provided (falls back to defaults)", () => {
      const manager = new CategorizedCircuitBreakerManager();
      // @ts-expect-error testing invalid category
      const breaker = manager.getBreaker("custom-breaker", "unknown_category");
      expect(breaker).toBeDefined();
    });
  });

  describe("execute and executeWithCategory", () => {
    it("should execute successfully", async () => {
      const manager = new CategorizedCircuitBreakerManager();
      const fn = vi.fn().mockResolvedValue("success");
      const result = await manager.execute("test-breaker", fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle executeWithCategory correctly", async () => {
      const manager = new CategorizedCircuitBreakerManager();
      const fn = vi.fn().mockResolvedValue("success");
      const result = await manager.executeWithCategory("test-breaker", fn, CIRCUIT_BREAKER_CATEGORIES.DATABASE);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should fail and update breaker state on error", async () => {
      const manager = new CategorizedCircuitBreakerManager();
      const fn = vi.fn().mockRejectedValue(new Error("test error"));

      await expect(manager.execute("test-breaker", fn)).rejects.toThrow("test error");

      const breaker = manager.getBreaker("test-breaker");
      expect(breaker.getFailureCount()).toBe(1);
    });
  });

  describe("getAllCategoryStats", () => {
    it("should calculate stats correctly", async () => {
      const manager = new CategorizedCircuitBreakerManager();

      // Category from name is extracted by splitting on ':'
      // closed database
      manager.getBreaker("database:read");
      manager.getBreaker("database:write");

      // closed external_api
      manager.getBreaker("external_api:github");

      // open llm
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      // fail 3 times to open the LLM breaker
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();

      const stats = manager.getAllCategoryStats();

      expect(stats["database"]).toEqual({ total: 2, open: 0, closed: 2 });
      expect(stats["external_api"]).toEqual({ total: 1, open: 0, closed: 1 });
      expect(stats["llm"]).toEqual({ total: 1, open: 1, closed: 0 });
    });
  });

  describe("reset and resetAll", () => {
    it("should reset all breakers", async () => {
      const manager = new CategorizedCircuitBreakerManager();
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // trip a breaker
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();
      await expect(manager.executeWithCategory("llm:openai", fn, CIRCUIT_BREAKER_CATEGORIES.LLM)).rejects.toThrow();

      let breaker = manager.getBreaker("llm:openai");
      expect(breaker.getState()).toBe("open");

      manager.reset();

      breaker = manager.getBreaker("llm:openai");
      expect(breaker.getState()).toBe("closed");
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("should alias resetAll to reset", async () => {
      const manager = new CategorizedCircuitBreakerManager();
      manager.getBreaker("test").recordFailure();
      manager.getBreaker("test").recordFailure();

      expect(manager.getBreaker("test").getFailureCount()).toBe(2);

      manager.resetAll();

      expect(manager.getBreaker("test").getFailureCount()).toBe(0);
    });
  });
});
