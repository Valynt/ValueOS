/**
 * Adversarial Reasoning Agent System
 *
 * Multi-agent cross-checking framework for audit-ready intelligence:
 * - Agent A: Extracts value drivers
 * - Agent B: Challenges/contradicts findings
 * - Agent C: Synthesizes and reconciles
 *
 * Implements adversarial validation pattern for higher accuracy.
 */

import { BaseAgent } from "./BaseAgent";
import { AgentConfig } from "../../../types/agent";
import {
  ConfidenceScore,
  ValueDriver,
  ValueDriverValidationResult,
} from "../../../types/valueDriverTaxonomy";
import { logger } from "../../../lib/logger";
import { z } from "zod";

// =====================================================
// AGENT A: VALUE DRIVER EXTRACTION AGENT
// =====================================================

import { randomUUID } from "crypto";

export interface ExtractionInput {
  organization_id: string;
  value_case_id: string;
  discovery_sources: {
    id: string;
    type:
      | "transcript"
      | "email"
      | "document"
      | "survey"
      | "interview"
      | "web_scrape";
    content: string;
    metadata?: Record<string, any>;
  }[];
  context?: {
    industry?: string;
    company_size?: string;
    buyer_persona?: Record<string, any>;
  };
}

export interface ExtractionOutput {
  drivers: ValueDriver[];
  extraction_confidence: ConfidenceScore;
  reasoning: string;
}

const buildExtractionPrompt = (input: ExtractionInput): string => {
  const contextLines = [
    input.context?.industry ? `Industry: ${input.context.industry}` : null,
    input.context?.company_size
      ? `Company Size: ${input.context.company_size}`
      : null,
  ].filter(Boolean);
  const contextBlock =
    contextLines.length > 0 ? `${contextLines.join("\n")}\n\n` : "";
  const sourcesBlock = input.discovery_sources
    .map((source, index) =>
      [
        "---",
        `Source ${index}: ${source.type} (ID: ${source.id})`,
        source.content,
        "---",
      ].join("\n")
    )
    .join("\n");
  const exampleSourceId = input.discovery_sources[0]?.id ?? "source_0";
  const exampleSourceType = input.discovery_sources[0]?.type ?? "transcript";

  return `You are a value engineering expert extracting structured value drivers from discovery sources.

${contextBlock}DISCOVERY SOURCES (${input.discovery_sources.length} documents):
${sourcesBlock}

Extract structured value drivers using the Value Driver Taxonomy v2:

For each driver, identify:
1. Category: revenue | cost | risk
2. Subcategory: (specific type like "conversion_rate", "cycle_time", "compliance_violation")
3. Economic Mechanism: ratio | linear | logarithmic | exponential | step | hybrid
4. Evidence: Extract exact quotes that support this driver
5. Quantification: Baseline, target, expected delta
6. Confidence: 0.0-1.0 based on evidence quality

Return valid JSON:
{
  "drivers": [
    {
      "category": "revenue|cost|risk",
      "subcategory": "<specific_type>",
      "name": "<short name>",
      "description": "<detailed explanation>",
      "economic_mechanism": "ratio|linear|logarithmic|exponential|step|hybrid",
      "confidence_score": 0.85,
      "evidence": [
        {
          "source_id": "${exampleSourceId}",
          "source_type": "${exampleSourceType}",
          "text": "<exact quote>",
          "relevance": 0.9
        }
      ],
      "baseline_value": 100,
      "baseline_unit": "units/month",
      "target_value": 150,
      "target_unit": "units/month",
      "expected_delta": 50,
      "delta_unit": "units/month",
      "timeframe_months": 12,
      "financial_impact": {
        "annual_value": 100000,
        "currency": "USD",
        "calculation_method": "delta * unit_value * 12",
        "confidence": 0.75
      }
    }
  ],
  "extraction_confidence": 0.8,
  "reasoning": "<your analytical process>"
}`;
};

export class ValueDriverExtractionAgent extends BaseAgent {
  public lifecycleStage = "opportunity";
  public version = "2.0";
  public name = "ValueDriverExtractionAgent";

  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(
    sessionId: string,
    input: ExtractionInput
  ): Promise<ExtractionOutput> {
    const prompt = buildExtractionPrompt(input);

    // Define schema for structured output validation
    const extractionSchema = z.object({
      drivers: z.array(z.any()),
      extraction_confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    });

    // SECURITY FIX: secureInvoke() enforces structured output validation via Zod schema
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      extractionSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.6, high: 0.85 },
        context: {
          agent: "ValueDriverExtractionAgent",
          organizationId: input.organization_id,
          sourcesCount: input.discovery_sources.length,
        },
      }
    );

    const parsed = secureResult.result;

    // Enhance with metadata
    const drivers: ValueDriver[] = parsed.drivers.map((d: any) => ({
      ...d,
      id: this.generateId(),
      organization_id: input.organization_id,
      value_case_id: input.value_case_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      extracted_by_agent: this.agentId,
      benchmarks: [], // To be populated by ground truth integration
    }));

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Extracted ${drivers.length} value drivers from ${input.discovery_sources.length} sources`,
      { drivers, extraction_confidence: parsed.extraction_confidence },
      input.organization_id // SECURITY: Tenant isolation
    );

    return {
      drivers,
      extraction_confidence: parsed.extraction_confidence,
      reasoning: parsed.reasoning,
    };
  }

  private generateId(): string {
    return `vd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =====================================================
