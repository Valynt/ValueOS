import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { callDataApi } from "../_core/dataApi";

// ── Shared types ──────────────────────────────────────────────────────────────

interface EnrichedCompany {
  // Overview
  name: string;
  domain: string;
  description: string;
  industry: string;
  sector: string;
  founded: string;
  headquarters: string;
  employees: number | null;
  website: string;
  logo: string;
  linkedinUrl: string;
  crunchbaseUrl: string;

  // Financials
  revenue: string;
  marketCap: string;
  stockPrice: string;
  peRatio: string;
  dividendYield: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  currency: string;
  exchange: string;
  ticker: string;

  // Intelligence
  specialties: string[];
  executives: { name: string; title: string }[];
  recentFilings: { title: string; type: string; date: string; url: string }[];

  // Industry & Market Data (BLS / Census)
  industryEmployment: string;
  avgIndustryWage: string;
  laborTrend: string;
  marketSizeProxy: string;
  establishmentCount: string;

  // Metadata
  sources: { name: string; status: "success" | "partial" | "failed"; fieldsFound: number }[];
  confidence: number;
  enrichedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a company name to a likely stock ticker. Falls back to the name itself. */
function guessTickerFromName(name: string): string {
  const map: Record<string, string> = {
    salesforce: "CRM",
    microsoft: "MSFT",
    apple: "AAPL",
    google: "GOOGL",
    alphabet: "GOOGL",
    amazon: "AMZN",
    meta: "META",
    facebook: "META",
    tesla: "TSLA",
    nvidia: "NVDA",
    snowflake: "SNOW",
    servicenow: "NOW",
    workday: "WDAY",
    oracle: "ORCL",
    ibm: "IBM",
    sap: "SAP",
    adobe: "ADBE",
    cisco: "CSCO",
    intel: "INTC",
    amd: "AMD",
    netflix: "NFLX",
    uber: "UBER",
    airbnb: "ABNB",
    shopify: "SHOP",
    zoom: "ZM",
    palantir: "PLTR",
    crowdstrike: "CRWD",
    datadog: "DDOG",
    cloudflare: "NET",
    twilio: "TWLO",
    hubspot: "HUBS",
    atlassian: "TEAM",
    stripe: "STRIP",
    databricks: "DBR",
    mongodb: "MDB",
    elastic: "ESTC",
    confluent: "CFLT",
    hashicorp: "HCP",
    paloalto: "PANW",
    fortinet: "FTNT",
    zscaler: "ZS",
    okta: "OKTA",
    splunk: "SPLK",
    vmware: "VMW",
    dell: "DELL",
    hp: "HPQ",
    accenture: "ACN",
    deloitte: "DL",
    jpmorgan: "JPM",
    goldman: "GS",
    "goldman sachs": "GS",
    "bank of america": "BAC",
    walmart: "WMT",
    target: "TGT",
    costco: "COST",
    disney: "DIS",
    boeing: "BA",
    lockheed: "LMT",
    raytheon: "RTX",
    pfizer: "PFE",
    johnson: "JNJ",
    "johnson & johnson": "JNJ",
    unitedhealth: "UNH",
  };
  const lower = name.toLowerCase().trim();
  return map[lower] || name.toUpperCase().replace(/\s+/g, "").slice(0, 5);
}

/** Guess LinkedIn username from company name */
function guessLinkedInUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");
}

function fmt(val: unknown, fallback = "N/A"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object" && "fmt" in (val as any)) return (val as any).fmt ?? fallback;
  if (typeof val === "object" && "raw" in (val as any)) return String((val as any).raw);
  return String(val);
}

// ── BLS Helpers ──────────────────────────────────────────────────────────────

/**
 * Map SIC 2-digit prefix to BLS CES super-sector series IDs.
 * CES series format: CES{sectorCode}01000001 (all employees)
 * Wage series format: CES{sectorCode}01000008 (avg hourly earnings)
 */
