/**
 * Agent Tool Executor — Live API Integration
 *
 * Handles tool calls from Together.ai function-calling responses.
 * Each data-retrieval tool calls the shared enrichment service directly
 * (no HTTP loopback), while analysis tools use the Together.ai LLM.
 *
 * Data sources:
 *  - SEC EDGAR (company filings, CIK, SIC codes)
 *  - Yahoo Finance (stock profile, financials, executives)
 *  - LinkedIn (company details, staff count, specialties)
 *  - BLS (employment stats, wage data, labor trends)
 *  - Census Bureau (establishment counts, market size proxy)
 *
 * Analysis tools (LLM-powered):
 *  - validate_claim — evidence tier classification
 *  - build_value_tree — financial projection modeling
 *  - generate_narrative — executive-ready writing
 *  - stress_test_assumption — adversarial analysis
 *  - competitive_analysis — competitive landscape synthesis
 */

import { together, MODELS } from "../togetherClient";
import {
  runFullEnrichment,
  fetchSECCompany,
  searchSECFilings,
  fetchBLSData,
  fetchCensusData,
  fetchYahooFinance,
  fetchLinkedIn,
  guessTickerFromName,
  type FullEnrichmentResult,
  type SECCompanyInfo,
  type BLSResult,
  type CensusResult,
  type YahooFinanceResult,
  type LinkedInResult,
} from "../lib/enrichmentService";
import {
  getCachedEnrichment,
  setCachedEnrichment,
  DEFAULT_CACHE_TTL_MS,
} from "../enrichmentCache";

/**
 * Execute a tool call by name with the given arguments.
 * Returns a JSON string result that gets fed back to the LLM.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const startMs = Date.now();
  try {
    let result: string;

    switch (toolName) {
      // ── Data retrieval tools (live API calls) ──────────────────────
      case "enrich_company":
        result = await enrichCompany(args.companyName as string);
        break;

      case "search_sec_filings":
        result = await searchSecFilingsTool(
          args.companyName as string,
          args.formType as string | undefined
        );
        break;

      case "lookup_industry_data":
        result = await lookupIndustryData(
          args.sicCode as string | undefined,
          args.industryName as string | undefined
        );
        break;

      // ── LLM-powered analysis tools ────────────────────────────────
      case "validate_claim":
        result = await validateClaim(
          args.claim as string,
          args.companyName as string,
          args.sources as string[] | undefined
        );
        break;

      case "build_value_tree":
        result = await buildValueTree(
          args.companyName as string,
          args.hypotheses as string[],
          args.timeHorizonMonths as number | undefined
        );
        break;

      case "generate_narrative":
        result = await generateNarrative(
          args.companyName as string,
          args.caseTitle as string,
          args.totalValue as number,
          args.categories as Array<{
            name: string;
            value: number;
            items: string[];
          }> | undefined
        );
        break;

      case "stress_test_assumption":
        result = await stressTestAssumption(
          args.assumption as string,
          args.context as string | undefined
        );
        break;

      case "competitive_analysis":
        result = await competitiveAnalysis(
          args.companyName as string,
          args.industry as string | undefined
        );
        break;

      default:
        result = JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    const latencyMs = Date.now() - startMs;
    console.log(`[Agent Tool] ${toolName} completed in ${latencyMs}ms`);
    return result;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Tool execution failed";
    const latencyMs = Date.now() - startMs;
    console.error(`[Agent Tool] ${toolName} failed after ${latencyMs}ms:`, msg);
    return JSON.stringify({ error: msg, tool: toolName });
  }
}

/* ============================================================
   DATA RETRIEVAL TOOLS — Live API calls via enrichmentService
   ============================================================ */

/**
 * Enrich a company using the full 5-source ESO pipeline.
 * Checks the enrichment cache first, then falls back to live API calls.
 */
