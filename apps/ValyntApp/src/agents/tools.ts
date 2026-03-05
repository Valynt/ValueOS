/**
 * Agent Tool Executor
 *
 * Handles tool calls from Together.ai function-calling responses.
 * Each tool function maps to a real backend operation (enrichment,
 * SEC search, industry lookup, etc.) or returns a structured
 * LLM-generated analysis for tools that don't have a dedicated API.
 */

import { together, MODELS } from "../togetherClient";

/**
 * Execute a tool call by name with the given arguments.
 * Returns a JSON string result that gets fed back to the LLM.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "enrich_company":
        return await enrichCompany(args.companyName as string);

      case "search_sec_filings":
        return await searchSecFilings(
          args.companyName as string,
          args.formType as string | undefined
        );

      case "lookup_industry_data":
        return await lookupIndustryData(
          args.sicCode as string | undefined,
          args.industryName as string | undefined
        );

      case "validate_claim":
        return await validateClaim(
          args.claim as string,
          args.companyName as string,
          args.sources as string[] | undefined
        );

      case "build_value_tree":
        return await buildValueTree(
          args.companyName as string,
          args.hypotheses as string[],
          args.timeHorizonMonths as number | undefined
        );

      case "generate_narrative":
        return await generateNarrative(
          args.companyName as string,
          args.caseTitle as string,
          args.totalValue as number,
          args.categories as Array<{
            name: string;
            value: number;
            items: string[];
          }> | undefined
        );

      case "stress_test_assumption":
        return await stressTestAssumption(
          args.assumption as string,
          args.context as string | undefined
        );

      case "competitive_analysis":
        return await competitiveAnalysis(
          args.companyName as string,
          args.industry as string | undefined
        );

      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
        });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Tool execution failed";
    console.error(`[Agent Tool] ${toolName} failed:`, msg);
    return JSON.stringify({ error: msg, tool: toolName });
  }
}

/* ============================================================
   TOOL IMPLEMENTATIONS
   ============================================================ */

/**
 * Enrich a company using the ESO pipeline (SEC + Yahoo + LinkedIn + BLS + Census).
 * Calls the enrichment tRPC procedure internally.
 */
async function enrichCompany(companyName: string): Promise<string> {
  // Call the internal enrichment endpoint directly
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const response = await fetch(`${baseUrl}/api/trpc/enrichment.enrichCompany`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { companyName, forceRefresh: false },
      }),
    });

    if (!response.ok) {
      return JSON.stringify({
        tool: "enrich_company",
        status: "error",
        message: `Enrichment API returned ${response.status}`,
        companyName,
      });
    }

    const data = await response.json();
    const result = data?.result?.data?.json;

    if (result) {
      // Return a clean summary for the LLM
      return JSON.stringify({
        tool: "enrich_company",
        status: "success",
        companyName: result.companyName,
        ticker: result.ticker,
        industry: result.industry,
        revenue: result.revenue,
        employees: result.employees,
        marketCap: result.marketCap,
        headquarters: result.headquarters,
        description: result.description,
        industryEmployment: result.industryEmployment,
        avgIndustryWage: result.avgIndustryWage,
        laborTrend: result.laborTrend,
        marketSizeProxy: result.marketSizeProxy,
        establishmentCount: result.establishmentCount,
        sources: result.sources,
        confidence: result.confidence,
      });
    }

    return JSON.stringify({
      tool: "enrich_company",
      status: "partial",
      message: "Enrichment returned incomplete data",
      companyName,
    });
  } catch (error) {
    return JSON.stringify({
      tool: "enrich_company",
      status: "error",
      message: error instanceof Error ? error.message : "Failed to call enrichment",
      companyName,
    });
  }
}

/**
 * Search SEC EDGAR for company filings.
 */
