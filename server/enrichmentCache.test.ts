import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeCacheKey,
  DEFAULT_CACHE_TTL_MS,
} from "./enrichmentCache";

// ── Unit tests for cache key normalization (no DB needed) ──────────

describe("enrichmentCache.normalizeCacheKey", () => {
  it("lowercases and trims the company name", () => {
    expect(normalizeCacheKey("  Salesforce  ")).toBe("salesforce");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeCacheKey("Acme   Corp   Inc")).toBe("acme corp inc");
  });

  it("produces the same key for equivalent inputs", () => {
    expect(normalizeCacheKey("Salesforce")).toBe(normalizeCacheKey("  salesforce "));
    expect(normalizeCacheKey("SALESFORCE")).toBe(normalizeCacheKey("salesforce"));
  });

  it("handles empty string", () => {
    expect(normalizeCacheKey("")).toBe("");
  });
});

describe("enrichmentCache.DEFAULT_CACHE_TTL_MS", () => {
  it("is 24 hours in milliseconds", () => {
    expect(DEFAULT_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ── Integration tests for cache behavior via the enrichment router ──

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the callDataApi function (used by Yahoo Finance + LinkedIn)
vi.mock("./_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

import { callDataApi } from "./_core/dataApi";
const mockCallDataApi = vi.mocked(callDataApi);

// Mock the enrichmentCache module to test cache integration without a real DB
vi.mock("./enrichmentCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./enrichmentCache")>();
  return {
    ...actual,
    getCachedEnrichment: vi.fn().mockResolvedValue(null),
    setCachedEnrichment: vi.fn().mockResolvedValue(undefined),
    invalidateCachedEnrichment: vi.fn().mockResolvedValue(true),
    getCacheStats: vi.fn().mockResolvedValue({ totalEntries: 5, totalHits: 42, avgConfidence: 78 }),
  };
});

import {
  getCachedEnrichment,
  setCachedEnrichment,
  invalidateCachedEnrichment,
  getCacheStats,
} from "./enrichmentCache";
const mockGetCached = vi.mocked(getCachedEnrichment);
const mockSetCached = vi.mocked(setCachedEnrichment);
const mockInvalidateCached = vi.mocked(invalidateCachedEnrichment);
const mockGetCacheStats = vi.mocked(getCacheStats);

// Mock global fetch for SEC EDGAR, BLS, and Census
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ── Mock API responses ──────────────────────────────────────────────

const mockYahooProfile = {
  quoteType: { symbol: "CRM", longName: "Salesforce, Inc.", exchange: "NYQ" },
  assetProfile: {
    sector: "Technology",
    industry: "Software—Application",
    fullTimeEmployees: 79390,
    website: "https://www.salesforce.com",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    longBusinessSummary: "Salesforce provides CRM technology.",
    companyOfficers: [{ name: "Marc Benioff", title: "Chairman & CEO" }],
  },
  price: { regularMarketPrice: { raw: 267.43, fmt: "267.43" }, marketCap: { raw: 259e9, fmt: "259B" }, currency: "USD" },
  summaryDetail: { marketCap: { raw: 259e9, fmt: "259B" }, trailingPE: { raw: 46.12, fmt: "46.12" } },
};

const mockYahooFilings = { symbol: "CRM", filings: [] };

const mockLinkedinData = {
  success: true,
  data: {
    name: "Salesforce",
    linkedinUrl: "https://www.linkedin.com/company/salesforce",
    website: "https://www.salesforce.com",
    description: "Salesforce is the global leader in CRM.",
    staffCount: 79000,
    followerCount: 5200000,
    industries: ["Computer Software"],
    specialities: ["CRM", "Cloud Computing"],
  },
};

const mockSecTickers: Record<string, any> = {
  "0": { cik_str: 1108524, ticker: "CRM", title: "SALESFORCE INC" },
};

const mockSecSubmissions = {
  cik: "0001108524",
  name: "SALESFORCE INC",
  sic: "7372",
  sicDescription: "SERVICES-PREPACKAGED SOFTWARE",
  stateOfIncorporation: "DE",
  filings: {
    recent: {
      form: ["10-K"],
      filingDate: ["2024-03-06"],
      accessionNumber: ["0001108524-24-000001"],
    },
  },
};

const mockBLSEmployment = {
  status: "REQUEST_SUCCEEDED",
  Results: {
    series: [{
      seriesID: "CES6054000001",
      data: [
        { year: "2026", period: "M01", value: "9876.0" },
        { year: "2025", period: "M12", value: "9850.0" },
        { year: "2025", period: "M11", value: "9830.0" },
        { year: "2025", period: "M10", value: "9810.0" },
        { year: "2025", period: "M09", value: "9790.0" },
        { year: "2025", period: "M08", value: "9770.0" },
        { year: "2025", period: "M07", value: "9750.0" },
        { year: "2025", period: "M06", value: "9730.0" },
        { year: "2025", period: "M05", value: "9710.0" },
        { year: "2025", period: "M04", value: "9690.0" },
        { year: "2025", period: "M03", value: "9670.0" },
        { year: "2025", period: "M02", value: "9650.0" },
      ],
    }],
  },
};

const mockBLSWage = {
  status: "REQUEST_SUCCEEDED",
  Results: { series: [{ seriesID: "CES6054000008", data: [{ year: "2026", period: "M01", value: "42.50" }] }] },
};

const mockCensusCBP = [
  ["ESTAB", "PAYANN", "EMP", "us"],
  ["450000", "850000000", "9500000", "1"],
];

function createMockFetch() {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    if (urlStr.includes("company_tickers.json")) return { ok: true, json: async () => mockSecTickers } as Response;
    if (urlStr.includes("data.sec.gov/submissions")) return { ok: true, json: async () => mockSecSubmissions } as Response;
    if (urlStr.includes("efts.sec.gov")) return { ok: true, json: async () => ({}) } as Response;
    if (urlStr.includes("api.bls.gov") && urlStr.includes("CES6054000001")) return { ok: true, json: async () => mockBLSEmployment } as Response;
    if (urlStr.includes("api.bls.gov") && urlStr.includes("CES6054000008")) return { ok: true, json: async () => mockBLSWage } as Response;
    if (urlStr.includes("api.bls.gov")) return { ok: true, json: async () => ({ Results: { series: [{ data: [] }] } }) } as Response;
    if (urlStr.includes("api.census.gov")) return { ok: true, json: async () => mockCensusCBP } as Response;

    return originalFetch(url);
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("enrichment caching integration", () => {
  beforeEach(() => {
    mockCallDataApi.mockReset();
    mockGetCached.mockReset().mockResolvedValue(null);
    mockSetCached.mockReset().mockResolvedValue(undefined);
    mockInvalidateCached.mockReset().mockResolvedValue(true);
    mockFetch = createMockFetch();
    globalThis.fetch = mockFetch;
  });

  it("calls setCachedEnrichment after a fresh enrichment (cache miss)", async () => {
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockResolvedValueOnce(mockLinkedinData);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Should have attempted to cache the result
    // Wait a tick for the async cache write
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetCached).toHaveBeenCalledTimes(1);
    expect(mockSetCached).toHaveBeenCalledWith(
      "Salesforce",
      expect.objectContaining({ name: expect.any(String) }),
      expect.any(Number), // confidence
      expect.any(Number), // sourcesSucceeded
      expect.any(Number)  // totalLatencyMs
    );

    // cacheMeta should indicate this is NOT from cache
    expect(result.cacheMeta).toBeDefined();
    expect(result.cacheMeta!.cached).toBe(false);
    expect(result.cacheMeta!.cacheAgeMs).toBe(0);
    expect(result.cacheMeta!.hitCount).toBe(0);
  });

  it("returns cached data on cache hit (no API calls made)", async () => {
    // Simulate a cache hit
    const cachedData = {
      name: "Salesforce",
      sector: "Technology",
      confidence: 85,
      sources: [{ name: "Yahoo Finance", status: "success", fieldsFound: 8 }],
      sourceDetails: [],
      enrichedAt: "2026-03-04T10:00:00.000Z",
    };

    mockGetCached.mockResolvedValueOnce({
      data: cachedData as any,
      meta: {
        cached: true,
        cachedAt: "2026-03-04T10:00:00.000Z",
        cacheAgeMs: 3600000, // 1 hour
        hitCount: 3,
        ttlMs: DEFAULT_CACHE_TTL_MS,
        stale: false,
      },
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Should NOT have called any external APIs
    expect(mockCallDataApi).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    // Should return cached data with cacheMeta
    expect(result.name).toBe("Salesforce");
    expect(result.cacheMeta).toBeDefined();
    expect(result.cacheMeta!.cached).toBe(true);
    expect(result.cacheMeta!.cacheAgeMs).toBe(3600000);
    expect(result.cacheMeta!.hitCount).toBe(3);
    expect(result.cacheMeta!.ttlMs).toBe(DEFAULT_CACHE_TTL_MS);
  });

  it("bypasses cache and invalidates on forceRefresh=true", async () => {
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockResolvedValueOnce(mockLinkedinData);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
      forceRefresh: true,
    });

    // Should have invalidated the old cache entry
    expect(mockInvalidateCached).toHaveBeenCalledWith("Salesforce");

    // Should NOT have checked the cache (getCachedEnrichment should not be called)
    expect(mockGetCached).not.toHaveBeenCalled();

    // Should have called the external APIs
    expect(mockCallDataApi).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalled();

    // Should have stored the fresh result in cache
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSetCached).toHaveBeenCalledTimes(1);

    // cacheMeta should indicate fresh data
    expect(result.cacheMeta!.cached).toBe(false);
  });

  it("calls getCachedEnrichment with the correct TTL", async () => {
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockResolvedValueOnce(mockLinkedinData);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    expect(mockGetCached).toHaveBeenCalledWith("Salesforce", DEFAULT_CACHE_TTL_MS);
  });
});

describe("enrichment.invalidateCache", () => {
  beforeEach(() => {
    mockInvalidateCached.mockReset().mockResolvedValue(true);
  });

  it("calls invalidateCachedEnrichment and returns result", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.invalidateCache({
      companyName: "Salesforce",
    });

    expect(mockInvalidateCached).toHaveBeenCalledWith("Salesforce");
    expect(result.invalidated).toBe(true);
    expect(result.companyName).toBe("Salesforce");
  });

  it("returns invalidated=false when no cache entry exists", async () => {
    mockInvalidateCached.mockResolvedValueOnce(false);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.invalidateCache({
      companyName: "UnknownCorp",
    });

    expect(result.invalidated).toBe(false);
  });
});

describe("enrichment.cacheStats", () => {
  beforeEach(() => {
    mockGetCacheStats.mockReset().mockResolvedValue({ totalEntries: 5, totalHits: 42, avgConfidence: 78 });
  });

  it("returns cache statistics", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.cacheStats();

    expect(result.totalEntries).toBe(5);
    expect(result.totalHits).toBe(42);
    expect(result.avgConfidence).toBe(78);
  });
});
