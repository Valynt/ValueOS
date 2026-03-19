/**
 * ContextExtractionAgent
 *
 * Extracts structured context (stakeholders, use cases, pains, baseline clues,
 * value driver candidates, objection signals, missing data) from deal data.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §4
 */

import { z } from "zod";

import type { CRMFetchResult } from "../../../services/deal/CRMConnector";
import { logger } from "../../logger";
import type {
  AgentConfig,
  AgentOutput,
  LifecycleContext,
} from "../../../types/agent";
import { CircuitBreaker } from "../CircuitBreaker";
import { LLMGateway } from "../LLMGateway";
import { MemorySystem } from "../MemorySystem";
import { BaseAgent } from "./BaseAgent";

// ---------------------------------------------------------------------------
// Output Schemas
// ---------------------------------------------------------------------------

export const StakeholderSchema = z.object({
  name: z.string(),
  role: z.enum([
    "economic_buyer",
    "champion",
    "technical_evaluator",
    "end_user",
    "blocker",
    "influencer",
    "unknown",
  ]),
  priority: z.number().min(1).max(10),
  source_type: z.enum([
    "customer-confirmed",
    "crm-derived",
    "call-derived",
    "note-derived",
    "inferred",
  ]),
  contact_info: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    job_title: z.string().optional(),
  }).optional(),
});

export const UseCaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  pain_signals: z.array(z.string()),
  expected_outcomes: z.array(z.string()),
  source_type: z.enum([
    "customer-confirmed",
    "crm-derived",
    "call-derived",
    "note-derived",
    "inferred",
  ]),
});

export const ValueDriverCandidateSchema = z.object({
  driver_name: z.string(),
  impact_estimate_low: z.number(),
  impact_estimate_high: z.number(),
  evidence_strength: z.number().min(0).max(1),
  signal_sources: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
});

export const MissingDataPointSchema = z.object({
  field_name: z.string(),
  importance: z.enum(["critical", "high", "medium", "low"]),
  reason: z.string(),
  suggested_source: z.string().optional(),
});

export const ExtractedContextSchema = z.object({
  stakeholders: z.array(StakeholderSchema),
  use_cases: z.array(UseCaseSchema),
  pain_points: z.array(z.string()),
  baseline_clues: z.record(z.unknown()),
  value_driver_candidates: z.array(ValueDriverCandidateSchema),
  objection_signals: z.array(z.string()),
  missing_data: z.array(MissingDataPointSchema),
  extraction_confidence: z.number().min(0).max(1),
});

