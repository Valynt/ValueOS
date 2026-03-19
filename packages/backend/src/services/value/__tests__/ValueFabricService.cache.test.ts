import { afterEach, describe, expect, it } from "vitest";

import { ValueFabricService } from "../ValueFabricService";

describe("ValueFabricService near-cache diagnostics", () => {
  afterEach(() => {
    ValueFabricService.clearCachesForTesting();
  });

  it("tracks the capability near-cache namespace separately from use-cases", () => {
    ValueFabricService.seedCacheForTesting("capability", "tenant-a", {
      page: 1,
      pageSize: 50,
    });
    ValueFabricService.seedCacheForTesting("useCase", "tenant-a", {
      page: 1,
      pageSize: 50,
      is_template: true,
    });

    const diagnostics = ValueFabricService.getCacheDiagnostics();

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          namespace: "value-fabric.capability-list",
          size: 1,
        }),
        expect.objectContaining({
          namespace: "value-fabric.use-case-list",
          size: 1,
        }),
      ])
    );
  });

  it("clears all value-fabric near-cache namespaces for tests", () => {
    ValueFabricService.seedCacheForTesting("capability", "tenant-a", {
      search: "automation",
    });

    ValueFabricService.clearCachesForTesting();

    expect(ValueFabricService.getCacheDiagnostics()).toEqual([]);
  });
});
