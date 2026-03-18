/**
 * DealAssemblyAgent
 *
 * Orchestrates the complete deal assembly pipeline:
 * CRM → Transcript → Notes → Public → ContextExtraction → Assemble
 *
 * Merges fragments into DealContext with conflict resolution.
 * Persists DealContext to Supabase with tenant_id.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §5
 */

import { z } from "zod";

import { CRMConnector, type CRMFetchResult } from "../../services/deal/CRMConnector";
import { logger } from "../../logger";
import type {
  AgentConfig,
  AgentOutput,
  LifecycleContext,
} from "../../types/agent";
import { CircuitBreaker } from "../CircuitBreaker";
import { LLMGateway } from "../LLMGateway";
import { MemorySystem } from "../MemorySystem";
import { mcpGroundTruthService } from "../../services/MCPGroundTruthService";
import { BaseAgent } from "./BaseAgent";
import {
  ContextExtractionAgent,
  type ExtractedContext,
} from "./ContextExtractionAgent";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SourceClassificationSchema = z.enum([
  "customer-confirmed",
  "crm-derived",
  "call-derived",
  "note-derived",
  "benchmark-derived",
  "externally-researched",
  "tier-1-evidence", // SEC EDGAR and other authoritative sources
  "tier-2-evidence", // Benchmarks and industry data
  "inferred",
  "manually-overridden",
]);

export type SourceClassification = z.infer<typeof SourceClassificationSchema>;

// Source priority for conflict resolution (higher = more authoritative)
const SOURCE_PRIORITY: Record<SourceClassification, number> = {
  "customer-confirmed": 8,
  "crm-derived": 6,
  "call-derived": 5,
  "note-derived": 4,
  "benchmark-derived": 3,
  "externally-researched": 2,
  "tier-1-evidence": 10, // Highest priority - SEC/financial authority
  "tier-2-evidence": 4,  // Benchmark data
  "inferred": 1,
  "manually-overridden": 9, // User overrides are high priority
};

export const DealContextSchema = z.object({
  tenant_id: z.string().uuid(),
  opportunity_id: z.string(),
  assembled_at: z.string().datetime(),
  status: z.enum(["draft", "reviewing", "approved", "archived"]),
  context_json: z.object({
    stakeholders: z.array(z.object({
      name: z.string(),
      role: z.string(),
      priority: z.number(),
      source_type: SourceClassificationSchema,
    })),
    use_cases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      pain_signals: z.array(z.string()),
      source_type: SourceClassificationSchema,
    })),
    value_drivers: z.array(z.object({
      name: z.string(),
      impact_range_low: z.number(),
      impact_range_high: z.number(),
      confidence: z.number(),
      source_type: SourceClassificationSchema,
    })),
    baseline_metrics: z.record(z.unknown()),
    objection_signals: z.array(z.string()),
    missing_data_gaps: z.array(z.object({
      field: z.string(),
      importance: z.enum(["critical", "high", "medium", "low"]),
    })),
  }),
  source_fragments: z.array(z.object({
    source_type: SourceClassificationSchema,
    source_url: z.string().optional(),
    ingested_at: z.string().datetime(),
    fragment_hash: z.string(),
  })),
});

