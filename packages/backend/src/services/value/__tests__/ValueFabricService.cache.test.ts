import { afterEach, describe, expect, it } from "vitest";

import { ValueFabricService } from "../ValueFabricService";

describe("ValueFabricService cache bounds", () => {
  afterEach(() => {
    ValueFabricService.clearCachesForTesting();
  });

  it("caps capability cache size at configured limit under high-cardinality writes", () => {
    ValueFabricService.clearCachesForTesting();

    const initial = ValueFabricService.getCacheDiagnostics();
    const capacity = initial.capability.capacity;

    for (let index = 0; index < capacity + 250; index += 1) {
      ValueFabricService.seedCacheForTesting("capability", `capability-key-${index}`);
    }

    const diagnostics = ValueFabricService.getCacheDiagnostics();

    expect(diagnostics.capability.size).toBeLessThanOrEqual(capacity);
    expect(diagnostics.capability.size).toBe(capacity);
    expect(diagnostics.capability.metrics.evictions).toBeGreaterThan(0);
  });

  it("caps use-case cache size at configured limit under high-cardinality writes", () => {
    ValueFabricService.clearCachesForTesting();

    const initial = ValueFabricService.getCacheDiagnostics();
    const capacity = initial.useCase.capacity;

    for (let index = 0; index < capacity + 250; index += 1) {
      ValueFabricService.seedCacheForTesting("useCase", `use-case-key-${index}`);
    }

    const diagnostics = ValueFabricService.getCacheDiagnostics();

    expect(diagnostics.useCase.size).toBeLessThanOrEqual(capacity);
    expect(diagnostics.useCase.size).toBe(capacity);
    expect(diagnostics.useCase.metrics.evictions).toBeGreaterThan(0);
  });
});
