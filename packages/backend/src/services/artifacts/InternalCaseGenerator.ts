/**
 * InternalCaseGenerator
 *
 * Generates internal business case for deal review with economics, risks, and recommendations.
 * Uses Handlebars templating with secure LLM invocation and Zod validation.
 *
 * Task: 3.4, 3.5
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
  InternalCaseInput,
  InternalCaseOutput,
  InternalCaseOutputSchema,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let internalCaseTemplate: HandlebarsTemplateDelegate | null = null;

async function loadTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (internalCaseTemplate) return internalCaseTemplate;
  const templatePath = path.join(__dirname, "../../templates/internal-case.hbs");
  const templateSource = await fs.readFile(templatePath, "utf-8");
  internalCaseTemplate = Handlebars.compile(templateSource);
  return internalCaseTemplate;
}

export class InternalCaseGenerator {
  constructor(
    private readonly llmGateway: LLMGateway,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly memorySystem: MemorySystem
  ) {}

  async generate(input: InternalCaseInput): Promise<{
    output: InternalCaseOutput;
    hallucinationCheck: boolean;
    tokenUsage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  }> {
    const startTime = Date.now();
    logger.info("InternalCaseGenerator: generating internal case", { caseId: input.caseId });

    const template = await loadTemplate();

    const templateContext = {
      organization_name: input.organizationName,
      organization_industry: input.industry || "Unknown",
      organization_size: input.size || "Unknown",
      value_case_title: input.valueCaseTitle,
      case_id: input.caseId,
      deal: input.deal,
      value_model: input.valueModel,
      competitors: input.competitors,
      competitive_advantages: input.competitiveAdvantages,
      competitive_risks: input.competitiveRisks,
      risks: input.risks,
      assumptions: input.assumptions,
      integrity: input.integrity,
    };

    const prompt = template(templateContext);

    const result = await this.circuitBreaker.execute(async () => {
      const invocation = await secureServiceInvoke({
        gateway: this.llmGateway,
        messages: [{ role: "user" as const, content: prompt }],
        schema: InternalCaseOutputSchema,
        request: {
          organizationId: input.organizationId,
          tenantId: input.tenantId,
          caseId: input.caseId,
          artifactType: "internal_case",
          generator: "InternalCaseGenerator",
          serviceName: "InternalCaseGenerator",
          operation: "generate",
        },
        logger,
        actorName: "InternalCaseGenerator",
        sessionId: input.caseId,
        tenantId: input.organizationId,
        invalidJsonMessage: "Invalid JSON response from LLM",
        invalidJsonLogMessage: "InternalCaseGenerator: Failed to parse JSON",
        invalidJsonLogContext: (_content, error) => ({
          error: error instanceof Error ? error.message : String(error),
        }),
        hallucinationCheck: async (parsed) => this.checkHallucination({
          ...parsed,
          data_claim_ids: parsed.provenance_refs,
        }, input),
        escalationLogMessage: "InternalCaseGenerator: Hallucination escalation triggered",
        escalationLogContext: (parsed) => ({
          caseId: input.caseId,
          provenanceRefs: parsed.provenance_refs,
        }),
      });

      const output: InternalCaseOutput = {
        ...invocation.parsed,
        data_claim_ids: invocation.parsed.provenance_refs,
      };

      await this.memorySystem.storeSemanticMemory(
        input.caseId,
        "InternalCaseGenerator",
        "episodic",
        `Generated internal case: ${output.title}`,
        {
          tenant_id: input.tenantId,
          organization_id: input.organizationId,
          case_id: input.caseId,
          artifact_type: "internal_case",
          readiness_score: input.readinessScore,
          recommendation: output.recommendation.decision,
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

    logger.info("InternalCaseGenerator: generation complete", {
      caseId: input.caseId,
      durationMs: Date.now() - startTime,
      hallucinationCheck,
    });

    return { output: result.output, hallucinationCheck, tokenUsage: result.tokenUsage };
  }

  private async checkHallucination(
    output: InternalCaseOutput,
    input: InternalCaseInput
  ): Promise<boolean> {
    if (!output.provenance_refs?.length) {
      logger.warn("InternalCaseGenerator: No provenance refs", { caseId: input.caseId });
      return false;
    }

    // Verify all key drivers have claim IDs
    for (const driver of output.value_analysis.key_drivers) {
      if (!driver.claim_id) {
        logger.warn("InternalCaseGenerator: Missing claim_id for driver", { driver: driver.name });
        return false;
      }
    }

    // Check integrity status consistency
    if (output.integrity_status.vetoed !== input.integrity.vetoed) {
      logger.warn("InternalCaseGenerator: Integrity veto mismatch", {
        expected: input.integrity.vetoed,
        actual: output.integrity_status.vetoed,
      });
      return false;
    }

    return true;
  }
}

type HandlebarsTemplateDelegate = ReturnType<typeof Handlebars.compile>;
