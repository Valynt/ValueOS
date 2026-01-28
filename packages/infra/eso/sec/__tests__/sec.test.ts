import { describe, it, expect, beforeEach, vi } from "vitest";
import { SECAdapter } from "../index.js";

describe("SECAdapter", () => {
  let adapter: SECAdapter;

  beforeEach(() => {
    adapter = new SECAdapter({
      baseUrl: "https://www.sec.gov/edgar/searchedgar",
      // Disable cache and rate limiting for simpler tests
      enableCache: false,
      rateLimit: undefined,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch data successfully", async () => {
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ filings: [] }) };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await adapter.fetchData({ cik: "1234567890", type: "10-K" });
    expect(result).toEqual({ filings: [] });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.sec.gov/edgar/searchedgar?cik=1234567890&type=10-K",
      expect.objectContaining({ headers: { "User-Agent": "ValueOS/1.0" } })
    );
  });

  it("should throw error on fetch failure", async () => {
    const mockResponse = { ok: false, status: 404 };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(adapter.fetchData()).rejects.toThrow("SEC API error: 404");
  });

  it("should transform data correctly", async () => {
    const rawData = { company: "Test Corp" };
    const transformed = await adapter.transformData(rawData);
    expect(transformed).toEqual({
      source: "SEC",
      data: rawData,
      timestamp: expect.any(String),
    });
  });

  it("should use cache when enabled", async () => {
    const cachedAdapter = new SECAdapter({
      baseUrl: "https://www.sec.gov/edgar/searchedgar",
      enableCache: true,
      cacheTTL: 1000,
    });
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: "cached" }) };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await cachedAdapter.fetchData({ cik: "123" });
    const result = await cachedAdapter.fetchData({ cik: "123" }); // Should hit cache
    expect(result).toEqual({ data: "cached" });
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only once
  });
});