async function enrichCompany(companyName: string): Promise<string> {
  try {
    // Check cache first
    const cached = await getCachedEnrichment(companyName, DEFAULT_CACHE_TTL_MS);
    if (cached) {
      console.log(
        `[Agent Tool] enrich_company: cache HIT for "${companyName}" (age: ${Math.round(cached.meta.cacheAgeMs / 1000)}s)`
      );
      const data = cached.data as unknown as FullEnrichmentResult;
      return JSON.stringify({
        tool: "enrich_company",
        status: "success",
        cached: true,
        cacheAgeSeconds: Math.round(cached.meta.cacheAgeMs / 1000),
        companyName: data.companyName ?? companyName,
        ticker: data.ticker,
        industry: data.industry,
        sector: data.sector,
        sicCode: data.sicCode,
        employees: data.employees,
        headquarters: data.headquarters,
        website: data.website,
        description: typeof data.description === "string" ? data.description.slice(0, 500) : "N/A",
        revenue: data.revenue,
        marketCap: data.marketCap,
        stockPrice: data.stockPrice,
        industryEmployment: data.industryEmployment,
        avgIndustryWage: data.avgIndustryWage,
        laborTrend: data.laborTrend,
        marketSizeProxy: data.marketSizeProxy,
        establishmentCount: data.establishmentCount,
        executives: data.executives?.slice(0, 3),
        recentFilings: data.recentFilings?.slice(0, 5),
        sources: data.sources,
        confidence: data.confidence,
      });
    }

    // Cache miss — run full enrichment pipeline
    console.log(`[Agent Tool] enrich_company: cache MISS for "${companyName}" — calling live APIs`);
    const result = await runFullEnrichment(companyName);

    // Store in cache (async, don't block)
    const successSources = result.sources.filter(
      (s) => s.status === "success"
    ).length;
    setCachedEnrichment(
      companyName,
      result as unknown as Record<string, unknown>,
      result.confidence,
      successSources,
      0
    ).catch((err) =>
      console.error("[Agent Tool] Failed to cache enrichment:", err)
    );

    return JSON.stringify({
      tool: "enrich_company",
      status: "success",
      cached: false,
      companyName: result.companyName,
      ticker: result.ticker,
      industry: result.industry,
      sector: result.sector,
      sicCode: result.sicCode,
      employees: result.employees,
      headquarters: result.headquarters,
      website: result.website,
      description: result.description?.slice(0, 500),
      revenue: result.revenue,
      marketCap: result.marketCap,
      stockPrice: result.stockPrice,
      industryEmployment: result.industryEmployment,
      avgIndustryWage: result.avgIndustryWage,
      laborTrend: result.laborTrend,
      marketSizeProxy: result.marketSizeProxy,
      establishmentCount: result.establishmentCount,
      executives: result.executives?.slice(0, 3),
      recentFilings: result.recentFilings?.slice(0, 5),
      sources: result.sources,
      confidence: result.confidence,
    });
  } catch (error) {
    return JSON.stringify({
      tool: "enrich_company",
      status: "error",
      message:
        error instanceof Error ? error.message : "Enrichment pipeline failed",
      companyName,
    });
  }
}

/**
 * Search SEC EDGAR for company filings using EFTS full-text search.
 * Falls back to company submissions endpoint if EFTS is unavailable.
 */
