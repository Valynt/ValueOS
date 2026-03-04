import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the callDataApi function (used by Yahoo Finance + LinkedIn)
vi.mock("./_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

import { callDataApi } from "./_core/dataApi";
const mockCallDataApi = vi.mocked(callDataApi);

// Mock global fetch for SEC EDGAR, BLS, and Census (they use fetch directly)
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
  quoteType: {
    symbol: "CRM",
    longName: "Salesforce, Inc.",
    shortName: "Salesforce",
    exchange: "NYQ",
    market: "us_market",
    quoteType: "EQUITY",
  },
  assetProfile: {
    sector: "Technology",
    industry: "Software—Application",
    fullTimeEmployees: 79390,
    website: "https://www.salesforce.com",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    longBusinessSummary:
      "Salesforce, Inc. provides customer relationship management technology that brings companies and customers together worldwide.",
    companyOfficers: [
      { name: "Marc Benioff", title: "Chairman & CEO" },
      { name: "Amy Weaver", title: "President & CFO" },
    ],
  },
  price: {
    regularMarketPrice: { raw: 267.43, fmt: "267.43" },
    marketCap: { raw: 259000000000, fmt: "259B" },
    currency: "USD",
  },
  summaryDetail: {
    marketCap: { raw: 259000000000, fmt: "259B" },
    trailingPE: { raw: 46.12, fmt: "46.12" },
    dividendYield: { raw: 0.006, fmt: "0.60%" },
    fiftyTwoWeekHigh: { raw: 318.72, fmt: "318.72" },
    fiftyTwoWeekLow: { raw: 212.0, fmt: "212.00" },
  },
};

const mockYahooFilings = {
  symbol: "CRM",
  filings: [
    {
      title: "Annual Report",
      type: "10-K",
      date: "2024-03-06",
      edgarUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001108524",
    },
    {
      title: "Quarterly Report",
      type: "10-Q",
      date: "2024-06-05",
      edgarUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001108524",
    },
  ],
};

const mockLinkedinData = {
  success: true,
  data: {
    name: "Salesforce",
    universalName: "salesforce",
    linkedinUrl: "https://www.linkedin.com/company/salesforce",
    website: "https://www.salesforce.com",
    description: "Salesforce is the global leader in CRM.",
    staffCount: 79000,
    followerCount: 5200000,
    industries: ["Computer Software"],
    specialities: ["CRM", "Cloud Computing", "AI", "Enterprise Software"],
    crunchbaseUrl: "https://www.crunchbase.com/organization/salesforce",
    logo: "https://media.licdn.com/dms/image/salesforce.png",
  },
};

// SEC EDGAR mock responses
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
      form: ["10-K", "10-Q", "8-K"],
      filingDate: ["2024-03-06", "2024-06-05", "2024-07-15"],
      accessionNumber: ["0001108524-24-000001", "0001108524-24-000002", "0001108524-24-000003"],
    },
  },
};

// BLS mock responses
const mockBLSEmployment = {
  status: "REQUEST_SUCCEEDED",
  Results: {
    series: [
      {
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
      },
    ],
  },
};

const mockBLSWage = {
  status: "REQUEST_SUCCEEDED",
  Results: {
    series: [
      {
        seriesID: "CES6054000008",
        data: [{ year: "2026", period: "M01", value: "42.50" }],
      },
    ],
  },
};

// Census mock response
const mockCensusCBP = [
  ["ESTAB", "PAYANN", "EMP", "us"],
  ["450000", "850000000", "9500000", "1"],
];

/**
 * Create a mock fetch that routes SEC EDGAR, BLS, and Census URLs
 * to their respective mock responses.
 */
