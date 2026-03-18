/**
 * NarrativeAgent
 *
 * Sits in the NARRATIVE phase of the value lifecycle. Synthesises validated
 * integrity results, financial model outputs, and KPI targets into a
 * defensible executive narrative for the business case.
 *
 * Output includes a structured narrative draft, a defense readiness score,
 * and key talking points. Persists to narrative_drafts for frontend retrieval.
 */

import { z } from "zod";

import {
  buildEventEnvelope,
  getDomainEventBus,
} from "../../../events/DomainEventBus.js";
import { NarrativeDraftRepository } from "../../../repositories/NarrativeDraftRepository.js";
import {
  ArtifactEditService,
  ArtifactRepository,
} from "../../../services/artifacts/index.js";
import {
  CFORecommendationGenerator,
  CustomerNarrativeGenerator,
  ExecutiveMemoGenerator,
  InternalCaseGenerator,
  type ExecutiveMemoInput,
  type CFORecommendationInput,
  type CustomerNarrativeInput,
  type InternalCaseInput,
} from "../../../services/artifacts/index.js";
import type { AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { logger } from "../../logger.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";
import { escapePromptInterpolation } from "../promptUtils.js";

import { BaseAgent } from "./BaseAgent.js";

// ---------------------------------------------------------------------------
// Zod schema for LLM output
// ---------------------------------------------------------------------------

const NarrativeOutputSchema = z.object({
  executive_summary: z.string().min(1),
  value_proposition: z.string().min(1),
  key_proof_points: z.array(z.string()).min(1).max(10),
  risk_mitigations: z.array(z.string()),
  call_to_action: z.string(),
  defense_readiness_score: z.number().min(0).max(1),
  talking_points: z.array(
    z.object({
      audience: z.enum(["executive", "technical", "financial", "procurement"]),
      point: z.string(),
    })
  ),
  hallucination_check: z.boolean().optional(),
});

type NarrativeOutput = z.infer<typeof NarrativeOutputSchema>;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildNarrativePrompt(params: {
  organizationId: string;
  valueCaseId: string;
  claims: Array<Record<string, unknown>>;
  integrityScore: number;
  vetoDecision: string;
  kpis: Array<Record<string, unknown>>;
  financialSummary: string;
}): string {
  const claimLines = params.claims
    .map(
      c =>
        `- ${escapePromptInterpolation(c.claim_text)} (verdict: ${escapePromptInterpolation(c.verdict)}, confidence: ${escapePromptInterpolation(c.confidence)})`
    )
    .join("\n");

  const kpiLines = params.kpis
    .map(
      k =>
        `- ${escapePromptInterpolation(k.name)}: ${escapePromptInterpolation(k.target)} ${escapePromptInterpolation(k.unit)} (${escapePromptInterpolation(k.timeframe)})`
    )
    .join("\n");

  return `You are a senior value engineering consultant composing an executive business case narrative.

## Context
Organization: ${escapePromptInterpolation(params.organizationId)}
Value Case: ${escapePromptInterpolation(params.valueCaseId)}

## Validated Claims
${claimLines || "(none)"}

## Integrity Assessment
Overall Score: ${escapePromptInterpolation(params.integrityScore)}
Veto Decision: ${escapePromptInterpolation(params.vetoDecision)}

## KPI Targets
${kpiLines || "(none)"}

## Financial Summary
${escapePromptInterpolation(params.financialSummary)}

## Task
Compose a defensible executive narrative for this business case. The narrative must:
1. Open with a clear value proposition grounded in the validated claims
2. Present 3-7 concrete proof points with evidence references
3. Address the top risks with mitigations
4. Close with a clear call to action
5. Include audience-specific talking points for executive, technical, financial, and procurement stakeholders
6. Assign a defense_readiness_score (0-1) reflecting how well the case can withstand scrutiny

Return valid JSON matching the schema. Set hallucination_check to true only if all claims are grounded in the provided evidence.`;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class NarrativeAgent extends BaseAgent {
  public override readonly lifecycleStage = "narrative";
  public override readonly version = "2.0.0";
  public override readonly name = "narrative";

  private readonly narrativeRepo = new NarrativeDraftRepository();
  private readonly artifactRepo = new ArtifactRepository();

  // Artifact generators - initialized lazily
  private executiveMemoGenerator: ExecutiveMemoGenerator | null = null;
  private cfoRecommendationGenerator: CFORecommendationGenerator | null = null;
  private customerNarrativeGenerator: CustomerNarrativeGenerator | null = null;
  private internalCaseGenerator: InternalCaseGenerator | null = null;

  /**
   * Initialize artifact generators with required dependencies.
   */
  private getGenerators() {
    if (!this.executiveMemoGenerator) {
      this.executiveMemoGenerator = new ExecutiveMemoGenerator(
        this.llmGateway,
        this.circuitBreaker,
        this.memorySystem
      );
    }
    if (!this.cfoRecommendationGenerator) {
      this.cfoRecommendationGenerator = new CFORecommendationGenerator(
        this.llmGateway,
        this.circuitBreaker,
        this.memorySystem
      );
    }
    if (!this.customerNarrativeGenerator) {
      this.customerNarrativeGenerator = new CustomerNarrativeGenerator(
        this.llmGateway,
        this.circuitBreaker,
        this.memorySystem
      );
    }
    if (!this.internalCaseGenerator) {
      this.internalCaseGenerator = new InternalCaseGenerator(
        this.llmGateway,
        this.circuitBreaker,
        this.memorySystem
      );
    }

    return {
      executiveMemo: this.executiveMemoGenerator,
      cfoRecommendation: this.cfoRecommendationGenerator,
      customerNarrative: this.customerNarrativeGenerator,
      internalCase: this.internalCaseGenerator,
    };
  }

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();

    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error("Invalid input context");
    }

    const valueCaseId = context.user_inputs?.value_case_id as
      | string
      | undefined;
    const format =
      (context.user_inputs?.format as string | undefined) ??
      "executive_summary";

    // Get readiness score and blockers from context or use defense readiness
    const readinessScore =
      (context.user_inputs?.readiness_score as number | undefined) ??
      (context.previous_stage_outputs?.integrity as Record<string, unknown>)?.scores?.overall ??
      0;
    const readinessBlockers =
      (context.user_inputs?.readiness_blockers as string[] | undefined) ??
      [];

    // Determine artifact status based on readiness
    const artifactStatus: "draft" | "final" = readinessScore < 0.8 ? "draft" : "final";

    // Step 1: Retrieve integrity results and KPI targets from prior stage outputs
    const integrityData = context.previous_stage_outputs?.integrity as
      | Record<string, unknown>
      | undefined;
    const targetData = context.previous_stage_outputs?.target as
      | Record<string, unknown>
      | undefined;
    const financialData = context.previous_stage_outputs?.modeling as
      | Record<string, unknown>
      | undefined;

    const claims =
      (integrityData?.claim_validations as
        | Array<Record<string, unknown>>
        | undefined) ?? [];
    const integrityScore =
      (integrityData?.scores as Record<string, number> | undefined)?.overall ??
      0;
    const vetoDecision = (
      integrityData?.veto_decision as Record<string, unknown> | undefined
    )?.veto
      ? "VETOED"
      : "PASSED";
    const kpis =
      (targetData?.kpi_targets as Array<Record<string, unknown>> | undefined) ??
      [];
    const financialSummary =
      (financialData?.summary as string | undefined) ??
      "No financial model available.";

    // Step 2: Build narrative prompt and generate legacy narrative output
    const prompt = buildNarrativePrompt({
      organizationId: context.organization_id,
      valueCaseId: valueCaseId ?? "unknown",
      claims,
      integrityScore,
      vetoDecision,
      kpis,
      financialSummary,
    });

    let narrativeOutput: NarrativeOutput;
    try {
      narrativeOutput = await this.secureInvoke<NarrativeOutput>(
        context.workspace_id,
        prompt,
        NarrativeOutputSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.6, high: 0.85 },
          userId: context.user_id,
          context: {
            agent: "NarrativeAgent",
            organization_id: context.organization_id,
            value_case_id: valueCaseId,
          },
        }
      );
    } catch (err) {
      logger.error("NarrativeAgent: LLM invocation failed", {
        error: (err as Error).message,
      });
      return this.buildOutput(
        {
          error: "Narrative generation failed. Retry or provide more context.",
        },
        "failure",
        "low",
        startTime
      );
    }

    // Step 3: Generate full artifact suite using the new generators
    const generators = this.getGenerators();
    const generatedArtifacts: Array<{
      type: string;
      id: string;
      status: "draft" | "final";
      hallucinationCheck: boolean;
    }> = [];

    if (valueCaseId && context.organization_id) {
      try {
        // Build common input data
        const organizationName =
          (context.user_inputs?.organization_name as string) ??
          context.organization_id;
        const industry = context.user_inputs?.industry as string | undefined;

        // Generate Executive Memo
        const memoInput: ExecutiveMemoInput = {
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          valueCaseTitle: (context.user_inputs?.value_case_title as string) ?? valueCaseId,
          organizationName,
          industry,
          readinessScore,
          blockers: readinessBlockers,
          valueHypothesis: narrativeOutput.value_proposition,
          drivers: claims.map((c) => ({
            name: String(c.claim_text ?? "Unknown"),
            impactRange: { low: 0, high: 0 },
            unit: "USD",
            confidence: Number(c.confidence ?? 0.5),
            provenance: {
              source: String(c.verdict ?? "unknown"),
              claimId: String(c.claim_id ?? c.id ?? "unknown"),
            },
          })),
          integrityScore,
          vetoed: vetoDecision === "VETOED",
          financials: undefined,
          assumptions: [],
        };

        const memoResult = await generators.executiveMemo.generate(memoInput);

        // Persist executive memo artifact
        const memoRecord = await this.artifactRepo.create({
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          artifactType: "executive_memo",
          contentJson: memoResult.output as Record<string, unknown>,
          status: artifactStatus,
          readinessScoreAtGeneration: readinessScore,
          generatedByAgent: "NarrativeAgent",
          provenanceRefs: memoResult.output.provenance_refs,
        });

        generatedArtifacts.push({
          type: "executive_memo",
          id: memoRecord.id,
          status: artifactStatus,
          hallucinationCheck: memoResult.hallucinationCheck,
        });

        // Generate CFO Recommendation
        const cfoInput: CFORecommendationInput = {
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          valueCaseTitle: (context.user_inputs?.value_case_title as string) ?? valueCaseId,
          organizationName,
          industry,
          readinessScore,
          scenarios: [
            {
              name: "Base",
              probability: 60,
              roi: 150,
              npv: 500000,
              currency: "USD",
              paybackMonths: 12,
              claimId: "scenario-base",
            },
          ],
          assumptions: [],
          sensitivities: [],
          benchmarks: [],
        };

        const cfoResult = await generators.cfoRecommendation.generate(cfoInput);

        const cfoRecord = await this.artifactRepo.create({
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          artifactType: "cfo_recommendation",
          contentJson: cfoResult.output as Record<string, unknown>,
          status: artifactStatus,
          readinessScoreAtGeneration: readinessScore,
          generatedByAgent: "NarrativeAgent",
          provenanceRefs: cfoResult.output.provenance_refs,
        });

        generatedArtifacts.push({
          type: "cfo_recommendation",
          id: cfoRecord.id,
          status: artifactStatus,
          hallucinationCheck: cfoResult.hallucinationCheck,
        });

        // Generate Customer Narrative
        const customerInput: CustomerNarrativeInput = {
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          valueCaseTitle: (context.user_inputs?.value_case_title as string) ?? valueCaseId,
          organizationName,
          industry,
          readinessScore,
          buyer: undefined,
          industryContext: undefined,
          drivers: [],
          benchmarks: [],
          proofPoints: narrativeOutput.key_proof_points.map((p, i) => ({
            headline: `Proof Point ${i + 1}`,
            description: p,
            evidence: "From integrity validation",
            confidence: 0.8,
          })),
        };

        const customerResult = await generators.customerNarrative.generate(customerInput);

        const customerRecord = await this.artifactRepo.create({
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          artifactType: "customer_narrative",
          contentJson: customerResult.output as Record<string, unknown>,
          status: artifactStatus,
          readinessScoreAtGeneration: readinessScore,
          generatedByAgent: "NarrativeAgent",
          provenanceRefs: customerResult.output.provenance_refs,
        });

        generatedArtifacts.push({
          type: "customer_narrative",
          id: customerRecord.id,
          status: artifactStatus,
          hallucinationCheck: customerResult.hallucinationCheck,
        });

        // Generate Internal Case
        const internalInput: InternalCaseInput = {
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          valueCaseTitle: (context.user_inputs?.value_case_title as string) ?? valueCaseId,
          organizationName,
          industry,
          size: undefined,
          readinessScore,
          deal: {
            stage: "narrative",
          },
          valueModel: {
            totalValue: { low: 0, high: 0, unit: "USD" },
            vpRatio: "N/A",
            drivers: [],
          },
          risks: [
            {
              category: "Integrity",
              description: vetoDecision === "VETOED" ? "Case vetoed in integrity check" : "Passed integrity",
              likelihood: vetoDecision === "VETOED" ? "high" : "low",
              impact: "Significant",
              mitigation: "Review integrity findings",
            },
          ],
          assumptions: [],
          integrity: {
            score: integrityScore,
            vetoed: vetoDecision === "VETOED",
            criticalIssues: readinessBlockers,
          },
        };

        const internalResult = await generators.internalCase.generate(internalInput);

        const internalRecord = await this.artifactRepo.create({
          tenantId: context.organization_id,
          organizationId: context.organization_id,
          caseId: valueCaseId,
          artifactType: "internal_case",
          contentJson: internalResult.output as Record<string, unknown>,
          status: artifactStatus,
          readinessScoreAtGeneration: readinessScore,
          generatedByAgent: "NarrativeAgent",
          provenanceRefs: internalResult.output.provenance_refs,
        });

        generatedArtifacts.push({
          type: "internal_case",
          id: internalRecord.id,
          status: artifactStatus,
          hallucinationCheck: internalResult.hallucinationCheck,
        });

        logger.info("NarrativeAgent: Generated full artifact suite", {
          caseId: valueCaseId,
          artifactCount: generatedArtifacts.length,
          artifactStatus,
          readinessScore,
        });
      } catch (err) {
        logger.error("NarrativeAgent: Failed to generate artifact suite", {
          error: (err as Error).message,
          caseId: valueCaseId,
        });
        // Continue with legacy narrative output even if artifact generation fails
      }
    }

    // Step 4: Store in memory for downstream agents
    await this.memorySystem.storeSemanticMemory(
      context.workspace_id,
      this.name,
      "episodic",
      JSON.stringify({
        executive_summary: narrativeOutput.executive_summary,
        defense_readiness_score: narrativeOutput.defense_readiness_score,
        generated_artifacts: generatedArtifacts.map((a) => ({
          type: a.type,
          id: a.id,
          status: a.status,
        })),
        readiness_score: readinessScore,
        artifact_status: artifactStatus,
      }),
      {
        organization_id: context.organization_id,
        value_case_id: valueCaseId,
        lifecycle_stage: this.lifecycleStage,
        agent: this.name,
        readiness_score: readinessScore,
      },
      this.organizationId
    );

    // Step 5: Persist legacy narrative draft
    if (valueCaseId && context.organization_id) {
      try {
        const fullContent = [
          narrativeOutput.executive_summary,
          "",
          "## Value Proposition",
          narrativeOutput.value_proposition,
          "",
          "## Key Proof Points",
          ...narrativeOutput.key_proof_points.map((p) => `- ${p}`),
          "",
          "## Risk Mitigations",
          ...narrativeOutput.risk_mitigations.map((r) => `- ${r}`),
          "",
          "## Call to Action",
          narrativeOutput.call_to_action,
          "",
          readinessScore < 0.8 ? `## Draft Status Warning\n\nThis narrative is marked as DRAFT because the readiness score (${(readinessScore * 100).toFixed(0)}%) is below the 80% threshold.` : "",
          readinessBlockers.length > 0 ? `\n### Readiness Blockers\n${readinessBlockers.map((b) => `- ${b}`).join("\n")}` : "",
          generatedArtifacts.length > 0 ? `\n### Generated Artifacts\n${generatedArtifacts.map((a) => `- ${a.type}: ${a.id} (${a.status})`).join("\n")}` : "",
        ].join("\n");

        await this.narrativeRepo.createDraft(
          valueCaseId,
          context.organization_id,
          {
            session_id: context.workspace_id,
            content: fullContent,
            format: format as
              | "executive_summary"
              | "technical"
              | "board_deck"
              | "customer_facing",
            defense_readiness_score: narrativeOutput.defense_readiness_score,
            hallucination_check: narrativeOutput.hallucination_check ?? false,
          }
        );
      } catch (err) {
        logger.error("NarrativeAgent: failed to persist draft", {
          error: (err as Error).message,
        });
      }
    }

    // Step 6: Publish domain event with artifact info
    try {
      const traceId =
        (context.metadata?.trace_id as string | undefined) ??
        context.workspace_id;
      await getDomainEventBus().publish("narrative.drafted", {
        ...buildEventEnvelope({
          traceId,
          tenantId: context.organization_id,
          actorId: context.user_id,
        }),
        valueCaseId,
        defenseReadinessScore: narrativeOutput.defense_readiness_score,
        readinessScore,
        artifactStatus,
        generatedArtifacts: generatedArtifacts.map((a) => ({
          type: a.type,
          id: a.id,
          status: a.status,
          hallucinationCheck: a.hallucinationCheck,
        })),
        format,
      });
    } catch (err) {
      logger.warn("NarrativeAgent: failed to publish domain event", {
        error: (err as Error).message,
      });
    }

    const result = {
      executive_summary: narrativeOutput.executive_summary,
      value_proposition: narrativeOutput.value_proposition,
      key_proof_points: narrativeOutput.key_proof_points,
      risk_mitigations: narrativeOutput.risk_mitigations,
      call_to_action: narrativeOutput.call_to_action,
      defense_readiness_score: narrativeOutput.defense_readiness_score,
      readiness_score: readinessScore,
      artifact_status: artifactStatus,
      generated_artifacts: generatedArtifacts.map((a) => ({
        type: a.type,
        id: a.id,
        status: a.status,
        hallucination_check: a.hallucinationCheck,
      })),
      talking_points: narrativeOutput.talking_points,
      format,
    };

    const defenseScore = narrativeOutput.defense_readiness_score;
    const confidence =
      defenseScore >= 0.8 ? "high" : defenseScore >= 0.6 ? "medium" : "low";

    return this.buildOutput(result, "success", confidence, startTime, {
      reasoning:
        `Composed ${format} narrative with defense readiness score ${(defenseScore * 100).toFixed(0)}% ` +
        `and readiness score ${(readinessScore * 100).toFixed(0)}%. ` +
        `Generated ${generatedArtifacts.length} artifacts (${artifactStatus}). ` +
        `${narrativeOutput.key_proof_points.length} proof points, ${narrativeOutput.risk_mitigations.length} risk mitigations.`,
      suggested_next_actions: [
        "Review narrative with stakeholders",
        "Review generated executive artifacts",
        readinessScore < 0.8 ? "Address readiness blockers to move from draft to final" : "Export business case as PDF",
        "Proceed to RealizationAgent for implementation planning",
      ],
    });
  }
}
