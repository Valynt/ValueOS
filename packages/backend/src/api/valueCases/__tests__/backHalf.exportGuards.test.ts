import { afterEach, describe, expect, it } from "vitest";

import {
  getAllowedRenderOrigins,
  isAllowedRenderUrl,
  resetAllowedRenderOriginsCacheForTests,
} from "../backHalf.exportGuards.js";

describe("backHalf export guards", () => {
  afterEach(() => {
    delete process.env.PDF_ALLOWED_ORIGINS;
    delete process.env.APP_URL;
    resetAllowedRenderOriginsCacheForTests();
  });

  it("uses PDF_ALLOWED_ORIGINS when configured", () => {
    process.env.PDF_ALLOWED_ORIGINS = "https://app.example.com, https://preview.example.com";

    expect(getAllowedRenderOrigins()).toEqual([
      "https://app.example.com",
      "https://preview.example.com",
    ]);
    expect(isAllowedRenderUrl("https://preview.example.com/cases/123")).toBe(true);
    expect(isAllowedRenderUrl("https://evil.example.com/cases/123")).toBe(false);
  });

  it("falls back to APP_URL origin and blocks non-http protocols", () => {
    process.env.APP_URL = "https://valueos.example.com/path";

    expect(getAllowedRenderOrigins()).toEqual(["https://valueos.example.com"]);
    expect(isAllowedRenderUrl("https://valueos.example.com/cases/42")).toBe(true);
    expect(isAllowedRenderUrl("file:///etc/passwd")).toBe(false);
  });
});