const SIC_TO_BLS_SECTOR: Record<string, { seriesId: string; wageSeriesId: string; label: string }> = {
  "73": { seriesId: "CES6054000001", wageSeriesId: "CES6054000008", label: "Professional & Business Services" },
  "35": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "36": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "37": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "48": { seriesId: "CES5000000001", wageSeriesId: "CES5000000008", label: "Information" },
  "50": { seriesId: "CES4142000001", wageSeriesId: "CES4142000008", label: "Wholesale Trade" },
  "51": { seriesId: "CES4200000001", wageSeriesId: "CES4200000008", label: "Retail Trade" },
  "52": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "53": { seriesId: "CES5553000001", wageSeriesId: "CES5553000008", label: "Real Estate" },
  "60": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "61": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "62": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "70": { seriesId: "CES7000000001", wageSeriesId: "CES7000000008", label: "Leisure & Hospitality" },
  "72": { seriesId: "CES7000000001", wageSeriesId: "CES7000000008", label: "Leisure & Hospitality" },
  "80": { seriesId: "CES6562000001", wageSeriesId: "CES6562000008", label: "Health Care" },
  "82": { seriesId: "CES6561000001", wageSeriesId: "CES6561000008", label: "Educational Services" },
};

interface BLSResult {
  industryEmployment: string;
  avgHourlyWage: string;
  laborTrend: string;
  sectorLabel: string;
}