// AGENT B: ADVERSARIAL CHALLENGE AGENT
// =====================================================

export interface ChallengeInput {
  organization_id: string;
  value_case_id: string;
  drivers: ValueDriver[];
  discovery_sources: ExtractionInput["discovery_sources"];
}

export interface ChallengeOutput {
  validations: ValueDriverValidationResult[];
  overall_assessment: "strong" | "moderate" | "weak";
  reasoning: string;
}

const buildChallengePrompt = (input: ChallengeInput): string => {
  const driversBlock = input.drivers
    .map((driver, index) =>
      [
        "---",
        `Driver ${index}: ${driver.name}`,
        `Category: ${driver.category} / ${driver.subcategory}`,
        `Claim: ${driver.description}`,
        `Baseline: ${driver.baseline_value ?? "N/A"} ${driver.baseline_unit ?? ""}`.trim(),
        `Target: ${driver.target_value ?? "N/A"} ${driver.target_unit ?? ""}`.trim(),
        `Delta: ${driver.expected_delta ?? "N/A"} ${driver.delta_unit ?? ""}`.trim(),
        `Financial Impact: $${driver.financial_impact?.annual_value ?? "N/A"}`,
        `Confidence: ${driver.confidence_score ?? "N/A"}`,
        `Evidence Count: ${driver.evidence?.length ?? 0}`,
        "---",
      ].join("\n")
    )
    .join("\n");
  const sourcesBlock = input.discovery_sources
    .map((source, index) =>
      ["---", `Source ${index}: ${source.type}`, source.content, "---"].join(
        "\n"
      )
    )
    .join("\n");
  const exampleDriverId = input.drivers[0]?.id ?? "driver_0";

  return `You are a critical auditor reviewing value driver claims for weaknesses, contradictions, and unsupported assumptions.

VALUE DRIVERS TO CHALLENGE (${input.drivers.length} drivers):
${driversBlock}

ORIGINAL SOURCES:
${sourcesBlock}

For EACH driver, actively search for:
1. **Contradicting Evidence**: Quotes that suggest the driver is weaker than claimed
2. **Unsupported Assumptions**: Claims without direct evidence
3. **Optimistic Bias**: Estimates that seem unrealistic
4. **Missing Context**: Important qualifiers or limitations not mentioned
5. **Calculation Errors**: Flawed financial impact logic

Return valid JSON:
{
  "validations": [
    {
      "driver_id": "${exampleDriverId}",
      "is_valid": true,
      "validation_issues": [
        "Baseline value not supported by evidence",
        "Target assumes 100% adoption without considering change management"
      ],
      "supporting_evidence_count": 2,
      "contradicting_evidence_count": 1,
      "benchmark_alignment": "aligned|below|above|unknown",
      "final_confidence": 0.65,
      "recommendations": [
        "Lower target value to 120 (from 150)",
        "Add adoption curve assumption"
      ]
    }
  ],
  "overall_assessment": "moderate",
  "reasoning": "<your critical analysis>"
}`;
};

