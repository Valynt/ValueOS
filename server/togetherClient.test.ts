/**
 * Together.ai Client Validation Test
 *
 * Validates that the TOGETHER_API_KEY is set and can reach the Together.ai API.
 */
import { describe, it, expect } from "vitest";

describe("Together.ai API key validation", () => {
  it("TOGETHER_API_KEY is set in the environment", () => {
    const key = process.env.TOGETHER_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(0);
  });

  it("can reach Together.ai /v1/models endpoint", async () => {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) {
      throw new Error("TOGETHER_API_KEY is not set — cannot validate");
    }

    const response = await fetch("https://api.together.xyz/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(response.status).toBe(200);

    const data = await response.json();
    // Together.ai returns a plain array of model objects
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  }, 15000); // 15s timeout for network call
});
