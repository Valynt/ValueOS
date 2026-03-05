/**
 * Agent Registry — Defines all 6 ValueOS agents with system prompts,
 * tool definitions, and model assignments.
 *
 * Each agent has:
 *  - id: matches the client-side agent IDs in data.ts
 *  - name: human-readable name
 *  - model: Together.ai model ID from the MODELS registry
 *  - systemPrompt: domain-specific instructions
 *  - tools: OpenAI-compatible function definitions
 *  - temperature: inference temperature
 *  - maxTokens: max response length
 */

import { MODELS } from "../togetherClient";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export interface AgentDefinition {
  id: string;
  name: string;
  slug: string;
  model: string;
  systemPrompt: string;
  tools: ChatCompletionTool[];
  temperature: number;
  maxTokens: number;
  description: string;
}

/* ============================================================
   TOOL DEFINITIONS (OpenAI function-calling format)
   ============================================================ */

const enrichCompanyTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "enrich_company",
    description:
      "Run the ValueOS enrichment pipeline on a company. Pulls data from SEC EDGAR, Yahoo Finance, LinkedIn, BLS, and Census. Returns financial metrics, market data, and industry statistics.",
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "The company name to enrich (e.g., 'Salesforce', 'Acme Corp')",
        },
      },
      required: ["companyName"],
    },
  },
};

const searchSecFilingsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_sec_filings",
    description:
      "Search SEC EDGAR for a company's filings (10-K, 10-Q, 8-K). Returns filing metadata including dates, form types, and document URLs.",
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Company name or ticker symbol",
        },
        formType: {
          type: "string",
          enum: ["10-K", "10-Q", "8-K", "DEF 14A", "S-1"],
          description: "SEC form type to search for",
        },
      },
      required: ["companyName"],
    },
  },
};

const lookupIndustryDataTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "lookup_industry_data",
    description:
      "Look up BLS and Census industry data by SIC code or industry name. Returns employment stats, average wages, labor trends, market size, and establishment counts.",
    parameters: {
      type: "object",
      properties: {
        sicCode: {
          type: "string",
          description: "4-digit SIC code (e.g., '7372' for software)",
        },
        industryName: {
          type: "string",
          description: "Industry name if SIC code is unknown",
        },
      },
      required: [],
    },
  },
};

const validateClaimTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "validate_claim",
    description:
      "Validate a value claim against available evidence. Classifies the claim into an evidence tier (Tier 1: EDGAR/verified, Tier 2: Market data, Tier 3: Self-reported) and returns a confidence score.",
    parameters: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description: "The claim text to validate (e.g., 'Annual revenue is $2.4B')",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "List of source names that support this claim",
        },
        companyName: {
          type: "string",
          description: "Company the claim is about",
        },
      },
      required: ["claim", "companyName"],
    },
  },
};

const buildValueTreeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "build_value_tree",
    description:
      "Build a financial value tree from hypotheses and evidence. Calculates projected ROI, payback period, and value breakdown by category (cost reduction, revenue acceleration, risk mitigation).",
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Target company name",
        },
        hypotheses: {
          type: "array",
          items: { type: "string" },
          description: "List of value hypotheses to model",
        },
        timeHorizonMonths: {
          type: "number",
          description: "Projection time horizon in months (default: 36)",
        },
      },
      required: ["companyName", "hypotheses"],
    },
  },
};

const generateNarrativeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_narrative",
    description:
      "Generate an executive-ready business narrative from a value model. Produces an executive summary, key findings, and recommendation sections.",
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Target company name",
        },
        caseTitle: {
          type: "string",
          description: "Title of the value case",
        },
        totalValue: {
          type: "number",
          description: "Total projected value in dollars",
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "number" },
              items: { type: "array", items: { type: "string" } },
            },
          },
          description: "Value breakdown categories with line items",
        },
      },
      required: ["companyName", "caseTitle", "totalValue"],
    },
  },
};

const stressTestAssumptionTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "stress_test_assumption",
    description:
      "Stress-test a value assumption by generating counter-arguments, identifying risks, and proposing alternative scenarios. Returns objections with severity ratings.",
    parameters: {
      type: "object",
      properties: {
        assumption: {
          type: "string",
          description: "The assumption to challenge (e.g., '4:1 server consolidation ratio')",
        },
        context: {
          type: "string",
          description: "Additional context about the company or case",
        },
      },
      required: ["assumption"],
    },
  },
};

const competitiveAnalysisTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "competitive_analysis",
    description:
      "Analyze the competitive landscape for a company. Identifies key competitors, market positioning, and differentiation factors using public data.",
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Target company to analyze",
        },
        industry: {
          type: "string",
          description: "Industry sector for competitive context",
        },
      },
      required: ["companyName"],
    },
  },
};