export class AdversarialChallengeAgent extends BaseAgent {
  public lifecycleStage = "integrity";
  public version = "2.0";
  public name = "AdversarialChallengeAgent";

  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(
    sessionId: string,
    input: ChallengeInput
  ): Promise<ChallengeOutput> {
    const prompt = buildChallengePrompt(input);

    // Define schema for validation output
    const challengeSchema = z.object({
      validations: z.array(z.any()),
      overall_assessment: z.enum(["strong", "moderate", "weak"]),
      reasoning: z.string(),
    });

    // SECURITY FIX: secureInvoke() enforces structured output validation via Zod schema
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      challengeSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.5, high: 0.8 },
        context: {
          agent: "AdversarialChallengeAgent",
          organizationId: input.organization_id,
          driversToChallenge: input.drivers.length,
        },
      }
    );

    const parsed = secureResult.result;

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Challenged ${input.drivers.length} drivers, found ${parsed.validations.filter((v: any) => !v.is_valid).length} with issues`,
      {
        validations: parsed.validations,
        overall_assessment: parsed.overall_assessment,
      },
      input.organization_id // SECURITY: Tenant isolation
    );

    return {
      validations: parsed.validations,
      overall_assessment: parsed.overall_assessment,
      reasoning: parsed.reasoning,
    };
  }
}

// =====================================================
// AGENT C: SYNTHESIS & RECONCILIATION AGENT
// =====================================================

export interface ReconciliationInput {
  organization_id: string;
  value_case_id: string;
  original_drivers: ValueDriver[];
  extraction_reasoning: string;
  validations: ValueDriverValidationResult[];
  challenge_reasoning: string;
}

export interface ReconciliationOutput {
  final_drivers: ValueDriver[];
  reconciliation_summary: {
    drivers_accepted: number;
    drivers_modified: number;
    drivers_rejected: number;
    overall_confidence: ConfidenceScore;
  };
  audit_trail: {
    driver_id: string;
    action: "accepted" | "modified" | "rejected";
    reason: string;
    original_confidence: ConfidenceScore;
    final_confidence: ConfidenceScore;
  }[];
  reasoning: string;
}

const buildReconciliationPrompt = (input: ReconciliationInput): string => {
  const driversBlock = input.original_drivers
    .map((driver, index) =>
      [
        "---",
        `Driver ${index}: ${driver.name}`,
        `Original Confidence: ${driver.confidence_score ?? "N/A"}`,
        `Financial Impact: $${driver.financial_impact?.annual_value ?? "N/A"}`,
        "---",
      ].join("\n")
    )
    .join("\n");
  const validationsBlock = input.validations
    .map((validation) =>
      [
        "---",
        `Driver: ${validation.driver_id}`,
        `Valid: ${validation.is_valid}`,
        `Issues: ${(validation.validation_issues ?? []).join("; ")}`,
        `Supporting Evidence: ${validation.supporting_evidence_count ?? 0}`,
        `Contradicting Evidence: ${validation.contradicting_evidence_count ?? 0}`,
        `Adjusted Confidence: ${validation.final_confidence ?? "N/A"}`,
        `Recommendations: ${(validation.recommendations ?? []).join("; ")}`,
        "---",
      ].join("\n")
    )
    .join("\n");
  const exampleDriverId = input.original_drivers[0]?.id ?? "driver_0";

  return `You are a senior value engineering consultant synthesizing adversarial analysis into final, audit-ready value drivers.

ORIGINAL EXTRACTION:
${input.extraction_reasoning}

DRIVERS (${input.original_drivers.length}):
${driversBlock}

CHALLENGE FINDINGS:
${input.challenge_reasoning}

VALIDATION RESULTS:
${validationsBlock}

Synthesize a final set of drivers by:
1. **Accept**: Strong evidence, minimal contradictions → Keep as-is
2. **Modify**: Good evidence but with caveats → Adjust values/confidence
3. **Reject**: Insufficient evidence or major contradictions → Remove

For each driver, provide:
- Final decision (accepted/modified/rejected)
- Adjusted confidence score
- Modified financial impact (if applicable)
- Clear reasoning for the decision

Return valid JSON:
{
  "final_drivers": [
    {
      "id": "${exampleDriverId}",
      "category": "revenue",
      "subcategory": "conversion_rate",
      "name": "<adjusted name>",
      "confidence_score": 0.75,
      "financial_impact": {
        "annual_value": 80000,
        "currency": "USD",
        "calculation_method": "conservative estimate after adversarial review",
        "confidence": 0.7
      }
    }
  ],
  "reconciliation_summary": {
    "drivers_accepted": 2,
    "drivers_modified": 3,
    "drivers_rejected": 1,
    "overall_confidence": 0.78
  },
  "audit_trail": [
    {
      "driver_id": "${exampleDriverId}",
      "action": "modified",
      "reason": "Reduced target from 150 to 120 due to adoption curve concerns",
      "original_confidence": 0.85,
      "final_confidence": 0.75
    }
  ],
  "reasoning": "<your synthesis logic>"
}`;
};

export class ReconciliationAgent extends BaseAgent {
  public lifecycleStage = "integrity";
  public version = "2.0";
  public name = "ReconciliationAgent";

  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(
    sessionId: string,
    input: ReconciliationInput
  ): Promise<ReconciliationOutput> {
    const prompt = buildReconciliationPrompt(input);

    // Define schema for reconciliation output
    const reconciliationSchema = z.object({
      final_drivers: z.array(z.any()),
      reconciliation_summary: z.object({
        drivers_accepted: z.number(),
        drivers_modified: z.number(),
        drivers_rejected: z.number(),
        overall_confidence: z.number().min(0).max(1),
      }),
      audit_trail: z.array(z.any()),
      reasoning: z.string(),
    });

    // SECURITY FIX: secureInvoke() enforces structured output validation via Zod schema
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      reconciliationSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.6, high: 0.85 },
        context: {
          agent: "ReconciliationAgent",
          organizationId: input.organization_id,
          originalDrivers: input.original_drivers.length,
        },
      }
    );

    const parsed = secureResult.result;

    // Enrich final drivers with metadata
    const finalDrivers: ValueDriver[] = parsed.final_drivers.map((d: any) => {
      const original = input.original_drivers.find((od) => od.id === d.id);
      return {
        ...original,
        ...d,
        validated_by_agent: this.agentId,
        updated_at: new Date().toISOString(),
      };
    });

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Reconciled ${input.original_drivers.length} drivers → ${finalDrivers.length} final (${parsed.reconciliation_summary.drivers_accepted} accepted, ${parsed.reconciliation_summary.drivers_modified} modified, ${parsed.reconciliation_summary.drivers_rejected} rejected)`,
      {
        final_drivers: finalDrivers,
        reconciliation_summary: parsed.reconciliation_summary,
        audit_trail: parsed.audit_trail,
      },
      input.organization_id // SECURITY: Tenant isolation
    );

    return {
      final_drivers: finalDrivers,
      reconciliation_summary: parsed.reconciliation_summary,
      audit_trail: parsed.audit_trail,
      reasoning: parsed.reasoning,
    };
  }
}

