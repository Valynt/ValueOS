/**
 * Tool Executor Tests — Live API Integration
 *
 * Tests the agent tool executor functions and the shared enrichment service.
 * Mocks external API calls (SEC EDGAR, BLS, Census, Yahoo Finance, LinkedIn)
 * to validate the tool execution pipeline without hitting real endpoints.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock external dependencies ──────────────────────────────────────────────

// Mock the dataApi module (used by Yahoo Finance and LinkedIn)
vi.mock("../server/_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

// Mock the togetherClient module (used by LLM-powered tools)
vi.mock("../server/togetherClient", () => ({
  together: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODELS: {
    chat: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    toolCalling: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    reasoning: "deepseek-ai/DeepSeek-R1",
    vision: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    fast: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  },
}));

// Mock the enrichment cache (so we don't need a database)
vi.mock("../server/enrichmentCache", () => ({
  getCachedEnrichment: vi.fn().mockResolvedValue(null),
  setCachedEnrichment: vi.fn().mockResolvedValue(undefined),
  DEFAULT_CACHE_TTL_MS: 86400000,
}));

// Mock global fetch for SEC EDGAR, BLS, Census direct API calls
const originalFetch = global.fetch;
const mockFetch = vi.fn();

import { callDataApi } from "../server/_core/dataApi";
import { together } from "../server/togetherClient";
import { getCachedEnrichment, setCachedEnrichment } from "../server/enrichmentCache";

const mockCallDataApi = callDataApi as ReturnType<typeof vi.fn>;
const mockTogetherCreate = together.chat.completions.create as ReturnType<typeof vi.fn>;
const mockGetCached = getCachedEnrichment as ReturnType<typeof vi.fn>;
const mockSetCached = setCachedEnrichment as ReturnType<typeof vi.fn>;

// ── Import modules under test ───────────────────────────────────────────────

import { executeTool } from "../server/agents/tools";
import {
  fetchSECCompany,
  searchSECFilings,
  fetchBLSData,
  fetchCensusData,
  fetchYahooFinance,
  fetchLinkedIn,
  guessTickerFromName,
  runFullEnrichment,
} from "../server/lib/enrichmentService";

// ── Test fixtures ───────────────────────────────────────────────────────────

const mockSECTickers = {
  "0": { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" },
  "1": { cik_str: 320193, ticker: "AAPL", title: "APPLE INC" },
  "2": { cik_str: 1326801, ticker: "META", title: "META PLATFORMS INC" },
};

const mockSECSubmissions = {
  cik: "0000789019",
  name: "MICROSOFT CORP",
  sic: "7372",
  sicDescription: "PREPACKAGED SOFTWARE",
  stateOfIncorporation: "WA",
  filings: {
    recent: {
      form: ["10-K", "10-Q", "8-K", "10-Q", "8-K"],
      filingDate: ["2025-07-30", "2025-04-25", "2025-03-15", "2025-01-28", "2024-12-10"],
      accessionNumber: ["0000789019-25-000001", "0000789019-25-000002", "0000789019-25-000003", "0000789019-25-000004", "0000789019-24-000005"],
    },
  },
};

const mockYahooProfile = {
  assetProfile: {
    sector: "Technology",
    industry: "Software—Infrastructure",
    fullTimeEmployees: 228000,
    website: "https://www.microsoft.com",
    longBusinessSummary: "Microsoft Corporation develops and supports software, services, devices, and solutions worldwide.",
    city: "Redmond",
    state: "WA",
    country: "United States",
    companyOfficers: [
      { name: "Satya Nadella", title: "Chairman & CEO" },
      { name: "Amy Hood", title: "CFO" },
    ],
  },
  price: {
    regularMarketPrice: { raw: 425.50, fmt: "425.50" },
    marketCap: { raw: 3160000000000, fmt: "3.16T" },
    revenue: { raw: 245000000000, fmt: "245B" },
    currency: "USD",
  },
  summaryDetail: {
    marketCap: { raw: 3160000000000, fmt: "3.16T" },
    trailingPE: { raw: 35.2, fmt: "35.20" },
    dividendYield: { raw: 0.007, fmt: "0.70%" },
    fiftyTwoWeekHigh: { raw: 468.35, fmt: "468.35" },
    fiftyTwoWeekLow: { raw: 362.90, fmt: "362.90" },
    totalRevenue: { raw: 245000000000, fmt: "245B" },
  },
  quoteType: {
    longName: "Microsoft Corporation",
    shortName: "MSFT",
    exchange: "NMS",
  },
};

const mockLinkedInData = {
  data: {
    name: "Microsoft",
    description: "Every company has a mission.",
    staffCount: 228000,
    website: "https://www.microsoft.com",
    industries: ["Technology, Information and Internet"],
    specialities: ["Cloud Computing", "AI", "Enterprise Software"],
    followerCount: 20000000,
    foundedOn: { year: 1975 },
    headquarter: { city: "Redmond", geographicArea: "WA", country: "US" },
    linkedinUrl: "https://www.linkedin.com/company/microsoft",
  },
};

const mockBLSEmployment = {
  Results: {
    series: [
      {
        seriesID: "CES6054000001",
        data: [
          { year: "2026", period: "M02", value: "9800.0" },
          { year: "2026", period: "M01", value: "9750.0" },
          { year: "2025", period: "M12", value: "9700.0" },
          { year: "2025", period: "M11", value: "9650.0" },
          { year: "2025", period: "M10", value: "9600.0" },
          { year: "2025", period: "M09", value: "9550.0" },
          { year: "2025", period: "M08", value: "9500.0" },
          { year: "2025", period: "M07", value: "9450.0" },
          { year: "2025", period: "M06", value: "9400.0" },
          { year: "2025", period: "M05", value: "9350.0" },
          { year: "2025", period: "M04", value: "9300.0" },
          { year: "2025", period: "M03", value: "9250.0" },
        ],
      },
    ],
  },
};

const mockBLSWage = {
  Results: {
    series: [
      {
        seriesID: "CES6054000008",
        data: [{ year: "2026", period: "M02", value: "45.50" }],
      },
    ],
  },
};

const mockCensusData = [
  ["ESTAB", "PAYANN", "EMP", "us"],
  ["450000", "850000000", "9500000", "1"],
];

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ── Helper to set up fetch mocks ────────────────────────────────────────────

function setupSECMocks() {
  mockFetch.mockImplementation(async (url: string) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.includes("company_tickers.json")) {
      return { ok: true, json: async () => mockSECTickers };
    }
    if (urlStr.includes("data.sec.gov/submissions")) {
      return { ok: true, json: async () => mockSECSubmissions };
    }
    if (urlStr.includes("efts.sec.gov")) {
      return {
        ok: true,
        json: async () => ({
          hits: {
            total: { value: 5 },
            hits: [
              {
                _source: {
                  form_type: "10-K",
                  file_date: "2025-07-30",
                  display_names: ["MICROSOFT CORP"],
                  entity_id: "0000789019",
                  file_num: "0000789019-25-000001",
                },
              },
            ],
          },
        }),
      };
    }
    // BLS
    if (urlStr.includes("api.bls.gov")) {
      if (urlStr.includes("CES6054000008") || urlStr.includes("wageSeriesId")) {
        return { ok: true, json: async () => mockBLSWage };
      }
      return { ok: true, json: async () => mockBLSEmployment };
    }
    // Census
    if (urlStr.includes("api.census.gov")) {
      return { ok: true, json: async () => mockCensusData };
    }

    return { ok: false, status: 404, text: async () => "Not found" };
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Enrichment Service — guessTickerFromName", () => {
  it("maps known company names to tickers", () => {
    expect(guessTickerFromName("Microsoft")).toBe("MSFT");
    expect(guessTickerFromName("salesforce")).toBe("CRM");
    expect(guessTickerFromName("APPLE")).toBe("AAPL");
    expect(guessTickerFromName("Goldman Sachs")).toBe("GS");
  });

  it("falls back to uppercase truncation for unknown companies", () => {
    expect(guessTickerFromName("Acme Corp")).toBe("ACMEC");
    expect(guessTickerFromName("xyz")).toBe("XYZ");
  });
});

describe("Enrichment Service — fetchSECCompany", () => {
  it("resolves a company from SEC EDGAR by name", async () => {
    setupSECMocks();
    const result = await fetchSECCompany("Microsoft");

    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("MSFT");
    expect(result!.name).toBe("MICROSOFT CORP");
    expect(result!.sic).toBe("7372");
    expect(result!.sicDescription).toBe("PREPACKAGED SOFTWARE");
    expect(result!.filings.length).toBeGreaterThan(0);
    expect(result!.filings[0].form).toBe("10-K");
  });

  it("returns null for unknown companies", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("company_tickers.json")) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false };
    });

    const result = await fetchSECCompany("NonexistentCorp12345");
    expect(result).toBeNull();
  });
});

describe("Enrichment Service — searchSECFilings", () => {
  it("searches EFTS for company filings", async () => {
    setupSECMocks();
    const result = await searchSECFilings("Microsoft", "10-K");

    expect(result.status).toBe("success");
    expect(result.filings.length).toBeGreaterThan(0);
    expect(result.filings[0].form).toBe("10-K");
    expect(result.totalHits).toBeGreaterThan(0);
  });
});

describe("Enrichment Service — fetchBLSData", () => {
  it("fetches employment and wage data for a valid SIC code", async () => {
    setupSECMocks();
    const result = await fetchBLSData("7372");

    expect(result.sectorLabel).toBe("Professional & Business Services");
    expect(result.industryEmployment).not.toBe("N/A");
    expect(result.avgHourlyWage).toContain("$");
    expect(result.laborTrend).toContain("YoY");
  });

  it("returns N/A for undefined SIC code", async () => {
    const result = await fetchBLSData(undefined);

    expect(result.industryEmployment).toBe("N/A");
    expect(result.avgHourlyWage).toBe("N/A");
    expect(result.laborTrend).toBe("N/A");
    expect(result.sectorLabel).toBe("N/A");
  });

  it("returns N/A for unmapped SIC code", async () => {
    const result = await fetchBLSData("9999");

    expect(result.industryEmployment).toBe("N/A");
    expect(result.sectorLabel).toBe("N/A");
  });
});

describe("Enrichment Service — fetchCensusData", () => {
  it("fetches establishment count and market size for a valid SIC code", async () => {
    setupSECMocks();
    const result = await fetchCensusData("7372");

    expect(result.establishmentCount).not.toBe("N/A");
    expect(result.marketSizeProxy).toContain("$");
    expect(result.marketSizeProxy).toContain("annual payroll");
  });

  it("returns N/A for undefined SIC code", async () => {
    const result = await fetchCensusData(undefined);

    expect(result.marketSizeProxy).toBe("N/A");
    expect(result.establishmentCount).toBe("N/A");
  });
});

describe("Enrichment Service — fetchYahooFinance", () => {
  it("fetches stock profile via Data API", async () => {
    mockCallDataApi.mockResolvedValue(mockYahooProfile);
    const result = await fetchYahooFinance("Microsoft");

    expect(result.status).toBe("success");
    expect(result.ticker).toBe("MSFT");
    expect(result.name).toBe("Microsoft Corporation");
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Software—Infrastructure");
    expect(result.employees).toBe(228000);
    expect(result.executives.length).toBeGreaterThan(0);
    expect(result.executives[0].name).toBe("Satya Nadella");
  });

  it("handles Data API failure gracefully", async () => {
    mockCallDataApi.mockRejectedValue(new Error("API timeout"));
    const result = await fetchYahooFinance("Microsoft");

    expect(result.status).toBe("error");
    expect(result.error).toContain("API timeout");
  });
});

describe("Enrichment Service — fetchLinkedIn", () => {
  it("fetches company details via Data API", async () => {
    mockCallDataApi.mockResolvedValue(mockLinkedInData);
    const result = await fetchLinkedIn("Microsoft");

    expect(result.status).toBe("success");
    expect(result.name).toBe("Microsoft");
    expect(result.staffCount).toBe(228000);
    expect(result.industries).toContain("Technology, Information and Internet");
    expect(result.specialties).toContain("Cloud Computing");
    expect(result.linkedinUrl).toContain("linkedin.com");
  });

  it("handles Data API failure gracefully", async () => {
    mockCallDataApi.mockRejectedValue(new Error("LinkedIn rate limit"));
    const result = await fetchLinkedIn("Microsoft");

    expect(result.status).toBe("error");
    expect(result.error).toContain("LinkedIn rate limit");
  });
});

describe("Enrichment Service — runFullEnrichment", () => {
  it("runs the full 5-source pipeline and merges results", async () => {
    setupSECMocks();
    // Yahoo Finance and LinkedIn go through callDataApi
    mockCallDataApi
      .mockResolvedValueOnce(mockYahooProfile) // Yahoo Finance
      .mockResolvedValueOnce(mockLinkedInData); // LinkedIn

    const result = await runFullEnrichment("Microsoft");

    expect(result.companyName).toBeTruthy();
    expect(result.ticker).toBe("MSFT");
    expect(result.industry).toBeTruthy();
    expect(result.sources.length).toBe(5); // SEC, Yahoo, LinkedIn, BLS, Census
    expect(result.confidence).toBeGreaterThan(0);

    // Verify all 5 sources are present
    const sourceNames = result.sources.map((s) => s.name);
    expect(sourceNames).toContain("SEC EDGAR");
    expect(sourceNames).toContain("Yahoo Finance");
    expect(sourceNames).toContain("LinkedIn");
    expect(sourceNames).toContain("BLS");
    expect(sourceNames).toContain("Census Bureau");
  });
});

describe("Tool Executor — executeTool", () => {
  describe("enrich_company", () => {
    it("returns enrichment data from live APIs (cache miss)", async () => {
      setupSECMocks();
      mockGetCached.mockResolvedValue(null);
      mockCallDataApi
        .mockResolvedValueOnce(mockYahooProfile)
        .mockResolvedValueOnce(mockLinkedInData);

      const result = JSON.parse(
        await executeTool("enrich_company", { companyName: "Microsoft" })
      );

      expect(result.tool).toBe("enrich_company");
      expect(result.status).toBe("success");
      expect(result.cached).toBe(false);
      expect(result.ticker).toBe("MSFT");
      expect(result.sources).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // Verify cache was set
      expect(mockSetCached).toHaveBeenCalled();
    });

    it("returns cached data on cache hit", async () => {
      mockGetCached.mockResolvedValue({
        data: {
          companyName: "Microsoft Corporation",
          ticker: "MSFT",
          industry: "Software—Infrastructure",
          sector: "Technology",
          sicCode: "7372",
          employees: 228000,
          headquarters: "Redmond, WA, United States",
          website: "https://www.microsoft.com",
          description: "Microsoft develops software.",
          revenue: "245B",
          marketCap: "3.16T",
          stockPrice: "425.50",
          industryEmployment: "9.8M",
          avgIndustryWage: "$45.50/hr",
          laborTrend: "+5.9% YoY",
          marketSizeProxy: "$850.0B annual payroll",
          establishmentCount: "450,000",
          executives: [{ name: "Satya Nadella", title: "CEO" }],
          recentFilings: [{ form: "10-K", filingDate: "2025-07-30", accessionNumber: "test" }],
          sources: [{ name: "SEC EDGAR", status: "success", fieldsFound: 6 }],
          confidence: 85,
        },
        meta: {
          cached: true,
          cachedAt: new Date().toISOString(),
          cacheAgeMs: 3600000,
          hitCount: 3,
          ttlMs: 86400000,
          stale: false,
        },
      });

      const result = JSON.parse(
        await executeTool("enrich_company", { companyName: "Microsoft" })
      );

      expect(result.tool).toBe("enrich_company");
      expect(result.status).toBe("success");
      expect(result.cached).toBe(true);
      expect(result.ticker).toBe("MSFT");
    });
  });

  describe("search_sec_filings", () => {
    it("returns SEC filing results", async () => {
      setupSECMocks();
      const result = JSON.parse(
        await executeTool("search_sec_filings", {
          companyName: "Microsoft",
          formType: "10-K",
        })
      );

      expect(result.tool).toBe("search_sec_filings");
      expect(result.status).toBe("success");
      expect(result.filings).toBeDefined();
      expect(result.edgarUrl).toBeDefined();
    });
  });

  describe("lookup_industry_data", () => {
    it("returns BLS and Census data for a SIC code", async () => {
      setupSECMocks();
      const result = JSON.parse(
        await executeTool("lookup_industry_data", { sicCode: "7372" })
      );

      expect(result.tool).toBe("lookup_industry_data");
      expect(result.status).toBe("success");
      expect(result.bls).toBeDefined();
      expect(result.census).toBeDefined();
      expect(result.bls.sectorLabel).toBe("Professional & Business Services");
    });
  });

  describe("validate_claim (LLM-powered)", () => {
    it("returns a structured verdict from the LLM", async () => {
      mockTogetherCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: "VERIFIED",
                tier: "Tier 1: EDGAR/Verified",
                tierLevel: 1,
                confidence: 92,
                reasoning: "Revenue figure matches 10-K filing",
                suggestedSources: ["SEC EDGAR 10-K"],
              }),
            },
          },
        ],
      });

      const result = JSON.parse(
        await executeTool("validate_claim", {
          claim: "Microsoft revenue is $245B",
          companyName: "Microsoft",
          sources: ["SEC EDGAR"],
        })
      );

      expect(result.tool).toBe("validate_claim");
      expect(result.status).toBe("success");
      expect(result.verdict).toBe("VERIFIED");
      expect(result.tierLevel).toBe(1);
      expect(result.confidence).toBe(92);
    });
  });

  describe("build_value_tree (LLM-powered)", () => {
    it("returns a structured value tree", async () => {
      // Mock Yahoo Finance for context enrichment
      mockCallDataApi.mockResolvedValue(mockYahooProfile);

      mockTogetherCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                totalValue: 4200000,
                roi: "340%",
                paybackMonths: 8,
                categories: [
                  {
                    name: "Cost Reduction",
                    value: 2500000,
                    confidence: 85,
                    items: [{ description: "Server consolidation", value: 1500000, evidenceTier: 1 }],
                  },
                ],
                scenarios: { conservative: 2800000, base: 4200000, optimistic: 5600000 },
                topRisks: ["Implementation timeline", "Change management"],
              }),
            },
          },
        ],
      });

      const result = JSON.parse(
        await executeTool("build_value_tree", {
          companyName: "Microsoft",
          hypotheses: ["Server consolidation saves $1.5M", "License optimization saves $1M"],
          timeHorizonMonths: 36,
        })
      );

      expect(result.tool).toBe("build_value_tree");
      expect(result.status).toBe("success");
      expect(result.totalValue).toBe(4200000);
      expect(result.categories).toBeDefined();
      expect(result.scenarios).toBeDefined();
    });
  });

  describe("DeepSeek-R1 think token stripping", () => {
    it("strips <think> tokens from stress_test_assumption output", async () => {
      mockTogetherCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: `<think>Let me analyze this assumption carefully. The user claims a 4:1 consolidation ratio which seems optimistic.</think>
{
  "objections": [{"objection": "Consolidation ratio is optimistic", "severity": "High", "evidence": "Industry average is 3:1", "mitigation": "Run pilot test"}],
  "worstCaseImpact": "50% reduction in projected savings",
  "alternativeInterpretation": "Could be 3:1 with newer hardware",
  "overallRisk": "Medium"
}`,
            },
          },
        ],
      });

      const result = JSON.parse(
        await executeTool("stress_test_assumption", {
          assumption: "4:1 server consolidation ratio",
          context: "Enterprise data center migration",
        })
      );

      expect(result.tool).toBe("stress_test_assumption");
      expect(result.status).toBe("success");
      expect(result.objections).toBeDefined();
      expect(result.overallRisk).toBe("Medium");
      // Verify no <think> tokens leaked into the result
      expect(JSON.stringify(result)).not.toContain("<think>");
    });
  });

  describe("unknown tool handling", () => {
    it("returns an error for unknown tool names", async () => {
      const result = JSON.parse(
        await executeTool("nonexistent_tool", {})
      );

      expect(result.error).toContain("Unknown tool");
    });
  });
});