export type ExtractedContext = z.infer<typeof ExtractedContextSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ContextExtractionAgent extends BaseAgent {
  public override readonly version = "1.0.0";

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker
  ) {
    super(config, organizationId, memorySystem, llmGateway, circuitBreaker);
  }

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const sessionId = context.case_id ?? `ctx-extract-${Date.now()}`;

    // Validate input
    const isValid = await this.validateInput(context);
    if (!isValid) {
      return this.buildOutput(
        { error: "Invalid input context" },
        "failed",
        "very_low",
        startTime
      );
    }

    // Extract CRM data from context
    const crmData = context.crm_data as CRMFetchResult | undefined;
    if (!crmData) {
      return this.buildOutput(
        { error: "No CRM data provided in context" },
        "failed",
        "very_low",
        startTime
      );
    }

    try {
      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(crmData);

      // Invoke LLM with secureInvoke (includes hallucination check)
      const result = await this.secureInvoke(
        sessionId,
        prompt,
        ExtractedContextSchema,
        {
          userId: context.user_id,
          context: {
            case_id: context.case_id,
            organization_id: context.organization_id,
            opportunity_id: crmData.opportunity.id,
          },
        }
      );

      // Rank value driver candidates by signal strength and evidence
      const rankedCandidates = this.rankValueDrivers(result.value_driver_candidates);
      result.value_driver_candidates = rankedCandidates;

      // Log extraction completion
      logger.info("Context extraction completed", {
        agent: this.name,
        session_id: sessionId,
        stakeholders_count: result.stakeholders.length,
        use_cases_count: result.use_cases.length,
        value_drivers_count: result.value_driver_candidates.length,
        missing_data_count: result.missing_data.length,
        confidence: result.extraction_confidence,
        hallucination_check: result.hallucination_check,
      });

      return this.buildOutput(
        {
          extracted_context: result,
          sources_consulted: ["crm-opportunity", "crm-account", "crm-contacts"],
        },
        "success",
        this.toConfidenceLevel(result.extraction_confidence),
        startTime,
        {
          reasoning: `Extracted context from ${result.stakeholders.length} stakeholders and ${result.use_cases.length} use cases`,
          warnings: result.missing_data
            .filter((m) => m.importance === "critical")
            .map((m) => `Missing critical data: ${m.field_name}`),
        }
      );
    } catch (error) {
      logger.error("Context extraction failed", {
        agent: this.name,
        session_id: sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.buildOutput(
        { error: error instanceof Error ? error.message : "Extraction failed" },
        "failed",
        "very_low",
        startTime
      );
    }
  }

  /**
   * Build the extraction prompt from CRM data.
   */
  private buildExtractionPrompt(crmData: CRMFetchResult): string {
    const { opportunity, account, contacts } = crmData;

    return `
You are a deal context extraction specialist. Analyze the following CRM data and extract structured insights.

## OPPORTUNITY DATA
Name: ${opportunity.name}
Stage: ${opportunity.stage}
Amount: ${opportunity.amount ?? "Not specified"}
Close Date: ${opportunity.close_date ?? "Not specified"}
Probability: ${opportunity.probability ?? "Not specified"}
Owner: ${opportunity.owner?.name ?? "Not assigned"}
Custom Properties: ${JSON.stringify(opportunity.custom_properties ?? {})}

## ACCOUNT DATA
Name: ${account.name}
Industry: ${account.industry ?? "Not specified"}
Size: ${account.size_employees ?? "Not specified"} employees
Annual Revenue: ${account.annual_revenue ?? "Not specified"}
Website: ${account.website ?? "Not specified"}
Location: ${account.address?.city ?? ""}, ${account.address?.state ?? ""}, ${account.address?.country ?? ""}
Custom Properties: ${JSON.stringify(account.custom_properties ?? {})}

## CONTACTS
${contacts.map((c) => `- ${c.first_name} ${c.last_name} (${c.job_title ?? "Unknown role"}): ${c.email ?? "No email"}`).join("\n")}

## EXTRACTION REQUIREMENTS
Extract and return a JSON object with:

1. **stakeholders**: Array of stakeholders with role classification (economic_buyer, champion, technical_evaluator, end_user, blocker, influencer, unknown)
2. **use_cases**: Array of identified use cases with pain signals
3. **pain_points**: Array of explicit pain points mentioned
4. **baseline_clues**: Object with any baseline metrics mentioned (e.g., current costs, time spent)
5. **value_driver_candidates**: Array of potential value drivers with impact estimates
6. **objection_signals**: Array of potential objections or concerns
7. **missing_data**: Array of critical data points not found in the CRM data
8. **extraction_confidence**: Overall confidence score (0-1)

Use source_type "crm-derived" for all extracted data since it comes from CRM.
Rank value drivers by evidence strength and signal clarity.
Flag any missing critical data like: confirmed budget, decision timeline, current solution details, success metrics.
`;
  }

  /**
   * Rank value driver candidates by signal strength and evidence availability.
   */
  private rankValueDrivers(
    candidates: ExtractedContext["value_driver_candidates"]
  ): ExtractedContext["value_driver_candidates"] {
    return candidates
      .map((c) => ({
        ...c,
        // Composite score: evidence strength * confidence * (number of sources / 10)
        composite_score:
          c.evidence_strength * c.confidence_score * Math.min(c.signal_sources.length / 3, 1),
      }))
      .sort((a, b) => (b as typeof a & { composite_score: number }).composite_score - (a as typeof a & { composite_score: number }).composite_score)
      .map((c) => {
        const { composite_score: _, ...rest } = c as typeof c & { composite_score: number };
        return rest;
      });
  }

  override getCapabilities(): string[] {
    return [
      "extract_stakeholders",
      "extract_use_cases",
      "identify_pain_points",
      "detect_baseline_clues",
      "rank_value_drivers",
      "flag_missing_data",
    ];
  }
}
