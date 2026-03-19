/**
 * CustomerNarrativeGenerator
 *
 * Generates industry-tailored, buyer-persona-appropriate value narratives.
 * Uses Handlebars templating with secure LLM invocation and Zod validation.
 *
 * Task: 3.3, 3.5
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
  CustomerNarrativeInput,
  CustomerNarrativeOutput,
  CustomerNarrativeOutputSchema,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let customerTemplate: HandlebarsTemplateDelegate | null = null;

async function loadTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (customerTemplate) return customerTemplate;
  const templatePath = path.join(__dirname, "../../templates/customer-narrative.hbs");
  const templateSource = await fs.readFile(templatePath, "utf-8");
  customerTemplate = Handlebars.compile(templateSource);
  return customerTemplate;
}

export class CustomerNarrativeGenerator {
  constructor(
    private readonly llmGateway: LLMGateway,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly memorySystem: MemorySystem
  ) {}

  async generate(input: CustomerNarrativeInput): Promise<{
    output: CustomerNarrativeOutput;
    hallucinationCheck: boolean;
    tokenUsage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  }> {
    const startTime = Date.now();
    logger.info("CustomerNarrativeGenerator: generating narrative", { caseId: input.caseId });

    const template = await loadTemplate();

    const templateContext = {
      organization_name: input.organizationName,
      organization_industry: input.industry || "Unknown",
      organization_size: input.size || "Unknown",
      value_case_title: input.valueCaseTitle,
      case_id: input.caseId,
      buyer: input.buyer,
      industry_context: input.industryContext,
      drivers: input.drivers,
      benchmarks: input.benchmarks,
      proof_points: input.proofPoints,
    };

    const prompt = template(templateContext);

    const result = await this.circuitBreaker.execute(async () => {
      const invocation = await secureServiceInvoke({
        gateway: this.llmGateway,
        messages: [{ role: "user" as const, content: prompt }],
        schema: CustomerNarrativeOutputSchema,
        request: {
          organizationId: input.organizationId,
          tenantId: input.tenantId,
          caseId: input.caseId,
          artifactType: "customer_narrative",
          generator: "CustomerNarrativeGenerator",
          serviceName: "CustomerNarrativeGenerator",
          operation: "generate",
        },
        logger,
        actorName: "CustomerNarrativeGenerator",
        sessionId: input.caseId,
        tenantId: input.organizationId,
        invalidJsonMessage: "Invalid JSON response from LLM",
        invalidJsonLogMessage: "CustomerNarrativeGenerator: Failed to parse JSON",
        invalidJsonLogContext: (_content, error) => ({
          error: error instanceof Error ? error.message : String(error),
        }),
        hallucinationCheck: async (parsed) => this.checkHallucination({
          ...parsed,
          data_claim_ids: parsed.provenance_refs,
        }, input),
        escalationLogMessage: "CustomerNarrativeGenerator: Hallucination escalation triggered",
        escalationLogContext: (parsed) => ({
          caseId: input.caseId,
          provenanceRefs: parsed.provenance_refs,
        }),
      });

      const output: CustomerNarrativeOutput = {
        ...invocation.parsed,
        data_claim_ids: invocation.parsed.provenance_refs,
      };

      await this.memorySystem.storeSemanticMemory(
        input.caseId,
        "CustomerNarrativeGenerator",
        "episodic",
        `Generated customer narrative: ${output.title}`,
        {
          tenant_id: input.tenantId,
          organization_id: input.organizationId,
          case_id: input.caseId,
          artifact_type: "customer_narrative",
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

    logger.info("CustomerNarrativeGenerator: generation complete", {
      caseId: input.caseId,
      durationMs: Date.now() - startTime,
      hallucinationCheck,
    });

    return { output: result.output, hallucinationCheck, tokenUsage: result.tokenUsage };
  }

  private async checkHallucination(
    output: CustomerNarrativeOutput,
    input: CustomerNarrativeInput
  ): Promise<boolean> {
    if (!output.provenance_refs?.length) {
      logger.warn("CustomerNarrativeGenerator: No provenance refs", { caseId: input.caseId });
      return false;
    }

    // Verify all business outcomes have claim IDs
    for (const outcome of output.business_outcomes) {
      if (!outcome.claim_id) {
        logger.warn("CustomerNarrativeGenerator: Missing claim_id for outcome", { outcome: outcome.outcome });
        return false;
      }
    }

    // Verify all proof points have evidence references
    for (const proof of output.proof_points) {
      if (!proof.evidence_ref) {
        logger.warn("CustomerNarrativeGenerator: Missing evidence_ref", { headline: proof.headline });
        return false;
      }
    }

    return true;
  }
}

type HandlebarsTemplateDelegate = ReturnType<typeof Handlebars.compile>;