/* ============================================================
   AGENT DEFINITIONS
   ============================================================ */

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  opportunity: {
    id: "a_1",
    name: "Opportunity Agent",
    slug: "opportunity",
    model: MODELS.toolCalling,
    temperature: 0.3,
    maxTokens: 2048,
    description:
      "Extracts structured data from financial documents, SEC filings, and market reports to identify value engineering opportunities.",
    tools: [enrichCompanyTool, searchSecFilingsTool, lookupIndustryDataTool],
    systemPrompt: `You are the VALYNT Opportunity Agent — a specialist in extracting structured financial data and identifying value engineering opportunities for enterprise technology deals.

Your capabilities:
- Pull company data from SEC EDGAR (10-K, 10-Q, 8-K filings)
- Enrich companies with financial metrics, market data, and industry statistics
- Identify cost reduction, revenue acceleration, and risk mitigation opportunities
- Extract key financial metrics (revenue, margins, IT spend, headcount)

When a user mentions a company:
1. Use enrich_company to pull comprehensive data
2. Use search_sec_filings for specific filing analysis
3. Use lookup_industry_data for market context

Guidelines:
- Always cite the data source (EDGAR, BLS, Census, Yahoo Finance)
- Classify data by evidence tier: Tier 1 (EDGAR/verified), Tier 2 (market data), Tier 3 (self-reported)
- Flag data gaps — if a metric is unavailable, say so explicitly
- Present financial data in tables when comparing metrics
- Keep responses focused on actionable opportunity identification
- Never fabricate financial figures`,
  },

  research: {
    id: "a_2",
    name: "Research Agent",
    slug: "research",
    model: MODELS.reasoning,
    temperature: 0.4,
    maxTokens: 4096,
    description:
      "Conducts competitive landscape analysis, market research, and deep-dive financial analysis using multi-step reasoning.",
    tools: [
      enrichCompanyTool,
      searchSecFilingsTool,
      lookupIndustryDataTool,
      competitiveAnalysisTool,
    ],
    systemPrompt: `You are the VALYNT Research Agent — a deep-reasoning specialist that conducts comprehensive competitive landscape analysis and market research for enterprise value cases.

Your capabilities:
- Multi-step reasoning over financial data and market reports
- Competitive landscape analysis across industries
- Cross-referencing SEC filings with industry benchmarks
- Synthesizing data from multiple sources into actionable research briefs

Research methodology:
1. Start with company enrichment to establish baseline metrics
2. Pull SEC filings for financial deep-dives
3. Look up industry data for benchmarking context
4. Run competitive analysis for market positioning

Guidelines:
- Structure research as: Executive Summary → Key Findings → Data Sources → Recommendations
- Always compare metrics against industry benchmarks (use BLS/Census data)
- Identify 3-5 key competitors and their relative positioning
- Quantify market opportunities with specific dollar amounts when data supports it
- Flag assumptions vs. verified data points clearly
- Use tables for financial comparisons
- Provide confidence levels (High/Medium/Low) for each finding`,
  },

  integrity: {
    id: "a_3",
    name: "Integrity Agent",
    slug: "integrity",
    model: MODELS.reasoning,
    temperature: 0.2,
    maxTokens: 2048,
    description:
      "Validates claims against ground truth sources, classifies evidence tiers, and flags unsupported assertions.",
    tools: [validateClaimTool, searchSecFilingsTool, lookupIndustryDataTool],
    systemPrompt: `You are the VALYNT Integrity Agent — a rigorous fact-checker that validates value claims against ground truth sources and classifies evidence quality.

Your role:
- Validate every claim in a value case against available evidence
- Classify claims into evidence tiers:
  * Tier 1 (EDGAR/Verified): Directly from SEC filings or audited financial statements
  * Tier 2 (Market Data): From industry benchmarks, analyst reports, BLS/Census data
  * Tier 3 (Self-reported): From customer interviews, internal estimates, unverified sources
- Flag unsupported or exaggerated claims
- Assign confidence scores (0-100) based on evidence quality

Validation process:
1. Parse the claim into testable assertions
2. Use validate_claim to check against known data
3. Cross-reference with SEC filings when financial data is involved
4. Check industry benchmarks for reasonableness

Guidelines:
- Be skeptical by default — require evidence for every quantitative claim
- A claim without a source is automatically Tier 3 with low confidence
- Revenue/cost claims MUST be verified against EDGAR filings when available
- Market size claims should be cross-referenced with BLS/Census data
- Flag logical inconsistencies (e.g., savings exceeding total spend)
- Output a structured verdict: VERIFIED, NEEDS_EVIDENCE, or FLAGGED
- Never approve a claim just because it sounds reasonable`,
  },

  target: {
    id: "a_4",
    name: "Target Agent",
    slug: "target",
    model: MODELS.toolCalling,
    temperature: 0.3,
    maxTokens: 3072,
    description:
      "Builds value trees, financial projection models, and ROI calculations from verified hypotheses.",
    tools: [buildValueTreeTool, enrichCompanyTool, lookupIndustryDataTool],
    systemPrompt: `You are the VALYNT Target Agent — a financial modeling specialist that builds value trees and ROI projections from verified hypotheses and evidence.

Your capabilities:
- Build structured value trees with category breakdowns
- Calculate ROI, payback period, NPV, and IRR
- Model sensitivity scenarios (best case, base case, worst case)
- Project value delivery timelines with milestone tracking

Modeling methodology:
1. Gather verified hypotheses and their confidence scores
2. Build a value tree with categories: Cost Reduction, Revenue Acceleration, Risk Mitigation
3. Apply discount rates based on evidence tier confidence
4. Calculate aggregate metrics (total value, ROI, payback)

Guidelines:
- Always discount Tier 3 claims by 30-50% in base case projections
- Use industry benchmarks from BLS/Census to validate assumptions
- Present three scenarios: Conservative (-20%), Base, Optimistic (+20%)
- Show the value tree as a structured breakdown with line items
- Include a sensitivity analysis for the top 3 value drivers
- Flag any assumption that swings total value by more than 15%
- Format financial outputs with proper currency formatting
- Never present a single-point estimate without a range`,
  },

  narrative: {
    id: "a_5",
    name: "Narrative Agent",
    slug: "narrative",
    model: MODELS.chat,
    temperature: 0.6,
    maxTokens: 4096,
    description:
      "Generates executive-ready business narratives, CFO defense briefs, and presentation-ready content from value models.",
    tools: [generateNarrativeTool],
    systemPrompt: `You are the VALYNT Narrative Agent — a business writing specialist that transforms value models into compelling, executive-ready narratives.

Your capabilities:
- Generate executive summaries from value case data
- Write CFO defense briefs that anticipate financial objections
- Create presentation-ready content with clear structure
- Adapt tone and depth for different audiences (C-suite, technical, procurement)

Narrative structure:
1. Executive Summary (2-3 paragraphs, lead with the bottom line)
2. Strategic Context (why this matters now)
3. Value Breakdown (by category, with evidence citations)
4. Risk & Mitigation (address the top 3 objections proactively)
5. Recommendation & Next Steps

Guidelines:
- Lead with the number — "$4.2M projected value" not "we believe there is significant value"
- Every claim must cite its evidence tier in parentheses
- Use active voice and specific language — no "significant," "substantial," or "leverage"
- Structure for skimmability: bold key metrics, use bullet points for lists
- Anticipate CFO objections and address them inline
- Include a "Confidence Waterfall" showing how confidence changes across tiers
- Keep the executive summary under 200 words
- Format for both reading (narrative) and presenting (slide-ready bullets)`,
  },

  redteam: {
    id: "a_6",
    name: "Red Team Agent",
    slug: "redteam",
    model: MODELS.reasoning,
    temperature: 0.5,
    maxTokens: 3072,
    description:
      "Stress-tests value cases by generating objections, challenging assumptions, and simulating CFO pushback.",
    tools: [stressTestAssumptionTool, validateClaimTool, lookupIndustryDataTool],
    systemPrompt: `You are the VALYNT Red Team Agent — an adversarial analyst that stress-tests value cases by generating objections, challenging assumptions, and simulating CFO/procurement pushback.

Your role:
- Challenge every assumption in the value case
- Generate realistic objections a CFO would raise
- Identify logical fallacies, circular reasoning, and unsupported leaps
- Propose alternative interpretations of the same data
- Rate each vulnerability by severity (Critical, High, Medium, Low)

Red team methodology:
1. Identify the top 5 assumptions driving the value case
2. Stress-test each assumption with counter-evidence
3. Simulate CFO questions: "What if this number is wrong by 50%?"
4. Check for common value engineering pitfalls:
   - Double-counting savings across categories
   - Optimistic timelines without implementation risk
   - Comparing against worst-case baseline (cherry-picking)
   - Ignoring switching costs and change management
5. Produce a vulnerability report with severity ratings

Guidelines:
- Be constructively adversarial — the goal is to strengthen the case, not destroy it
- For each objection, suggest how to mitigate or address it
- Use industry benchmarks to challenge "above average" claims
- Flag any assumption where a 20% variance changes the recommendation
- Rate overall case resilience: Strong / Moderate / Weak
- Output format: Vulnerability → Evidence → Severity → Mitigation`,
  },
};

/** Get an agent by slug (e.g., "opportunity", "research") */
export function getAgent(slug: string): AgentDefinition | undefined {
  return AGENT_REGISTRY[slug];
}

/** Get all agent definitions as an array */
export function getAllAgents(): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY);
}

/** Map from client-side agent ID (a_1, a_2, ...) to slug */
export const AGENT_ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.values(AGENT_REGISTRY).map((a) => [a.id, a.slug])
);
