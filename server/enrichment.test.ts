import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the callDataApi function
vi.mock("./_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

import { callDataApi } from "./_core/dataApi";
const mockCallDataApi = vi.mocked(callDataApi);

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

// Sample API responses matching real YahooFinance/LinkedIn shapes
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

describe("enrichment.enrichCompany", () => {
  beforeEach(() => {
    mockCallDataApi.mockReset();
  });

  it("returns enriched company data when all APIs succeed", async () => {
    // Setup mocks for all three API calls
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile) // YahooFinance/get_stock_profile
      .mockResolvedValueOnce(mockYahooFilings) // YahooFinance/get_stock_sec_filing
      .mockResolvedValueOnce(mockLinkedinData); // LinkedIn/get_company_details

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Verify the enriched data structure
    expect(result).toBeDefined();
    expect(result.name).toBe("Salesforce");
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Software—Application");
    expect(result.employees).toBe(79390);
    expect(result.website).toBe("https://www.salesforce.com");
    expect(result.ticker).toBe("CRM");

    // Verify financials
    expect(result.marketCap).toBe("259B");
    expect(result.stockPrice).toBe("267.43");
    expect(result.peRatio).toBe("46.12");

    // Verify LinkedIn data merged
    expect(result.linkedinUrl).toBe("https://www.linkedin.com/company/salesforce");
    expect(result.crunchbaseUrl).toBe("https://www.crunchbase.com/organization/salesforce");
    expect(result.specialties).toContain("CRM");
    expect(result.specialties).toContain("Cloud Computing");

    // Verify executives
    expect(result.executives).toHaveLength(2);
    expect(result.executives[0].name).toBe("Marc Benioff");
    expect(result.executives[0].title).toBe("Chairman & CEO");

    // Verify SEC filings
    expect(result.recentFilings).toHaveLength(2);
    expect(result.recentFilings[0].type).toBe("10-K");

    // Verify sources
    expect(result.sources).toHaveLength(3);
    expect(result.sources.find((s) => s.name === "Yahoo Finance")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "SEC EDGAR")?.status).toBe("success");
    expect(result.sources.find((s) => s.name === "LinkedIn")?.status).toBe("success");

    // Verify confidence > 0
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.enrichedAt).toBeTruthy();

    // Verify all three APIs were called
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
  });

  it("handles partial API failures gracefully", async () => {
    // YahooFinance succeeds, LinkedIn fails
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile) // profile succeeds
      .mockResolvedValueOnce(mockYahooFilings) // filings succeed
      .mockRejectedValueOnce(new Error("LinkedIn API unavailable")); // linkedin fails

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrichment.enrichCompany({
      companyName: "Salesforce",
    });

    // Should still return data from Yahoo Finance
    expect(result.name).toBe("Salesforce, Inc.");
    expect(result.sector).toBe("Technology");
    expect(result.employees).toBe(79390);

    // LinkedIn fields should be empty/default
    expect(result.linkedinUrl).toBe("");
    expect(result.specialties).toEqual([]);

    // Sources should reflect the failure
    const linkedinSource = result.sources.find((s) => s.name === "LinkedIn");
    expect(linkedinSource?.status).toBe("failed");
    expect(linkedinSource?.fieldsFound).toBe(0);
  });

  it("handles all APIs failing gracefully", async () => {
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
    expect(result.confidence).toBe(0);
    expect(result.sources.every((s) => s.status === "failed")).toBe(true);
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