async function fetchBLSData(sicCode: string | undefined): Promise<BLSResult> {
  const result: BLSResult = {
    industryEmployment: "N/A",
    avgHourlyWage: "N/A",
    laborTrend: "N/A",
    sectorLabel: "N/A",
  };

  if (!sicCode) return result;

  const sicPrefix = sicCode.substring(0, 2);
  const mapping = SIC_TO_BLS_SECTOR[sicPrefix];
  if (!mapping) return result;

  result.sectorLabel = mapping.label;
  const currentYear = String(new Date().getFullYear());
  const prevYear = String(new Date().getFullYear() - 1);

  try {
    // Fetch employment data via BLS public API
    const empUrl = new URL("https://api.bls.gov/publicAPI/v2/timeseries/data/");
    empUrl.searchParams.set("seriesid", mapping.seriesId);
    empUrl.searchParams.set("startyear", prevYear);
    empUrl.searchParams.set("endyear", currentYear);

    const empResp = await fetch(empUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (empResp.ok) {
      const empData = await empResp.json();
      const series = empData?.Results?.series?.[0];
      if (series?.data?.length > 0) {
        const latestValue = parseFloat(series.data[0].value);
        result.industryEmployment = `${(latestValue / 1000).toFixed(1)}M`;

        // Calculate YoY trend if we have enough data points
        if (series.data.length >= 12) {
          const currentVal = parseFloat(series.data[0].value);
          const yearAgoVal = parseFloat(series.data[11].value);
          const pctChange = ((currentVal - yearAgoVal) / yearAgoVal) * 100;
          result.laborTrend = pctChange >= 0
            ? `+${pctChange.toFixed(1)}% YoY`
            : `${pctChange.toFixed(1)}% YoY`;
        }
      }
    }

    // Fetch average hourly earnings
    const wageUrl = new URL("https://api.bls.gov/publicAPI/v2/timeseries/data/");
    wageUrl.searchParams.set("seriesid", mapping.wageSeriesId);
    wageUrl.searchParams.set("startyear", currentYear);
    wageUrl.searchParams.set("endyear", currentYear);

    const wageResp = await fetch(wageUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (wageResp.ok) {
      const wageData = await wageResp.json();
      const wageSeries = wageData?.Results?.series?.[0];
      if (wageSeries?.data?.length > 0) {
        result.avgHourlyWage = `$${parseFloat(wageSeries.data[0].value).toFixed(2)}/hr`;
      }
    }
  } catch (err) {
    console.error("[Enrichment] BLS fetch failed:", err);
  }

  return result;
}

// ── Census Helpers ───────────────────────────────────────────────────────────

/**
 * Map SIC 2-digit prefix to NAICS 2-digit sector for Census CBP lookup.
 */
const SIC_TO_NAICS: Record<string, string> = {
  "73": "54", // Professional, Scientific, Technical Services
  "35": "31", // Manufacturing
  "36": "33", // Manufacturing
  "37": "33", // Manufacturing
  "48": "51", // Information
  "50": "42", // Wholesale Trade
  "51": "44", // Retail Trade
  "52": "52", // Finance & Insurance
  "53": "53", // Real Estate
  "60": "52", // Finance & Insurance
  "61": "52", // Finance & Insurance
  "62": "52", // Finance & Insurance
  "70": "72", // Accommodation & Food Services
  "72": "72", // Accommodation & Food Services
  "80": "62", // Health Care & Social Assistance
  "82": "61", // Educational Services
};

interface CensusResult {
  marketSizeProxy: string;
  establishmentCount: string;
}

async function fetchCensusData(sicCode: string | undefined): Promise<CensusResult> {
  const result: CensusResult = {
    marketSizeProxy: "N/A",
    establishmentCount: "N/A",
  };

  if (!sicCode) return result;

  const sicPrefix = sicCode.substring(0, 2);
  const naicsCode = SIC_TO_NAICS[sicPrefix];
  if (!naicsCode) return result;

  try {
    // County Business Patterns — national-level establishment count + payroll
    const url = new URL("https://api.census.gov/data/2021/cbp");
    url.searchParams.set("get", "ESTAB,PAYANN,EMP");
    url.searchParams.set("for", "us:*");
    url.searchParams.set("NAICS2017", naicsCode);

    const resp = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (resp.ok) {
      const cbpData = await resp.json();

      // CBP returns array-of-arrays: [headers, ...rows]
      if (Array.isArray(cbpData) && cbpData.length >= 2) {
        const headers = cbpData[0] as string[];
        const estabIdx = headers.indexOf("ESTAB");
        const payannIdx = headers.indexOf("PAYANN");

        let totalEstab = 0;
        let totalPayroll = 0;
        for (let i = 1; i < cbpData.length; i++) {
          const row = cbpData[i];
          if (estabIdx >= 0) totalEstab += parseInt(row[estabIdx] || "0", 10);
          if (payannIdx >= 0) totalPayroll += parseInt(row[payannIdx] || "0", 10);
        }

        if (totalEstab > 0) {
          result.establishmentCount = totalEstab.toLocaleString();
        }
        if (totalPayroll > 0) {
          // Annual payroll in $1,000s → convert to billions
          const payrollBillions = (totalPayroll * 1000) / 1e9;
          result.marketSizeProxy = `$${payrollBillions.toFixed(1)}B annual payroll`;
        }
      }
    }
  } catch (err) {
    console.error("[Enrichment] Census fetch failed:", err);
  }

  return result;
}

// ── SEC EDGAR Helper ─────────────────────────────────────────────────────────

interface SECCompanyInfo {
  cik: string;
  name: string;
  ticker: string;
  sic: string;
  sicDescription: string;
  stateOfIncorporation: string;
  filings: { form: string; filingDate: string; accessionNumber: string }[];
}

async function fetchSECCompany(companyName: string): Promise<SECCompanyInfo | null> {
  try {
    // Step 1: Search EDGAR full-text search
    const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(companyName)}%22&dateRange=custom&startdt=2020-01-01&forms=10-K,10-Q`;
    const searchResp = await fetch(searchUrl, {
      headers: {
        "User-Agent": "ValueOS/1.0 (contact@valynt.com)",
        Accept: "application/json",
      },
    });

    // Step 2: Try company tickers endpoint
    const tickerResp = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: {
        "User-Agent": "ValueOS/1.0 (contact@valynt.com)",
        Accept: "application/json",
      },
    });

    if (!tickerResp.ok) return null;

    const tickers = await tickerResp.json();
    const lowerName = companyName.toLowerCase();

    // Find matching company
    let match: any = null;
    for (const key of Object.keys(tickers)) {
      const entry = tickers[key];
      if (
        entry.title?.toLowerCase().includes(lowerName) ||
        entry.ticker?.toLowerCase() === lowerName
      ) {
        match = entry;
        break;
      }
    }

    if (!match) return null;

    const cik = String(match.cik_str).padStart(10, "0");

    // Step 3: Get company facts for SIC code and filings
    const factsResp = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      {
        headers: {
          "User-Agent": "ValueOS/1.0 (contact@valynt.com)",
          Accept: "application/json",
        },
      }
    );

    if (!factsResp.ok) {
      return {
        cik,
        name: match.title,
        ticker: match.ticker,
        sic: "",
        sicDescription: "",
        stateOfIncorporation: "",
        filings: [],
      };
    }

    const facts = await factsResp.json();
    const recentFilings = (facts.filings?.recent?.form ?? [])
      .slice(0, 10)
      .map((form: string, i: number) => ({
        form,
        filingDate: facts.filings?.recent?.filingDate?.[i] ?? "",
        accessionNumber: facts.filings?.recent?.accessionNumber?.[i] ?? "",
      }));

    return {
      cik,
      name: facts.name ?? match.title,
      ticker: match.ticker,
      sic: facts.sic ?? "",
      sicDescription: facts.sicDescription ?? "",
      stateOfIncorporation: facts.stateOfIncorporation ?? "",
      filings: recentFilings,
    };
  } catch (err) {
    console.error("[Enrichment] SEC EDGAR fetch failed:", err);
    return null;
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const enrichmentRouter = router({
  /**
   * Enrich a company by name or domain.
   * Calls SEC EDGAR, YahooFinance, LinkedIn, BLS, and Census in a staged pipeline:
   *   1. SEC EDGAR → resolve CIK, ticker, SIC code
   *   2. Yahoo Finance + LinkedIn (parallel, use ticker from step 1)
   *   3. BLS + Census (parallel, use SIC code from step 1)
   *   4. Cross-reference and merge all fields
   */
  enrichCompany: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        domain: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { companyName } = input;
      const sources: EnrichedCompany["sources"] = [];

      // ── Stage 1: SEC EDGAR (must run first to get ticker + SIC) ────────
      let secData: SECCompanyInfo | null = null;
      try {
        secData = await fetchSECCompany(companyName);
        const secFields = [
          secData?.name,
          secData?.ticker,
          secData?.sic,
          secData?.sicDescription,
          secData?.stateOfIncorporation,
          secData?.filings?.[0],
        ].filter(Boolean).length;
        sources.push({
          name: "SEC EDGAR",
          status: secData ? (secFields > 2 ? "success" : "partial") : "failed",
          fieldsFound: secFields,
        });
      } catch {
        sources.push({ name: "SEC EDGAR", status: "failed", fieldsFound: 0 });
      }

      // Determine ticker for Yahoo Finance
      const ticker = secData?.ticker || guessTickerFromName(companyName);
      const linkedinUsername = guessLinkedInUsername(companyName);

      // ── Stage 2: Yahoo Finance + LinkedIn (parallel) ───────────────────
      const [profileResult, filingsResult, linkedinResult] = await Promise.allSettled([
        callDataApi("YahooFinance/get_stock_profile", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        }),
        callDataApi("YahooFinance/get_stock_sec_filing", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        }),
        callDataApi("LinkedIn/get_company_details", {
          query: { username: linkedinUsername },
        }),
      ]);

      // Parse YahooFinance Profile
      let profile: any = null;
      let profileFieldCount = 0;
      if (profileResult.status === "fulfilled" && profileResult.value) {
        profile = profileResult.value;
        const ap = profile?.assetProfile ?? {};
        const price = profile?.price ?? {};
        const sd = profile?.summaryDetail ?? {};
        profileFieldCount =
          (ap.sector ? 1 : 0) +
          (ap.industry ? 1 : 0) +
          (ap.fullTimeEmployees ? 1 : 0) +
          (ap.website ? 1 : 0) +
          (ap.longBusinessSummary ? 1 : 0) +
          (ap.country ? 1 : 0) +
          (price.regularMarketPrice ? 1 : 0) +
          (sd.marketCap ? 1 : 0);
        sources.push({
          name: "Yahoo Finance",
          status: profileFieldCount > 3 ? "success" : "partial",
          fieldsFound: profileFieldCount,
        });
      } else {
        sources.push({ name: "Yahoo Finance", status: "failed", fieldsFound: 0 });
      }

      // Parse SEC Filings from Yahoo
      let filings: any[] = [];
      if (filingsResult.status === "fulfilled" && filingsResult.value) {
        const fd = filingsResult.value as any;
        filings = (fd?.filings ?? []).slice(0, 10);
      }

      // Parse LinkedIn
      let linkedin: any = null;
      let linkedinFieldCount = 0;
      if (linkedinResult.status === "fulfilled" && linkedinResult.value) {
        const lr = linkedinResult.value as any;
        if (lr?.success !== false) {
          linkedin = lr?.data ?? lr;
          linkedinFieldCount =
            (linkedin?.name ? 1 : 0) +
            (linkedin?.description ? 1 : 0) +
            (linkedin?.staffCount ? 1 : 0) +
            (linkedin?.website ? 1 : 0) +
            (linkedin?.industries?.length ? 1 : 0) +
            (linkedin?.specialities?.length ? 1 : 0) +
            (linkedin?.followerCount ? 1 : 0);
          sources.push({
            name: "LinkedIn",
            status: linkedinFieldCount > 2 ? "success" : "partial",
            fieldsFound: linkedinFieldCount,
          });
        } else {
          sources.push({ name: "LinkedIn", status: "failed", fieldsFound: 0 });
        }
      } else {
        sources.push({ name: "LinkedIn", status: "failed", fieldsFound: 0 });
      }

      // ── Stage 3: BLS + Census (parallel, use SIC from SEC) ─────────────
      const sicCode = secData?.sic || "";
      const [blsResult, censusResult] = await Promise.allSettled([
        fetchBLSData(sicCode || undefined),
        fetchCensusData(sicCode || undefined),
      ]);

      let blsData: BLSResult = { industryEmployment: "N/A", avgHourlyWage: "N/A", laborTrend: "N/A", sectorLabel: "N/A" };
      if (blsResult.status === "fulfilled") {
        blsData = blsResult.value;
        const blsFields = [
          blsData.industryEmployment !== "N/A" ? 1 : 0,
          blsData.avgHourlyWage !== "N/A" ? 1 : 0,
          blsData.laborTrend !== "N/A" ? 1 : 0,
        ].reduce((a, b) => a + b, 0);
        sources.push({
          name: "BLS (Labor Statistics)",
          status: blsFields > 0 ? "success" : sicCode ? "partial" : "failed",
          fieldsFound: blsFields,
        });
      } else {
        sources.push({ name: "BLS (Labor Statistics)", status: "failed", fieldsFound: 0 });
      }

      let censusData: CensusResult = { marketSizeProxy: "N/A", establishmentCount: "N/A" };
      if (censusResult.status === "fulfilled") {
        censusData = censusResult.value;
        const censusFields = [
          censusData.marketSizeProxy !== "N/A" ? 1 : 0,
          censusData.establishmentCount !== "N/A" ? 1 : 0,
        ].reduce((a, b) => a + b, 0);
        sources.push({
          name: "Census Bureau",
          status: censusFields > 0 ? "success" : sicCode ? "partial" : "failed",
          fieldsFound: censusFields,
        });
      } else {
        sources.push({ name: "Census Bureau", status: "failed", fieldsFound: 0 });
      }

      // ── Stage 4: Cross-reference and merge ─────────────────────────────
      sources.push({ name: "Cross-Reference", status: "success", fieldsFound: 3 });

      const ap = profile?.assetProfile ?? {};
      const price = profile?.price ?? {};
      const sd = profile?.summaryDetail ?? {};
      const qt = profile?.quoteType ?? {};

      // Build executives from assetProfile.companyOfficers
      const executives: { name: string; title: string }[] = (ap.companyOfficers ?? [])
        .slice(0, 5)
        .map((o: any) => ({
          name: o.name ?? "Unknown",
          title: o.title ?? "Executive",
        }));

      // Merge SEC EDGAR filings with Yahoo filings
      const secFilings = (secData?.filings ?? []).map((f) => ({
        title: f.form,
        type: f.form,
        date: f.filingDate,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${secData?.cik}&type=${f.form}`,
      }));
      const yahooFilings = filings.map((f: any) => ({
        title: f.title ?? f.type ?? "Filing",
        type: f.type ?? "Unknown",
        date: f.date ?? "",
        url: f.edgarUrl ?? "",
      }));
      // Prefer SEC EDGAR filings, fall back to Yahoo
      const recentFilings = secFilings.length > 0 ? secFilings.slice(0, 10) : yahooFilings.slice(0, 10);

      // Build headquarters string
      const hqParts = [ap.city, ap.state, ap.country].filter(Boolean);
      const headquarters = hqParts.length > 0 ? hqParts.join(", ") : "N/A";

      // Calculate confidence score (0-100)
      const totalFields = profileFieldCount + linkedinFieldCount +
        Math.min(recentFilings.length, 5) +
        (blsData.industryEmployment !== "N/A" ? 1 : 0) +
        (blsData.avgHourlyWage !== "N/A" ? 1 : 0) +
        (blsData.laborTrend !== "N/A" ? 1 : 0) +
        (censusData.marketSizeProxy !== "N/A" ? 1 : 0) +
        (censusData.establishmentCount !== "N/A" ? 1 : 0) +
        (secData ? 3 : 0);
      const maxPossible = 8 + 7 + 5 + 3 + 2 + 3; // profile + linkedin + filings + bls + census + sec
      const confidence = Math.round((totalFields / maxPossible) * 100);

      const enriched: EnrichedCompany = {
        // Overview
        name: linkedin?.name ?? qt?.longName ?? qt?.shortName ?? secData?.name ?? companyName,
        domain: linkedin?.website ?? ap.website ?? input.domain ?? "",
        description: ap.longBusinessSummary ?? linkedin?.description ?? "",
        industry: ap.industry ?? secData?.sicDescription ?? (linkedin?.industries ?? [])[0] ?? "",
        sector: ap.sector ?? "",
        founded: ap.startDate ? String(new Date(ap.startDate * 1000).getFullYear()) : linkedin?.foundedOn?.year ? String(linkedin.foundedOn.year) : "",
        headquarters,
        employees: ap.fullTimeEmployees ?? linkedin?.staffCount ?? null,
        website: ap.website ?? linkedin?.website ?? "",
        logo: linkedin?.logo ?? `https://logo.clearbit.com/${ap.website ?? ""}`,
        linkedinUrl: linkedin?.linkedinUrl ?? linkedin?.url ?? "",
        crunchbaseUrl: linkedin?.crunchbaseUrl ?? "",

        // Financials
        revenue: fmt(sd.totalRevenue ?? price.revenue),
        marketCap: fmt(sd.marketCap ?? price.marketCap),
        stockPrice: fmt(price.regularMarketPrice),
        peRatio: fmt(sd.trailingPE),
        dividendYield: fmt(sd.dividendYield),
        fiftyTwoWeekHigh: fmt(sd.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: fmt(sd.fiftyTwoWeekLow),
        currency: price.currency ?? "USD",
        exchange: qt.exchange ?? "",
        ticker,

        // Intelligence
        specialties: linkedin?.specialities ?? [],
        executives,
        recentFilings,

        // Industry & Market Data (BLS / Census)
        industryEmployment: blsData.industryEmployment,
        avgIndustryWage: blsData.avgHourlyWage,
        laborTrend: blsData.laborTrend,
        marketSizeProxy: censusData.marketSizeProxy,
        establishmentCount: censusData.establishmentCount,

        // Metadata
        sources,
        confidence,
        enrichedAt: new Date().toISOString(),
      };

      return enriched;
    }),

  /**
   * Quick ticker lookup — returns basic stock info for autocomplete.
   */
  lookupTicker: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const ticker = guessTickerFromName(input.query);
      try {
        const result = (await callDataApi("YahooFinance/get_stock_profile", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        })) as any;
        const qt = result?.quoteType ?? {};
        const price = result?.price ?? {};
        return {
          found: true,
          ticker,
          name: qt.longName ?? qt.shortName ?? input.query,
          exchange: qt.exchange ?? "",
          price: fmt(price.regularMarketPrice),
          marketCap: fmt(price.marketCap),
        };
      } catch {
        return { found: false, ticker, name: input.query, exchange: "", price: "", marketCap: "" };
      }
    }),
});
