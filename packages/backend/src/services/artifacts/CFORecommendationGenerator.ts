/**
 * CFORecommendationGenerator
 *
 * Generates CFO-ready investment recommendation memos with financial rigor.
 * Uses Handlebars templating with secure LLM invocation and Zod validation.
 *
 * Task: 3.2, 3.5
 */

import Handlebars from "handlebars";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CircuitBreaker } from "../resilience/CircuitBreaker.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem";
import { logger } from "../lib/logger.js";
import { secureServiceInvoke } from "../llm/secureServiceInvocation.js";

import {
  CFORecommendationInput,
  CFORecommendationOutput,
  CFORecommendationOutputSchema,
} from "./types.js";

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cfoTemplate: HandlebarsTemplateDelegate | null = null;

async function loadTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (cfoTemplate) return cfoTemplate;

  const templatePath = path.join(
    __dirname,
    "../../templates/cfo-recommendation.hbs"
  );
  const templateSource = await fs.readFile(templatePath, "utf-8");
  cfoTemplate = Handlebars.compile(templateSource);
  return cfoTemplate;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class CFORecommendationGenerator {
  private readonly llmGateway: LLMGateway;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly memorySystem: MemorySystem;

  constructor(
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker,
    memorySystem: MemorySystem
  ) {
    this.llmGateway = llmGateway;
    this.circuitBreaker = circuitBreaker;
    this.memorySystem = memorySystem;
  }

  /**
   * Generate a CFO recommendation from financial scenarios.
   */
  async generate(input: CFORecommendationInput): Promise<{
    output: CFORecommendationOutput;
    hallucinationCheck: boolean;
    tokenUsage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  }> {
    const startTime = Date.now();
    logger.info("CFORecommendationGenerator: generating recommendation", {
      caseId: input.caseId,
      organizationId: input.organizationId,
    });

    // Load and compile template
    const template = await loadTemplate();

    // Build template context
    const templateContext = {
      organization: {
        name: input.organizationName,
        industry: input.industry || "Unknown",
      },
      valueCase: {
        id: input.caseId,
        title: input.valueCaseTitle,
      },
      financials: {
        scenarios: input.scenarios,
        assumptions: input.assumptions,
        sensitivities: input.sensitivities,
        riskAdjusted: input.riskAdjustedNpv
          ? {
              npv: input.riskAdjustedNpv,
              roi: input.riskAdjustedRoi,
            }
          : null,
      },
      benchmarks: input.benchmarks,
    };

    // Render prompt
    const prompt = template(templateContext);

    // Invoke LLM with circuit breaker and Zod validation
    const result = await this.circuitBreaker.execute(async () => {
      const invocation = await secureServiceInvoke({
        gateway: this.llmGateway,
        messages: [{ role: "user" as const, content: prompt }],
        schema: CFORecommendationOutputSchema,
        request: {
          organizationId: input.organizationId,
          tenantId: input.tenantId,
          caseId: input.caseId,
          artifactType: "cfo_recommendation",
          generator: "CFORecommendationGenerator",
          serviceName: "CFORecommendationGenerator",
          operation: "generate",
        },
        logger,
        actorName: "CFORecommendationGenerator",
        sessionId: input.caseId,
        tenantId: input.organizationId,
        invalidJsonMessage: "Invalid JSON response from LLM",
        invalidJsonLogMessage: "CFORecommendationGenerator: Failed to parse LLM response as JSON",
        invalidJsonLogContext: (content, error) => ({
          error: error instanceof Error ? error.message : String(error),
          content: content.slice(0, 500),
        }),
        hallucinationCheck: async (parsed) => this.checkHallucination({
          ...parsed,
          data_claim_ids: parsed.provenance_refs,
        }, input),
        escalationLogMessage: "CFORecommendationGenerator: Hallucination escalation triggered",
        escalationLogContext: (parsed) => ({
          caseId: input.caseId,
          provenanceRefs: parsed.provenance_refs,
        }),
      });

      const output: CFORecommendationOutput = {
        ...invocation.parsed,
        data_claim_ids: invocation.parsed.provenance_refs,
      };

      await this.memorySystem.storeSemanticMemory(
        input.caseId,
        "CFORecommendationGenerator",
        "episodic",
        `Generated CFO recommendation: ${output.recommendation.decision}`,
        {
          tenant_id: input.tenantId,
          organization_id: input.organizationId,
          case_id: input.caseId,
          artifact_type: "cfo_recommendation",
          readiness_score: input.readinessScore,
          decision: output.recommendation.decision,
          provenance_refs: output.provenance_refs,
        },
        input.organizationId
      );

      return {
        output,
        hallucinationCheck: invocation.hallucinationCheck,
        tokenUsage: invocation.tokenUsage,
      };
    });

    const hallucinationCheck = result.hallucinationCheck;

    const duration = Date.now() - startTime;
    logger.info("CFORecommendationGenerator: generation complete", {
      caseId: input.caseId,
      durationMs: duration,
      hallucinationCheck,
    });

    return {
      output: result.output,
      hallucinationCheck,
      tokenUsage: result.tokenUsage,
    };
  }

  /**
   * Verify that all financial claims have source references and confidence scores.
   */
  private async checkHallucination(
    output: CFORecommendationOutput,
    input: CFORecommendationInput
  ): Promise<boolean> {
    // Check that all financial figures have source references
    const { financial_summary, key_assumptions } = output;

    // Verify all scenarios have claim IDs
    for (const scenario of financial_summary.scenarios) {
      if (!scenario.claim_id) {
        logger.warn("CFORecommendationGenerator: Missing claim_id for scenario", {
          scenario: scenario.name,
          caseId: input.caseId,
        });
        return false;
      }
    }

    // Verify all assumptions have source info
    for (const assumption of key_assumptions) {
      if (!assumption.source_id || assumption.confidence === undefined) {
        logger.warn("CFORecommendationGenerator: Missing source or confidence for assumption", {
          assumption: assumption.assumption,
          caseId: input.caseId,
        });
        return false;
      }
    }

    // Verify all benchmark references exist
    for (const benchmark of output.benchmark_context) {
      if (!benchmark.benchmark_id) {
        logger.warn("CFORecommendationGenerator: Missing benchmark_id", {
          metric: benchmark.metric,
          caseId: input.caseId,
        });
        return false;
      }
    }

    // Cross-reference with input data
    const inputScenarioIds = new Set(input.scenarios.map((s) => s.claimId));
    for (const scenario of financial_summary.scenarios) {
      if (!inputScenarioIds.has(scenario.claim_id)) {
        logger.warn("CFORecommendationGenerator: Unverified scenario claim", {
          claimId: scenario.claim_id,
          caseId: input.caseId,
        });
        return false;
      }
    }

    return true;
  }
}

// Export for use in NarrativeAgent
type HandlebarsTemplateDelegate = ReturnType<typeof Handlebars.compile>;
