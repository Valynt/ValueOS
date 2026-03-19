/**
 * ExecutiveMemoGenerator
 *
 * Generates executive-ready value memos from validated value models.
 * Uses Handlebars templating with secure LLM invocation and Zod validation.
 *
 * Task: 3.1, 3.5
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
  ExecutiveMemoInput,
  ExecutiveMemoOutput,
  ExecutiveMemoOutputSchema,
} from "./types.js";

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let executiveMemoTemplate: HandlebarsTemplateDelegate | null = null;

async function loadTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (executiveMemoTemplate) return executiveMemoTemplate;

  const templatePath = path.join(
    __dirname,
    "../../templates/executive-memo.hbs"
  );
  const templateSource = await fs.readFile(templatePath, "utf-8");
  executiveMemoTemplate = Handlebars.compile(templateSource);
  return executiveMemoTemplate;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class ExecutiveMemoGenerator {
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
   * Generate an executive memo from validated model input.
   */
  async generate(input: ExecutiveMemoInput): Promise<{
    output: ExecutiveMemoOutput;
    hallucinationCheck: boolean;
    tokenUsage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  }> {
    const startTime = Date.now();
    logger.info("ExecutiveMemoGenerator: generating memo", {
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
      valueModel: {
        hypothesis: input.valueHypothesis,
        drivers: input.drivers.map((d) => ({
          name: d.name,
          impactRange: d.impactRange,
          unit: d.unit,
          confidence: d.confidence,
          provenance: d.provenance,
        })),
      },
      integrity: {
        score: input.integrityScore,
        veto: input.vetoed,
        blockers: input.blockers || [],
      },
      financials: input.financials,
      assumptions: input.assumptions,
    };

    // Render prompt
    const prompt = template(templateContext);

    // Invoke LLM with circuit breaker and Zod validation
    const result = await this.circuitBreaker.execute(async () => {
      const invocation = await secureServiceInvoke({
        gateway: this.llmGateway,
        messages: [{ role: "user" as const, content: prompt }],
        schema: ExecutiveMemoOutputSchema,
        request: {
          organizationId: input.organizationId,
          tenantId: input.tenantId,
          caseId: input.caseId,
          artifactType: "executive_memo",
          generator: "ExecutiveMemoGenerator",
          serviceName: "ExecutiveMemoGenerator",
          operation: "generate",
        },
        logger,
        actorName: "ExecutiveMemoGenerator",
        sessionId: input.caseId,
        tenantId: input.organizationId,
        invalidJsonMessage: "Invalid JSON response from LLM",
        invalidJsonLogMessage: "ExecutiveMemoGenerator: Failed to parse LLM response as JSON",
        invalidJsonLogContext: (content, error) => ({
          error: error instanceof Error ? error.message : String(error),
          content: content.slice(0, 500),
        }),
        hallucinationCheck: async (parsed) => this.checkHallucination({
          ...parsed,
          data_claim_ids: parsed.provenance_refs,
        }, input),
        escalationLogMessage: "ExecutiveMemoGenerator: Hallucination escalation triggered",
        escalationLogContext: (parsed) => ({
          caseId: input.caseId,
          provenanceRefs: parsed.provenance_refs,
        }),
      });

      const output: ExecutiveMemoOutput = {
        ...invocation.parsed,
        data_claim_ids: invocation.parsed.provenance_refs,
      };

      await this.memorySystem.storeSemanticMemory(
        input.caseId,
        "ExecutiveMemoGenerator",
        "episodic",
        `Generated executive memo: ${output.title}`,
        {
          tenant_id: input.tenantId,
          organization_id: input.organizationId,
          case_id: input.caseId,
          artifact_type: "executive_memo",
          readiness_score: input.readinessScore,
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
    logger.info("ExecutiveMemoGenerator: generation complete", {
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
   * Verify that all financial figures in the output have provenance references.
   */
  private async checkHallucination(
    output: ExecutiveMemoOutput,
    input: ExecutiveMemoInput
  ): Promise<boolean> {
    // Check that provenance_refs is not empty
    if (!output.provenance_refs || output.provenance_refs.length === 0) {
      logger.warn("ExecutiveMemoGenerator: Hallucination check failed - no provenance refs", {
        caseId: input.caseId,
      });
      return false;
    }

    // Verify all financial highlights have claim IDs
    const { financial_highlights } = output;
    const requiredFields = ["roi_range", "npv", "payback_months"];
    const hasAllFields = requiredFields.every(
      (field) =>
        financial_highlights[field as keyof typeof financial_highlights] !== undefined
    );

    if (!hasAllFields) {
      logger.warn("ExecutiveMemoGenerator: Hallucination check failed - missing financial fields", {
        caseId: input.caseId,
      });
      return false;
    }

    // Cross-reference provenance with input drivers
    const inputClaimIds = new Set(input.drivers.map((d) => d.provenance.claimId));
    const outputClaimIds = new Set(output.top_drivers.map((d) => d.claim_id));

    // All output claim IDs should exist in input
    for (const claimId of outputClaimIds) {
      if (!inputClaimIds.has(claimId)) {
        logger.warn("ExecutiveMemoGenerator: Unverified claim in output", {
          claimId,
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
