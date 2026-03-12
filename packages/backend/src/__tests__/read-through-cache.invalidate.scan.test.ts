import { describe, expect, it } from "vitest";

import { ReadThroughCacheService } from "../services/ReadThroughCacheService.js";

describe("ReadThroughCacheService.invalidateEndpoint coverage moved", () => {
  it("exposes invalidateEndpoint", () => {
    expect(typeof ReadThroughCacheService.invalidateEndpoint).toBe("function");
  });
});