export type DealContext = z.infer<typeof DealContextSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class DealAssemblyAgent extends BaseAgent {
  public override readonly version = "1.0.0";

  private contextExtractionAgent: ContextExtractionAgent;
  private crmConnector: CRMConnector;

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker,
    crmConnector?: CRMConnector
  ) {
    super(config, organizationId, memorySystem, llmGateway, circuitBreaker);

    // Create or use provided CRM connector
    this.crmConnector = crmConnector ?? new CRMConnector();

    // Create context extraction agent as sub-agent
    this.contextExtractionAgent = new ContextExtractionAgent(
      {
        name: "ContextExtractionAgent",
        lifecycle_stage: "discovery",
        metadata: { version: "1.0.0" },
      },
      organizationId,
      memorySystem,
      llmGateway,
      circuitBreaker
    );
  }

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const sessionId = context.case_id ?? `deal-assembly-${Date.now()}`;

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

    const opportunityId = context.opportunity_id;
    if (!opportunityId) {
      return this.buildOutput(
        { error: "No opportunity_id provided in context" },
        "failed",
        "very_low",
        startTime
      );
    }

    try {
      // Step 1: Fetch from CRM
      logger.info("Starting deal assembly: CRM fetch", {
        agent: this.name,
        session_id: sessionId,
        opportunity_id: opportunityId,
      });

      const crmData = await this.crmConnector.fetchDealContext({
        tenantId: context.organization_id,
        crmConnectionId: context.crm_connection_id ?? "default",
        opportunityId,
      });

      // Step 1.5: SEC EDGAR Fetch for public companies (Task 10.1)
      let secData: { ticker?: string; sections?: Record<string, string>; sourceUrl?: string } | null = null;
      const companyDomain = context.user_inputs?.company_domain as string | undefined;
      const companyName = context.user_inputs?.company_name as string | undefined;

      if (companyDomain || companyName) {
        try {
          logger.info("Attempting SEC EDGAR lookup", {
            agent: this.name,
            session_id: sessionId,
            companyDomain,
            companyName,
          });

          // Try to resolve ticker from domain
          const tickerResult = await mcpGroundTruthService.resolveTickerFromDomain({
            domain: companyDomain || `${companyName?.toLowerCase().replace(/\s+/g, '')}.com`,
          });

          if (tickerResult?.ticker) {
            const ticker = tickerResult.ticker;
            logger.info("Resolved ticker for SEC lookup", { ticker, companyDomain });

            // Fetch SEC filing sections
            const sections = await mcpGroundTruthService.getFilingSections({
              identifier: ticker,
              filingType: "10-K",
              sections: ["business", "risk_factors", "mda"],
            });

            if (sections) {
              secData = {
                ticker,
                sections,
                sourceUrl: `https://www.sec.gov/edgar/search/#/entityName=${ticker}`,
              };

              logger.info("SEC EDGAR data retrieved", {
                agent: this.name,
                session_id: sessionId,
                ticker,
                sections: Object.keys(sections),
              });
            }
          }
        } catch (secErr) {
          // SEC fetch is optional - don't fail the whole pipeline
          logger.warn("SEC EDGAR fetch failed, continuing without", {
            agent: this.name,
            session_id: sessionId,
            error: (secErr as Error).message,
          });
        }
      }

      // Step 2: Context Extraction
      logger.info("Starting context extraction", {
        agent: this.name,
        session_id: sessionId,
      });

      const extractionContext: LifecycleContext = {
        ...context,
        crm_data: crmData,
        sec_data: secData,
      };

      const extractionResult = await this.contextExtractionAgent.execute(extractionContext);

      if (extractionResult.status !== "success") {
        logger.error("Context extraction failed", {
          agent: this.name,
          session_id: sessionId,
          error: extractionResult.result.error,
        });
        return this.buildOutput(
          { error: `Context extraction failed: ${extractionResult.result.error}` },
          "failed",
          "very_low",
          startTime
        );
      }

      const extractedContext = extractionResult.result.extracted_context as ExtractedContext;

      // Step 3: Merge and assemble DealContext
      logger.info("Merging fragments into DealContext", {
        agent: this.name,
        session_id: sessionId,
      });

      const dealContext = this.assembleDealContext(
        context.organization_id,
        opportunityId,
        crmData,
        extractedContext,
        secData
      );

      // Step 4: Validate non-empty assembly
      if (this.isEmptyDealContext(dealContext)) {
        return this.buildOutput(
          { error: "DealContext assembly produced empty result" },
          "failed",
          "very_low",
          startTime
        );
      }

      // Step 5: Store in memory for persistence (actual DB write happens via service layer)
      await this.memorySystem.storeSemanticMemory(
        sessionId,
        this.name,
        "semantic",
        `DealContext assembled for opportunity ${opportunityId}`,
        {
          deal_context: dealContext,
          tenant_id: context.organization_id,
          opportunity_id: opportunityId,
          assembled_at: dealContext.assembled_at,
        },
        context.organization_id
      );

      // Step 6: Emit completion event
      logger.info("Deal assembly completed successfully", {
        agent: this.name,
        session_id: sessionId,
        stakeholders_count: dealContext.context_json.stakeholders.length,
        use_cases_count: dealContext.context_json.use_cases.length,
        value_drivers_count: dealContext.context_json.value_drivers.length,
        missing_gaps_count: dealContext.context_json.missing_data_gaps.length,
      });

      return this.buildOutput(
        {
          deal_context: dealContext,
          assembly_summary: {
            sources_consulted: [
              "crm",
              ...(secData?.ticker ? [`sec-edgar:${secData.ticker}`] : []),
            ],
            stakeholders_identified: dealContext.context_json.stakeholders.length,
            use_cases_identified: dealContext.context_json.use_cases.length,
            value_drivers_ranked: dealContext.context_json.value_drivers.length,
            data_gaps_flagged: dealContext.context_json.missing_data_gaps.length,
            tier_1_sources_used: dealContext.source_fragments.filter(
              s => s.source_type === "tier-1-evidence"
            ).length,
          },
          sec_data: secData?.ticker ? {
            ticker: secData.ticker,
            source_url: secData.sourceUrl,
            sections_found: Object.keys(secData.sections || {}),
          } : null,
        },
        "success",
        this.toConfidenceLevel(extractedContext.extraction_confidence),
        startTime,
        {
          reasoning: `Assembled deal context from CRM data${secData?.ticker ? ` and SEC EDGAR (ticker: ${secData.ticker})` : ""} with ${dealContext.context_json.stakeholders.length} stakeholders and ${dealContext.context_json.value_drivers.length} value drivers`,
          suggested_next_actions: dealContext.context_json.missing_data_gaps
            .filter((g) => g.importance === "critical")
            .map((g) => `Fill critical data gap: ${g.field}`),
        }
      );
    } catch (error) {
      logger.error("Deal assembly failed", {
        agent: this.name,
        session_id: sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.buildOutput(
        { error: error instanceof Error ? error.message : "Deal assembly failed" },
        "failed",
        "very_low",
        startTime
      );
    }
  }

  /**
   * Assemble DealContext from extracted fragments.
   * Applies conflict resolution: customer-confirmed > CRM-derived > call-derived > inferred
   */
  private assembleDealContext(
    tenantId: string,
    opportunityId: string,
    crmData: CRMFetchResult,
    extractedContext: ExtractedContext,
    secData?: { ticker?: string; sections?: Record<string, string>; sourceUrl?: string } | null
  ): DealContext {
    const now = new Date().toISOString();

    // Assemble stakeholders from CRM contacts with extraction enrichment
    const stakeholders = this.mergeStakeholders(
      crmData.contacts,
      extractedContext.stakeholders
    );

    // Assemble use cases from extraction
    const useCases = extractedContext.use_cases.map((uc) => ({
      name: uc.name,
      description: uc.description,
      pain_signals: uc.pain_signals,
      source_type: uc.source_type as SourceClassification,
    }));

    // Assemble value drivers from extraction candidates
    const valueDrivers = extractedContext.value_driver_candidates.map((vd) => ({
      name: vd.driver_name,
      impact_range_low: vd.impact_estimate_low,
      impact_range_high: vd.impact_estimate_high,
      confidence: vd.confidence_score,
      source_type: "crm-derived" as SourceClassification, // Derived from CRM data via extraction
    }));

    // Build source fragments list
    const sourceFragments: DealContext["source_fragments"] = [
      {
        source_type: "crm-derived",
        source_url: `crm://opportunity/${opportunityId}`,
        ingested_at: now,
        fragment_hash: this.computeHash(crmData),
      },
    ];

    // Add SEC source fragment if available (Task 10.3 - Show sources, Task 10.4 - Tier 1 tagging)
    if (secData?.ticker && secData.sections) {
      sourceFragments.push({
        source_type: "tier-1-evidence", // Tier 1 evidence tag
        source_url: secData.sourceUrl || `sec://edgar/${secData.ticker}`,
        ingested_at: now,
        fragment_hash: this.computeHash(secData.sections),
      });

      // Enhance value drivers with SEC-derived confidence boost
      // If SEC data exists, mark related value drivers with tier-1-evidence
      for (const driver of valueDrivers) {
        // Check if driver name matches any SEC section content keywords
        const driverKeywords = driver.name.toLowerCase().split(/\s+/);
        const secContent = Object.values(secData.sections || {}).join(" ").toLowerCase();

        const hasKeywordMatch = driverKeywords.some(keyword =>
          secContent.includes(keyword) && keyword.length > 4
        );

        if (hasKeywordMatch) {
          driver.source_type = "tier-1-evidence";
          driver.confidence = Math.min(1, driver.confidence + 0.15); // Boost confidence
        }
      }
    }

    return {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      assembled_at: now,
      status: "draft",
      context_json: {
        stakeholders,
        use_cases: useCases,
        value_drivers: valueDrivers,
        baseline_metrics: extractedContext.baseline_clues,
        objection_signals: extractedContext.objection_signals,
        missing_data_gaps: extractedContext.missing_data.map((m) => ({
          field: m.field_name,
          importance: m.importance,
        })),
      },
      source_fragments: sourceFragments,
    };
  }

  /**
   * Merge stakeholders from CRM with extraction results.
   * Uses source priority for conflict resolution.
   */
  private mergeStakeholders(
    crmContacts: CRMFetchResult["contacts"],
    extractedStakeholders: ExtractedContext["stakeholders"]
  ): DealContext["context_json"]["stakeholders"] {
    const merged = new Map<string, DealContext["context_json"]["stakeholders"][0]>();

    // Add CRM contacts first
    for (const contact of crmContacts) {
      const key = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      merged.set(key, {
        name: `${contact.first_name} ${contact.last_name}`,
        role: contact.role,
        priority: contact.is_primary ? 9 : 5,
        source_type: "crm-derived",
      });
    }

    // Merge extraction results (higher priority can override)
    for (const stakeholder of extractedStakeholders) {
      const key = stakeholder.name.toLowerCase();
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          name: stakeholder.name,
          role: stakeholder.role,
          priority: stakeholder.priority,
          source_type: stakeholder.source_type as SourceClassification,
        });
      } else {
        // Conflict resolution: higher priority source wins
        const existingPriority = SOURCE_PRIORITY[existing.source_type];
        const newPriority = SOURCE_PRIORITY[stakeholder.source_type as SourceClassification];

        if (newPriority > existingPriority) {
          merged.set(key, {
            name: stakeholder.name,
            role: stakeholder.role,
            priority: stakeholder.priority,
            source_type: stakeholder.source_type as SourceClassification,
          });
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Check if DealContext is empty (no meaningful content).
   */
  private isEmptyDealContext(dealContext: DealContext): boolean {
    const ctx = dealContext.context_json;
    return (
      ctx.stakeholders.length === 0 &&
      ctx.use_cases.length === 0 &&
      ctx.value_drivers.length === 0 &&
      Object.keys(ctx.baseline_metrics).length === 0
    );
  }

  /**
   * Simple hash computation for fragment tracking.
   */
  private computeHash(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  }

  getCapabilities(): string[] {
    return [
      "fetch_crm_data",
      "extract_context",
      "merge_fragments",
      "resolve_conflicts",
      "assemble_deal_context",
      "persist_context",
    ];
  }
}