function createMockFetch(options?: {
  secFail?: boolean;
  blsFail?: boolean;
  censusFail?: boolean;
}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    // SEC EDGAR: company_tickers.json
    if (urlStr.includes("company_tickers.json")) {
      if (options?.secFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => mockSecTickers,
      } as Response;
    }

    // SEC EDGAR: submissions
    if (urlStr.includes("data.sec.gov/submissions")) {
      if (options?.secFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => mockSecSubmissions,
      } as Response;
    }

    // SEC EDGAR: search-index
    if (urlStr.includes("efts.sec.gov")) {
      return { ok: true, json: async () => ({}) } as Response;
    }

    // BLS: employment data
    if (urlStr.includes("api.bls.gov") && urlStr.includes("CES6054000001")) {
      if (options?.blsFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => mockBLSEmployment,
      } as Response;
    }

    // BLS: wage data
    if (urlStr.includes("api.bls.gov") && urlStr.includes("CES6054000008")) {
      if (options?.blsFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => mockBLSWage,
      } as Response;
    }

    // BLS: any other series
    if (urlStr.includes("api.bls.gov")) {
      if (options?.blsFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => ({ Results: { series: [{ data: [] }] } }),
      } as Response;
    }

    // Census Bureau
    if (urlStr.includes("api.census.gov")) {
      if (options?.censusFail) return { ok: false, status: 500 } as Response;
      return {
        ok: true,
        json: async () => mockCensusCBP,
      } as Response;
    }

    // Fallback to original fetch for anything else
    return originalFetch(url, init);
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("enrichment.enrichCompany", () => {
  beforeEach(() => {
    mockCallDataApi.mockReset();
    // Install mock fetch for SEC EDGAR, BLS, Census
    mockFetch = createMockFetch();
    globalThis.fetch = mockFetch;
  });

  it("returns enriched company data from all 5 sources", async () => {
    // callDataApi handles Yahoo Finance + LinkedIn
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile) // YahooFinance/get_stock_profile
      .mockResolvedValueOnce(mockYahooFilings) // YahooFinance/get_stock_sec_filing
      .mockResolvedValueOnce(mockLinkedinData); // LinkedIn/get_company_details

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // ── Overview fields ──
    expect(result).toBeDefined();
    expect(result.name).toBe("Salesforce");
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Software—Application");
    expect(result.employees).toBe(79390);
    expect(result.website).toBe("https://www.salesforce.com");
    expect(result.ticker).toBe("CRM");
    expect(result.headquarters).toContain("San Francisco");

    // ── Financials ──
    expect(result.marketCap).toBe("259B");
    expect(result.stockPrice).toBe("267.43");
    expect(result.peRatio).toBe("46.12");

    // ── LinkedIn data ──
    expect(result.linkedinUrl).toBe("https://www.linkedin.com/company/salesforce");
    expect(result.crunchbaseUrl).toBe("https://www.crunchbase.com/organization/salesforce");
    expect(result.specialties).toContain("CRM");
    expect(result.specialties).toContain("Cloud Computing");

    // ── Executives ──
    expect(result.executives).toHaveLength(2);
    expect(result.executives[0].name).toBe("Marc Benioff");
    expect(result.executives[0].title).toBe("Chairman & CEO");

    // ── SEC EDGAR filings ──
    expect(result.recentFilings.length).toBeGreaterThan(0);
    expect(result.recentFilings[0].type).toBe("10-K");

    // ── BLS data (Industry & Market) ──
    expect(result.industryEmployment).not.toBe("N/A");
    expect(result.industryEmployment).toContain("M"); // e.g. "9.9M"
    expect(result.avgIndustryWage).not.toBe("N/A");
    expect(result.avgIndustryWage).toContain("$"); // e.g. "$42.50/hr"
    expect(result.laborTrend).not.toBe("N/A");
    expect(result.laborTrend).toContain("YoY"); // e.g. "+2.3% YoY"

    // ── Census data ──
    expect(result.marketSizeProxy).not.toBe("N/A");
    expect(result.marketSizeProxy).toContain("$"); // e.g. "$850.0B annual payroll"
    expect(result.establishmentCount).not.toBe("N/A");
    expect(result.establishmentCount).toContain("450"); // 450,000

    // ── Sources: all 5 + cross-reference ──
    expect(result.sources.length).toBeGreaterThanOrEqual(5);
    expect(result.sources.find((s) => s.name === "SEC EDGAR")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "Yahoo Finance")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "LinkedIn")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "BLS (Labor Statistics)")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "Census Bureau")?.status).toBe("success");

    // ── sourceDetails: raw API responses and latency ──
    expect(result.sourceDetails).toBeDefined();
    expect(result.sourceDetails.length).toBeGreaterThanOrEqual(5);

    // Each sourceDetail should have the required shape
    for (const sd of result.sourceDetails) {
      expect(sd).toHaveProperty("name");
      expect(sd).toHaveProperty("status");
      expect(sd).toHaveProperty("fieldsFound");
      expect(sd).toHaveProperty("latencyMs");
      expect(sd).toHaveProperty("endpoint");
      expect(typeof sd.latencyMs).toBe("number");
      expect(sd.latencyMs).toBeGreaterThanOrEqual(0);
    }

    // SEC EDGAR sourceDetail
    const secDetail = result.sourceDetails.find((s) => s.name === "SEC EDGAR");
    expect(secDetail).toBeDefined();
    expect(secDetail!.status).toBe("success");
    expect(secDetail!.rawResponse).toBeDefined();
    expect(secDetail!.rawResponse!.cik).toBe("0001108524");
    expect(secDetail!.rawResponse!.ticker).toBe("CRM");
    expect(secDetail!.rawResponse!.sic).toBe("7372");
    expect(secDetail!.endpoint).toContain("sec.gov");
    expect(secDetail!.error).toBeNull();

    // Yahoo Finance sourceDetail
    const yahooDetail = result.sourceDetails.find((s) => s.name === "Yahoo Finance");
    expect(yahooDetail).toBeDefined();
    expect(yahooDetail!.status).toBe("success");
    expect(yahooDetail!.rawResponse).toBeDefined();
    expect(yahooDetail!.rawResponse!.sector).toBe("Technology");
    expect(yahooDetail!.rawResponse!.industry).toBe("Software\u2014Application");
    expect(yahooDetail!.rawResponse!.fullTimeEmployees).toBe(79390);
    expect(yahooDetail!.httpStatus).toBe(200);

    // LinkedIn sourceDetail
    const liDetail = result.sourceDetails.find((s) => s.name === "LinkedIn");
    expect(liDetail).toBeDefined();
    expect(liDetail!.status).toBe("success");
    expect(liDetail!.rawResponse).toBeDefined();
    expect(liDetail!.rawResponse!.name).toBe("Salesforce");
    expect(liDetail!.rawResponse!.staffCount).toBe(79000);

    // BLS sourceDetail
    const blsDetail = result.sourceDetails.find((s) => s.name === "BLS (Labor Statistics)");
    expect(blsDetail).toBeDefined();
    expect(blsDetail!.status).toBe("success");
    expect(blsDetail!.rawResponse).toBeDefined();
    expect(blsDetail!.rawResponse!.sicCode).toBe("7372");
    expect(blsDetail!.endpoint).toContain("bls.gov");

    // Census sourceDetail
    const censusDetail = result.sourceDetails.find((s) => s.name === "Census Bureau");
    expect(censusDetail).toBeDefined();
    expect(censusDetail!.status).toBe("success");
    expect(censusDetail!.rawResponse).toBeDefined();
    expect(censusDetail!.endpoint).toContain("census.gov");

    // Cross-Reference sourceDetail
    const xrefDetail = result.sourceDetails.find((s) => s.name === "Cross-Reference");
    expect(xrefDetail).toBeDefined();
    expect(xrefDetail!.latencyMs).toBe(0);
    expect(xrefDetail!.rawResponse!.method).toContain("deduplication");

    // ── Confidence should be high with all sources ──
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.enrichedAt).toBeTruthy();

    // ── Verify callDataApi was called for Yahoo + LinkedIn ──
    expect(mockCallDataApi).toHaveBeenCalledTimes(3);
    expect(mockCallDataApi).toHaveBeenCalledWith("YahooFinance/get_stock_profile", {
      query: { symbol: "CRM", region: "US", lang: "en-US" },
    });
    expect(mockCallDataApi).toHaveBeenCalledWith("YahooFinance/get_stock_sec_filing", {
      query: { symbol: "CRM", region: "US", lang: "en-US" },
    });
    expect(mockCallDataApi).toHaveBeenCalledWith("LinkedIn/get_company_details", {
      query: { username: "salesforce" },
    });

    // ── Verify fetch was called for SEC EDGAR, BLS, Census ──
    const fetchCalls = mockFetch.mock.calls.map((c: any) => {
      const url = typeof c[0] === "string" ? c[0] : c[0] instanceof URL ? c[0].toString() : c[0].url;
      return url;
    });
    expect(fetchCalls.some((u: string) => u.includes("sec.gov"))).toBe(true);
    expect(fetchCalls.some((u: string) => u.includes("api.bls.gov"))).toBe(true);
    expect(fetchCalls.some((u: string) => u.includes("api.census.gov"))).toBe(true);
  });

  it("handles partial API failures gracefully — LinkedIn fails", async () => {
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockRejectedValueOnce(new Error("LinkedIn API unavailable"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Yahoo Finance data should still be present
    expect(result.name).toBe("Salesforce, Inc.");
    expect(result.sector).toBe("Technology");
    expect(result.employees).toBe(79390);

    // LinkedIn fields should be empty/default
    expect(result.linkedinUrl).toBe("");
    expect(result.specialties).toEqual([]);

    // LinkedIn source should show failed
    const linkedinSource = result.sources.find((s) => s.name === "LinkedIn");
    expect(linkedinSource?.status).toBe("failed");
    expect(linkedinSource?.fieldsFound).toBe(0);

    // LinkedIn sourceDetail should have error
    const liDetail = result.sourceDetails.find((s) => s.name === "LinkedIn");
    expect(liDetail).toBeDefined();
    expect(liDetail!.status).toBe("failed");
    expect(liDetail!.rawResponse).toBeNull();
    expect(liDetail!.error).toBeTruthy();

    // BLS and Census should still succeed (they use SIC from SEC EDGAR)
    expect(result.sources.find((s) => s.name === "BLS (Labor Statistics)")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "Census Bureau")?.status).toBe("success");
  });

  it("handles BLS and Census failures gracefully", async () => {
    // Install mock fetch with BLS and Census failures
    mockFetch = createMockFetch({ blsFail: true, censusFail: true });
    globalThis.fetch = mockFetch;

    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockResolvedValueOnce(mockLinkedinData);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Core data should still be present
    expect(result.name).toBe("Salesforce");
    expect(result.sector).toBe("Technology");

    // BLS fields should be N/A
    expect(result.industryEmployment).toBe("N/A");
    expect(result.avgIndustryWage).toBe("N/A");
    expect(result.laborTrend).toBe("N/A");

    // Census fields should be N/A
    expect(result.marketSizeProxy).toBe("N/A");
    expect(result.establishmentCount).toBe("N/A");

    // Yahoo + LinkedIn should still succeed
    expect(result.sources.find((s) => s.name === "Yahoo Finance")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "LinkedIn")?.status).toBe("success");

    // BLS and Census sourceDetails should show partial (SIC code exists but data fetch failed)
    const blsDetail = result.sourceDetails.find((s) => s.name === "BLS (Labor Statistics)");
    expect(blsDetail).toBeDefined();
    expect(["partial", "failed"]).toContain(blsDetail!.status);
    expect(blsDetail!.error).toBeTruthy();

    const censusDetail = result.sourceDetails.find((s) => s.name === "Census Bureau");
    expect(censusDetail).toBeDefined();
    expect(["partial", "failed"]).toContain(censusDetail!.status);
    expect(censusDetail!.error).toBeTruthy();
  });

  it("handles all APIs failing gracefully", async () => {
    // Install mock fetch with all external failures
    mockFetch = createMockFetch({ secFail: true, blsFail: true, censusFail: true });
    globalThis.fetch = mockFetch;

    mockCallDataApi
      .mockRejectedValueOnce(new Error("Yahoo Finance down"))
      .mockRejectedValueOnce(new Error("SEC EDGAR down"))
      .mockRejectedValueOnce(new Error("LinkedIn down"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Should return a shell with the input name
    expect(result.name).toBe("Salesforce");
    expect(result.confidence).toBeLessThanOrEqual(15);

    // All BLS/Census fields should be N/A
    expect(result.industryEmployment).toBe("N/A");
    expect(result.avgIndustryWage).toBe("N/A");
    expect(result.laborTrend).toBe("N/A");
    expect(result.marketSizeProxy).toBe("N/A");
    expect(result.establishmentCount).toBe("N/A");

    // All sourceDetails should have errors
    expect(result.sourceDetails).toBeDefined();
    for (const sd of result.sourceDetails) {
      if (sd.name !== "Cross-Reference") {
        expect(sd.status).toBe("failed");
        expect(sd.error).toBeTruthy();
      }
    }
  });

  it("returns BLS sector label based on SIC code mapping", async () => {
    // SIC 7372 maps to "Professional & Business Services" in our mapping
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile)
      .mockResolvedValueOnce(mockYahooFilings)
      .mockResolvedValueOnce(mockLinkedinData);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // BLS should have found data based on SIC 7372 → sector 73 → Professional & Business Services
    const blsSource = result.sources.find((s) => s.name === "BLS (Labor Statistics)");
    expect(blsSource).toBeDefined();
    expect(blsSource!.fieldsFound).toBeGreaterThan(0);
  });
});

describe("enrichment.lookupTicker", () => {
  beforeEach(() => {
    mockCallDataApi.mockReset();
  });

  it("returns ticker info for a known company", async () => {
    mockCallDataApi.mockResolvedValueOnce({
      quoteType: { longName: "Salesforce, Inc.", exchange: "NYQ" },
      price: { regularMarketPrice: { fmt: "267.43" }, marketCap: { fmt: "259B" } },
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.lookupTicker({ query: "Salesforce" });

    expect(result.found).toBe(true);
    expect(result.ticker).toBe("CRM");
    expect(result.name).toBe("Salesforce, Inc.");
    expect(result.price).toBe("267.43");
  });

  it("returns found=false when API fails", async () => {
    mockCallDataApi.mockRejectedValueOnce(new Error("API error"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.lookupTicker({ query: "UnknownCorp" });

    expect(result.found).toBe(false);
    expect(result.name).toBe("UnknownCorp");
  });
});
