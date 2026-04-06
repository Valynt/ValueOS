import { describe, expect, it, beforeEach } from "vitest";
import {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
} from "../CircuitBreakerManager.categorized.js";

describe("CategorizedCircuitBreakerManager instances", () => {
  beforeEach(() => {
    resetCategorizedCircuitBreakerManager();
  });

  it("getCategorizedCircuitBreakerManager should return an instance of CategorizedCircuitBreakerManager", () => {
    const manager = getCategorizedCircuitBreakerManager();
    expect(manager).toBeInstanceOf(CategorizedCircuitBreakerManager);
  });

  it("getCategorizedCircuitBreakerManager should return the same instance on multiple calls", () => {
    const manager1 = getCategorizedCircuitBreakerManager();
    const manager2 = getCategorizedCircuitBreakerManager();
    expect(manager1).toBe(manager2); // strict equality
  });

  it("resetCategorizedCircuitBreakerManager should reset the instance so a new one is created", () => {
    const manager1 = getCategorizedCircuitBreakerManager();
    resetCategorizedCircuitBreakerManager();
    const manager2 = getCategorizedCircuitBreakerManager();

    expect(manager1).not.toBe(manager2);
    expect(manager2).toBeInstanceOf(CategorizedCircuitBreakerManager);
  });
});