async function searchSecFilings(
  companyName: string,
  formType?: string
): Promise<string> {
  try {
    // Use SEC EDGAR full-text search API
    const query = encodeURIComponent(companyName);
    const url = `https://efts.sec.gov/LATEST/search-index?q=${query}&dateRange=custom&startdt=2023-01-01&forms=${formType || "10-K,10-Q,8-K"}&hits.hits.total=5`;

    const response = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=${query}&forms=${formType || "10-K"}&hits.hits._source=file_date,display_names,form_type,file_num`,
      {
        headers: {
          "User-Agent": "ValueOS/1.0 (enterprise-value-engineering)",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      // Fallback: use the company tickers endpoint
      const tickerRes = await fetch(
        `https://www.sec.gov/cgi-bin/browse-edgar?company=${query}&CIK=&type=${formType || "10-K"}&dateb=&owner=include&count=5&search_text=&action=getcompany`,
        {
          headers: {
            "User-Agent": "ValueOS/1.0 (enterprise-value-engineering)",
          },
        }
      );

      return JSON.stringify({
        tool: "search_sec_filings",
        status: "partial",
        message: `SEC search returned ${response.status}. Try using the company's CIK number or ticker symbol for more precise results.`,
        companyName,
        formType: formType || "10-K",
        edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?company=${query}&CIK=&type=${formType || "10-K"}&action=getcompany`,
      });
    }

    const data = await response.json();
    return JSON.stringify({
      tool: "search_sec_filings",
      status: "success",
      companyName,
      formType: formType || "all",
      results: data,
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
 * Look up BLS and Census industry data.
 */
async function lookupIndustryData(
  sicCode?: string,
  industryName?: string
): Promise<string> {
  const code = sicCode || "7372"; // Default to software if no code provided

  try {
    // BLS Quarterly Census of Employment and Wages
    const blsUrl = `https://api.bls.gov/publicAPI/v2/timeseries/data/CEU${code.padStart(8, "0")}01`;
    const censusUrl = `https://api.census.gov/data/2021/cbp?get=ESTAB,EMP,PAYANN&for=us:*&NAICS2017=${code.slice(0, 2)}`;

    const [blsRes, censusRes] = await Promise.allSettled([
      fetch(blsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: [`CEU${code.padStart(8, "0")}01`],
          startyear: "2023",
          endyear: "2025",
        }),
      }),
      fetch(censusUrl),
    ]);

    const result: Record<string, unknown> = {
      tool: "lookup_industry_data",
      status: "success",
      sicCode: code,
      industryName: industryName || "Unknown",
    };

    if (blsRes.status === "fulfilled" && blsRes.value.ok) {
      const blsData = await blsRes.value.json();
      result.blsData = blsData;
    } else {
      result.blsStatus = "unavailable";
    }

    if (censusRes.status === "fulfilled" && censusRes.value.ok) {
      const censusData = await censusRes.value.json();
      result.censusData = censusData;
    } else {
      result.censusStatus = "unavailable";
    }

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      tool: "lookup_industry_data",
      status: "error",
      message: error instanceof Error ? error.message : "Industry data lookup failed",
      sicCode: code,
    });
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
  const sourceList = sources?.length ? sources.join(", ") : "No sources provided";

  const response = await together.chat.completions.create({
    model: MODELS.fast,
    messages: [
      {
        role: "system",
        content: `You are a fact-checking analyst. Evaluate the following claim and classify it into an evidence tier. Respond ONLY with valid JSON.`,
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

  try {
    const parsed = JSON.parse(content);
    return JSON.stringify({ tool: "validate_claim", status: "success", claim, ...parsed });
  } catch {
    return JSON.stringify({
      tool: "validate_claim",
      status: "success",
      claim,
      rawAnalysis: content,
    });
  }
}

/**
 * Build a value tree — uses the LLM to structure financial projections.
 */
async function buildValueTree(
  companyName: string,
  hypotheses: string[],
  timeHorizonMonths?: number
): Promise<string> {
  const horizon = timeHorizonMonths || 36;

  const response = await together.chat.completions.create({
    model: MODELS.toolCalling,
    messages: [
      {
        role: "system",
        content: `You are a financial modeling specialist. Build a value tree from the given hypotheses. Respond ONLY with valid JSON.`,
      },
      {
        role: "user",
        content: `Company: ${companyName}
Time horizon: ${horizon} months
Hypotheses:
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}

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

  try {
    const parsed = JSON.parse(content);
    return JSON.stringify({
      tool: "build_value_tree",
      status: "success",
      companyName,
      timeHorizonMonths: horizon,
      ...parsed,
    });
  } catch {
    return JSON.stringify({
      tool: "build_value_tree",
      status: "success",
      companyName,
      rawAnalysis: content,
    });
  }
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
    narrative: content,
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
        content: `You are a skeptical financial analyst. Your job is to find weaknesses in value case assumptions. Respond with valid JSON.`,
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

  try {
    const parsed = JSON.parse(content);
    return JSON.stringify({
      tool: "stress_test_assumption",
      status: "success",
      assumption,
      ...parsed,
    });
  } catch {
    return JSON.stringify({
      tool: "stress_test_assumption",
      status: "success",
      assumption,
      rawAnalysis: content,
    });
  }
}

/**
 * Competitive analysis — uses the LLM to synthesize competitive landscape.
 */
async function competitiveAnalysis(
  companyName: string,
  industry?: string
): Promise<string> {
  const response = await together.chat.completions.create({
    model: MODELS.chat,
    messages: [
      {
        role: "system",
        content: `You are a competitive intelligence analyst. Analyze the competitive landscape. Respond with valid JSON.`,
      },
      {
        role: "user",
        content: `Company: ${companyName}
${industry ? `Industry: ${industry}` : ""}

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

  try {
    const parsed = JSON.parse(content);
    return JSON.stringify({
      tool: "competitive_analysis",
      status: "success",
      companyName,
      industry: industry || "Unknown",
      ...parsed,
    });
  } catch {
    return JSON.stringify({
      tool: "competitive_analysis",
      status: "success",
      companyName,
      rawAnalysis: content,
    });
  }
}
