import { parseCorsAllowlist } from "@shared/config/cors";
import { afterEach, describe, expect, it } from "vitest";

import { getConfig } from "../environment";

describe("CORS allowlist parsing", () => {
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
      return;
    }

    process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  it("accepts comma-delimited origin allowlists", () => {
    expect(
      parseCorsAllowlist("https://app.valueos.com, https://admin.valueos.com", {
        source: "CORS_ORIGINS",
        credentials: true,
      })
    ).toEqual(["https://app.valueos.com", "https://admin.valueos.com"]);
  });

  it("rejects wildcard origins when credentials are enabled", () => {
    expect(() =>
      parseCorsAllowlist("https://app.valueos.com,*", {
        source: "CORS_ORIGINS",
        credentials: true,
      })
    ).toThrow(/wildcard CORS origin/);
  });

  it("rejects empty allowlists when credentials are enabled", () => {
    expect(() =>
      parseCorsAllowlist("", {
        source: "CORS_ORIGINS",
        credentials: true,
      })
    ).toThrow(/must define at least one CORS origin/);
  });

  it("fails startup config when CORS_ORIGINS is missing", () => {
    delete process.env.CORS_ORIGINS;

    expect(() => getConfig()).toThrow(/must define at least one CORS origin/);
  });
});
