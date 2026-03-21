import { describe, expect, it } from "vitest";

import { validateRedisUrlForProduction } from "../settings.server";

describe("validateRedisUrlForProduction", () => {
  it("rejects passwordless Redis URL in production", () => {
    expect(() =>
      validateRedisUrlForProduction("production", "redis://redis:6379")
    ).toThrow(/Redis password is required/);
  });

  it("accepts authenticated Redis URL in production", () => {
    expect(() =>
      validateRedisUrlForProduction("production", "redis://:super-secret@redis:6379")
    ).not.toThrow();
  });

  it("allows passwordless Redis URL outside production", () => {
    expect(() =>
      validateRedisUrlForProduction("development", "redis://redis:6379")
    ).not.toThrow();
  });
});