async function searchSecFilingsTool(
  companyName: string,
  formType?: string
): Promise<string> {
  try {
    const result = await searchSECFilings(companyName, formType);

    return JSON.stringify({
      tool: "search_sec_filings",
      status: result.status,
      companyName,
      formType: formType || "all",
      totalHits: result.totalHits,
      filings: result.filings.slice(0, 10).map((f) => ({
        form: f.form,
        filingDate: f.filingDate,
        companyName: f.companyName,
        cik: f.cik,
        fileUrl: f.fileUrl,
      })),
      edgarUrl: result.edgarUrl,
      error: result.error,
    });
  } catch (error) {
    return JSON.stringify({
      tool: "search_sec_filings",
      status: "error",
      message: error instanceof Error ? error.message : "SEC search failed",
      companyName,
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(companyName)}&action=getcompany`,
    });
  }
}

/**
 * Look up BLS and Census industry data by SIC code or industry name.
 * If only industryName is provided, attempts to resolve a SIC code first
 * via SEC EDGAR company lookup.
 */
async function lookupIndustryData(
  sicCode?: string,
  industryName?: string
): Promise<string> {
  try {
    // If no SIC code provided but we have an industry name, try to resolve it
    let resolvedSicCode = sicCode;
    let resolvedCompanyName: string | undefined;

    if (!resolvedSicCode && industryName) {
      // Try to find a representative company in SEC EDGAR
      const secResult = await fetchSECCompany(industryName);
      if (secResult?.sic) {
        resolvedSicCode = secResult.sic;
        resolvedCompanyName = secResult.name;
        console.log(
          `[Agent Tool] lookup_industry_data: resolved "${industryName}" → SIC ${resolvedSicCode} via ${resolvedCompanyName}`
        );
      }
    }

    // Default to software (7372) if still no SIC code
    const code = resolvedSicCode || "7372";

    // Fetch BLS and Census data in parallel
    const [blsResult, censusResult] = await Promise.allSettled([
      fetchBLSData(code),
      fetchCensusData(code),
    ]);

    const bls: BLSResult =
      blsResult.status === "fulfilled"
        ? blsResult.value
        : {
            industryEmployment: "N/A",
            avgHourlyWage: "N/A",
            laborTrend: "N/A",
            sectorLabel: "N/A",
          };

    const census: CensusResult =
      censusResult.status === "fulfilled"
        ? censusResult.value
        : { marketSizeProxy: "N/A", establishmentCount: "N/A" };

    const hasBlsData = bls.industryEmployment !== "N/A" || bls.avgHourlyWage !== "N/A";
    const hasCensusData = census.marketSizeProxy !== "N/A" || census.establishmentCount !== "N/A";

    return JSON.stringify({
      tool: "lookup_industry_data",
      status: hasBlsData || hasCensusData ? "success" : "partial",
      sicCode: code,
      industryName: industryName || bls.sectorLabel || "Unknown",
      resolvedFrom: resolvedCompanyName || null,
      bls: {
        sectorLabel: bls.sectorLabel,
        industryEmployment: bls.industryEmployment,
        avgHourlyWage: bls.avgHourlyWage,
        laborTrend: bls.laborTrend,
      },
      census: {
        marketSizeProxy: census.marketSizeProxy,
        establishmentCount: census.establishmentCount,
      },
    });
  } catch (error) {
    return JSON.stringify({
      tool: "lookup_industry_data",
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Industry data lookup failed",
      sicCode: sicCode || "unknown",
    });
  }
}

/* ============================================================
   LLM-POWERED ANALYSIS TOOLS
   ============================================================ */

/**
 * Strip DeepSeek-R1 <think>...</think> reasoning tokens from output.
 * Returns only the final answer content.
 */
function stripThinkTokens(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * Safely parse JSON from LLM output, handling markdown fences and think tokens.
 */
function safeParseLLMJson(content: string): Record<string, unknown> | null {
  const cleaned = stripThinkTokens(content);
  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting from markdown code fence
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // fall through
      }
    }
    return null;
  }
}

/**
 * Validate a claim — uses the LLM to reason about evidence quality.
 */
async function validateClaim(
  claim: string,
  companyName: string,
  sources?: string[]
): Promise<string> {
  const sourceList = sources?.length
    ? sources.join(", ")
    : "No sources provided";

  const response = await together.chat.completions.create({
    model: MODELS.fast,
    messages: [
      {
        role: "system",
        content: `You are a fact-checking analyst. Evaluate the following claim and classify it into an evidence tier. Respond ONLY with valid JSON, no markdown fences.`,
      },
      {
        role: "user",
        content: `Claim: "${claim}"
Company: ${companyName}
Sources cited: ${sourceList}

Classify this claim:
{
  "verdict": "VERIFIED" | "NEEDS_EVIDENCE" | "FLAGGED",
  "tier": "Tier 1: EDGAR/Verified" | "Tier 2: Market Data" | "Tier 3: Self-reported",
  "tierLevel": 1 | 2 | 3,
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "suggestedSources": ["source1", "source2"]
}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = safeParseLLMJson(content);

  if (parsed) {
    return JSON.stringify({
      tool: "validate_claim",
      status: "success",
      claim,
      ...parsed,
    });
  }

  return JSON.stringify({
    tool: "validate_claim",
    status: "success",
    claim,
    rawAnalysis: stripThinkTokens(content),
  });
}

/**
 * Build a value tree — uses the LLM to structure financial projections.
 * Enriches with live data when possible.
 */
async function buildValueTree(
  companyName: string,
  hypotheses: string[],
  timeHorizonMonths?: number
): Promise<string> {
  const horizon = timeHorizonMonths || 36;

  // Try to get live financial context for better projections
  let financialContext = "";
  try {
    const yahoo = await fetchYahooFinance(companyName);
    if (yahoo.status !== "error") {
      financialContext = `\nLive financial data for ${companyName}:
- Revenue: ${yahoo.revenue}
- Market Cap: ${yahoo.marketCap}
- Employees: ${yahoo.employees ?? "N/A"}
- Industry: ${yahoo.industry}
- Sector: ${yahoo.sector}`;
    }
  } catch {
    // Continue without financial context
  }

  const response = await together.chat.completions.create({
    model: MODELS.toolCalling,
    messages: [
      {
        role: "system",
        content: `You are a financial modeling specialist. Build a value tree from the given hypotheses. Respond ONLY with valid JSON, no markdown fences.`,
      },
      {
        role: "user",
        content: `Company: ${companyName}
Time horizon: ${horizon} months
Hypotheses:
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}
${financialContext}

Build a value tree:
{
  "totalValue": number,
  "roi": "percentage",
  "paybackMonths": number,
  "categories": [
    {
      "name": "Category Name",
      "value": number,
      "confidence": 0-100,
      "items": [{ "description": "line item", "value": number, "evidenceTier": 1|2|3 }]
    }
  ],
  "scenarios": {
    "conservative": number,
    "base": number,
    "optimistic": number
  },
  "topRisks": ["risk1", "risk2", "risk3"]
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = safeParseLLMJson(content);

  if (parsed) {
    return JSON.stringify({
      tool: "build_value_tree",
      status: "success",
      companyName,
      timeHorizonMonths: horizon,
      ...parsed,
    });
  }

  return JSON.stringify({
    tool: "build_value_tree",
    status: "success",
    companyName,
    rawAnalysis: stripThinkTokens(content),
  });
}

/**
 * Generate a narrative — uses the LLM to write executive content.
 */
async function generateNarrative(
  companyName: string,
  caseTitle: string,
  totalValue: number,
  categories?: Array<{ name: string; value: number; items: string[] }>
): Promise<string> {
  const categoryText = categories
    ? categories
        .map(
          (c) =>
            `- ${c.name}: $${(c.value / 1_000_000).toFixed(1)}M\n  ${c.items.map((i) => `  * ${i}`).join("\n")}`
        )
        .join("\n")
    : "No category breakdown provided";

  const response = await together.chat.completions.create({
    model: MODELS.chat,
    messages: [
      {
        role: "system",
        content: `You are an executive business writer. Generate a polished, CFO-ready narrative. Use markdown formatting.`,
      },
      {
        role: "user",
        content: `Company: ${companyName}
Case: ${caseTitle}
Total Projected Value: $${(totalValue / 1_000_000).toFixed(1)}M

Value Breakdown:
${categoryText}

Write:
1. Executive Summary (200 words max, lead with the bottom line)
2. Value Breakdown (by category with evidence citations)
3. Risk & Mitigation (top 3 objections with responses)
4. Recommendation & Next Steps`,
      },
    ],
    temperature: 0.6,
    max_tokens: 3072,
  });

  const content = response.choices[0]?.message?.content || "";

  return JSON.stringify({
    tool: "generate_narrative",
    status: "success",
    companyName,
    caseTitle,
    totalValue,
    narrative: stripThinkTokens(content),
  });
}

/**
 * Stress-test an assumption — uses the LLM for adversarial analysis.
 */
async function stressTestAssumption(
  assumption: string,
  context?: string
): Promise<string> {
  const response = await together.chat.completions.create({
    model: MODELS.reasoning,
    messages: [
      {
        role: "system",
        content: `You are a skeptical financial analyst. Your job is to find weaknesses in value case assumptions. Respond with valid JSON only, no markdown fences, no <think> tags in your final answer.`,
      },
      {
        role: "user",
        content: `Assumption: "${assumption}"
${context ? `Context: ${context}` : ""}

Generate a stress test:
{
  "objections": [
    {
      "objection": "description",
      "severity": "Critical" | "High" | "Medium" | "Low",
      "evidence": "why this is a concern",
      "mitigation": "how to address it"
    }
  ],
  "worstCaseImpact": "what happens if this assumption is 50% wrong",
  "alternativeInterpretation": "different way to read the same data",
  "overallRisk": "High" | "Medium" | "Low"
}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = safeParseLLMJson(content);

  if (parsed) {
    return JSON.stringify({
      tool: "stress_test_assumption",
      status: "success",
      assumption,
      ...parsed,
    });
  }

  return JSON.stringify({
    tool: "stress_test_assumption",
    status: "success",
    assumption,
    rawAnalysis: stripThinkTokens(content),
  });
}

/**
 * Competitive analysis — enriches with live Yahoo Finance data for competitors,
 * then uses the LLM to synthesize the competitive landscape.
 */
async function competitiveAnalysis(
  companyName: string,
  industry?: string
): Promise<string> {
  // Try to get live data for the target company
  let companyContext = "";
  try {
    const yahoo = await fetchYahooFinance(companyName);
    if (yahoo.status !== "error") {
      companyContext = `\nLive data for ${companyName}:
- Sector: ${yahoo.sector}
- Industry: ${yahoo.industry}
- Revenue: ${yahoo.revenue}
- Market Cap: ${yahoo.marketCap}
- Employees: ${yahoo.employees ?? "N/A"}
- Stock Price: ${yahoo.stockPrice}`;
    }
  } catch {
    // Continue without live data
  }

  const response = await together.chat.completions.create({
    model: MODELS.chat,
    messages: [
      {
        role: "system",
        content: `You are a competitive intelligence analyst. Analyze the competitive landscape. Respond with valid JSON only, no markdown fences.`,
      },
      {
        role: "user",
        content: `Company: ${companyName}
${industry ? `Industry: ${industry}` : ""}
${companyContext}

Analyze the competitive landscape:
{
  "competitors": [
    {
      "name": "competitor name",
      "marketPosition": "leader" | "challenger" | "niche",
      "strengths": ["s1", "s2"],
      "weaknesses": ["w1", "w2"],
      "estimatedRevenue": "range"
    }
  ],
  "marketDynamics": "brief market overview",
  "competitiveAdvantages": ["advantage1", "advantage2"],
  "threats": ["threat1", "threat2"],
  "opportunities": ["opp1", "opp2"]
}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = safeParseLLMJson(content);

  if (parsed) {
    return JSON.stringify({
      tool: "competitive_analysis",
      status: "success",
      companyName,
      industry: industry || "Unknown",
      ...parsed,
    });
  }

  return JSON.stringify({
    tool: "competitive_analysis",
    status: "success",
    companyName,
    rawAnalysis: stripThinkTokens(content),
  });
}