// =====================================================
// ORCHESTRATOR: ADVERSARIAL REASONING WORKFLOW
// =====================================================

export interface AdversarialReasoningInput {
  organization_id: string;
  value_case_id: string;
  discovery_sources: ExtractionInput["discovery_sources"];
  context?: ExtractionInput["context"];
}

export interface AdversarialReasoningOutput {
  final_drivers: ValueDriver[];
  workflow_summary: {
    extraction_confidence: ConfidenceScore;
    challenge_assessment: "strong" | "moderate" | "weak";
    final_confidence: ConfidenceScore;
    drivers_extracted: number;
    drivers_final: number;
    processing_time_ms: number;
  };
  audit_trail: ReconciliationOutput["audit_trail"];
}

export class AdversarialReasoningOrchestrator {
  constructor(
    private extractionAgent: ValueDriverExtractionAgent,
    private challengeAgent: AdversarialChallengeAgent,
    private reconciliationAgent: ReconciliationAgent
  ) {}

  async execute(
    sessionId: string,
    input: AdversarialReasoningInput
  ): Promise<AdversarialReasoningOutput> {
    const startTime = Date.now();

    logger.info("Starting adversarial reasoning workflow", {
      sessionId,
      organizationId: input.organization_id,
      sourcesCount: input.discovery_sources.length,
    });

    // Phase 1: Extraction
    const extractionResult = await this.extractionAgent.execute(sessionId, {
      organization_id: input.organization_id,
      value_case_id: input.value_case_id,
      discovery_sources: input.discovery_sources,
      context: input.context,
    });

    logger.info("Extraction complete", {
      sessionId,
      driversExtracted: extractionResult.drivers.length,
      confidence: extractionResult.extraction_confidence,
    });

    // Phase 2: Challenge
    const challengeResult = await this.challengeAgent.execute(sessionId, {
      organization_id: input.organization_id,
      value_case_id: input.value_case_id,
      drivers: extractionResult.drivers,
      discovery_sources: input.discovery_sources,
    });

    logger.info("Challenge complete", {
      sessionId,
      validationsPerformed: challengeResult.validations.length,
      assessment: challengeResult.overall_assessment,
    });

    // Phase 3: Reconciliation
    const reconciliationResult = await this.reconciliationAgent.execute(
      sessionId,
      {
        organization_id: input.organization_id,
        value_case_id: input.value_case_id,
        original_drivers: extractionResult.drivers,
        extraction_reasoning: extractionResult.reasoning,
        validations: challengeResult.validations,
        challenge_reasoning: challengeResult.reasoning,
      }
    );

    logger.info("Reconciliation complete", {
      sessionId,
      finalDrivers: reconciliationResult.final_drivers.length,
      accepted: reconciliationResult.reconciliation_summary.drivers_accepted,
      modified: reconciliationResult.reconciliation_summary.drivers_modified,
      rejected: reconciliationResult.reconciliation_summary.drivers_rejected,
    });

    const processingTime = Date.now() - startTime;

    return {
      final_drivers: reconciliationResult.final_drivers,
      workflow_summary: {
        extraction_confidence: extractionResult.extraction_confidence,
        challenge_assessment: challengeResult.overall_assessment,
        final_confidence:
          reconciliationResult.reconciliation_summary.overall_confidence,
        drivers_extracted: extractionResult.drivers.length,
        drivers_final: reconciliationResult.final_drivers.length,
        processing_time_ms: processingTime,
      },
      audit_trail: reconciliationResult.audit_trail,
    };
  }
}
