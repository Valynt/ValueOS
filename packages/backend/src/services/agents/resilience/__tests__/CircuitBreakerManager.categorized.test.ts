import { beforeEach, describe, expect, it } from "vitest";
import {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
} from "../CircuitBreakerManager.categorized.js";

describe("CircuitBreakerManager.categorized - Singleton management", () => {
  beforeEach(() => {
    resetCategorizedCircuitBreakerManager();
  });

  it("returns a singleton instance", () => {
    const instance1 = getCategorizedCircuitBreakerManager();
    const instance2 = getCategorizedCircuitBreakerManager();

    expect(instance1).toBeInstanceOf(CategorizedCircuitBreakerManager);
    expect(instance1).toBe(instance2);
  });

  it("resets the singleton instance", () => {
    const instance1 = getCategorizedCircuitBreakerManager();

    resetCategorizedCircuitBreakerManager();

    const instance2 = getCategorizedCircuitBreakerManager();

    expect(instance2).toBeInstanceOf(CategorizedCircuitBreakerManager);
    expect(instance1).not.toBe(instance2);
  });
});