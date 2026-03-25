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
import {
  valueGraphService as defaultValueGraphService,
} from "../../../services/value-graph/index.js";
import type { ValuePath } from "../../../services/value-graph/ValueGraphService.js";
import type { AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { logger } from "../../logger.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";
import { getPdfExportService } from "../../../services/export/PdfExportService.js";
import {
  calculateNPV,
  calculateIRR,
  calculateROI,
  calculatePayback,
} from "../../../domain/economic-kernel/economic_kernel.js";
import Decimal from "decimal.js";

import { BaseAgent } from "./BaseAgent.js";
import { BaseGraphWriter } from "../BaseGraphWriter.js";

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

function escapePromptInterpolation(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text).replace(/([${}`])/g, "\\$1");
}

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
  private graphWriter = new BaseGraphWriter(this.valueGraphService ?? defaultValueGraphService);

  // Artifact generators - initialized lazily
  private executiveMemoGenerator: ExecutiveMemoGenerator | null = null;
  private cfoRecommendationGenerator: CFORecommendationGenerator | null = null;
  private customerNarrativeGenerator: CustomerNarrativeGenerator | null = null;
  private internalCaseGenerator: InternalCaseGenerator | null = null;

  /**
   * Generate PDF export for narrative artifacts.
   * Combines all generated artifacts into a single PDF document.
   */
  async generatePdf(params: {
    organizationId: string;
    caseId: string;
    artifacts: Array<{ type: string; content: Record<string, unknown> }>;
    title?: string;
  }): Promise<{ signedUrl: string; storagePath: string }> {
    const { organizationId, caseId, artifacts, title } = params;

    // Build render URL for PDF generation
    const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const renderUrl = `${baseUrl}/org/${organizationId}/workspace/${caseId}/outputs?pdf=true`;

    // Get PDF export service
    const pdfService = getPdfExportService();

    const result = await pdfService.exportValueCase({
      organizationId,
      caseId,
      renderUrl,
      title: title ?? `Business Case - ${caseId}`,
    });

    logger.info("NarrativeAgent: PDF generated", {
      caseId,
      signedUrl: result.signedUrl.substring(0, 50) + "...",
      sizeBytes: result.sizeBytes,
    });

    return {
      signedUrl: result.signedUrl,
      storagePath: result.storagePath,
    };
  }

  /**
   * Extract financial metrics from modeling data using Economic Kernel.
   */
  private calculateFinancialMetrics(financialData: Record<string, unknown> | undefined): {
    npv: number;
    irr: number;
    roi: number;
    paybackMonths: number;
    scenarios: Array<{
      name: string;
      probability: number;
      roi: number;
      npv: number;
      currency: string;
      paybackMonths: number;
    }>;
  } {
    if (!financialData) {
      return {
        npv: 0,
        irr: 0,
        roi: 0,
        paybackMonths: 0,
        scenarios: [],
      };
    }

    // Extract cash flows from financial data
    const cashFlows = (financialData.cash_flows as number[]) ?? [];
    const discountRate = new Decimal(financialData.discount_rate as number ?? 0.1);

    let npv = 0;
    let irr = 0;
    let roi = 0;
    let paybackMonths = 0;

    if (cashFlows.length > 0) {
      try {
        // Convert to Decimal array for Economic Kernel
        const decimalFlows = cashFlows.map(cf => new Decimal(cf));

        npv = calculateNPV(decimalFlows, discountRate).toNumber();
        irr = calculateIRR(decimalFlows).rate.toNumber();
        roi = calculateROI(decimalFlows[1] ?? new Decimal(0), decimalFlows[0]?.abs() ?? new Decimal(1)).toNumber();
        const payback = calculatePayback(decimalFlows);
        paybackMonths = payback.period !== null ? payback.period * 12 : 0;
      } catch (err) {
        logger.warn("NarrativeAgent: Financial calculation failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Build scenarios from sensitivity data if available
    const sensitivities = (financialData.sensitivities as Array<Record<string, unknown>>) ?? [];
    const scenarios = sensitivities.length > 0
      ? sensitivities.map((sens, index) => ({
          name: (sens.name as string) || ["Conservative", "Base", "Upside"][index] || "Scenario",
          probability: (sens.probability as number) || [30, 60, 10][index] || 33,
          roi: (sens.roi as number) || roi,
          npv: (sens.npv as number) || npv,
          currency: (sens.currency as string) || "USD",
          paybackMonths: (sens.payback_months as number) || paybackMonths,
        }))
      : [
          {
            name: "Conservative",
            probability: 25,
            roi: Math.round(roi * 0.7),
            npv: Math.round(npv * 0.6),
            currency: "USD",
            paybackMonths: Math.round(paybackMonths * 1.4),
          },
          {
            name: "Base",
            probability: 60,
            roi: Math.round(roi),
            npv: Math.round(npv),
            currency: "USD",
            paybackMonths: Math.round(paybackMonths),
          },
          {
            name: "Upside",
            probability: 15,
            roi: Math.round(roi * 1.3),
            npv: Math.round(npv * 1.4),
            currency: "USD",
            paybackMonths: Math.round(paybackMonths * 0.8),
          },
        ];

    return {
      npv,
      irr,
      roi,
      paybackMonths,
      scenarios,
    };
  }

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
      ((context.previous_stage_outputs?.integrity as Record<string, unknown> | undefined)?.scores as Record<string, number> | undefined)?.overall ??
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

    // Step 2: Build narrative prompt — enrich with top-3 Value Graph paths (fire-and-forget read)
    const graphPathContext = await this.enrichPromptWithGraphPaths(context);
    const prompt = buildNarrativePrompt({
      organizationId: context.organization_id,
      valueCaseId: valueCaseId ?? "unknown",
      claims,
      integrityScore,
      vetoDecision,
      kpis,
      financialSummary: graphPathContext
        ? `${financialSummary}\n\n## Value Graph Paths\n${graphPathContext}`
        : financialSummary,
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

    // Step 2b: Write narrative_explains_hypothesis edges to Value Graph (fire-and-forget)
    await this.writeNarrativeEdges(narrativeOutput, context);

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
              claimId: String(c.claim_id ?? c["id"] ?? "unknown"),
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

    // Step 3b: Write Value Graph nodes — VgValueDriver + metric_maps_to_value_driver edges
    try {
      const { opportunityId } = this.graphWriter.getSafeContext(context);
      const writes: Array<() => Promise<unknown>> = [];

      for (const kpi of kpis) {
        const driverName = String(kpi.name ?? kpi.kpi_name ?? "Value Driver");
        const driverId = this.graphWriter.generateNodeId(kpi.id as string | undefined);
        writes.push(() =>
          this.graphWriter.writeValueDriver(context, {
            type: "revenue",
            name: driverName,
            description: String(kpi.description ?? narrativeOutput.value_proposition),
          })
        );

        const metricId = this.graphWriter.generateNodeId(kpi.metric_id as string | undefined);
        writes.push(() =>
          this.graphWriter.writeEdge(context, {
            from_entity_id: metricId,
            from_entity_type: "vg_metric",
            to_entity_id: driverId,
            to_entity_type: "vg_value_driver",
            edge_type: "metric_maps_to_value_driver",
            created_by_agent: "NarrativeAgent",
          })
        );
      }

      if (writes.length > 0) {
        const { succeeded, failed } = await this.graphWriter.safeWriteBatch(writes);
        logger.info("NarrativeAgent: graph write complete", {
          succeeded,
          failed,
          opportunity_id: opportunityId,
        });
      }
    } catch (err) {
      // LifecycleContextError (missing opportunity_id) is logged but does not
      // fail the agent — graph writes are best-effort for Sprint 49.
      logger.warn("NarrativeAgent: graph write skipped", {
        reason: (err as Error).message,
      });
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

  // -------------------------------------------------------------------------
  // Value Graph reads + writes
  // -------------------------------------------------------------------------

  /**
   * Reads top-3 value paths from the graph and formats them as structured
   * text for prompt injection. Returns empty string on any failure so the
   * prompt proceeds without graph context.
   */
  private async enrichPromptWithGraphPaths(context: LifecycleContext): Promise<string> {
    let opportunityId: string | undefined;
    try {
      opportunityId = this.graphWriter.getSafeContext(context).opportunityId;
    } catch {
      return "";
    }
    if (!opportunityId) return "";

    try {
      const vgs = this.valueGraphService ?? defaultValueGraphService;
      const paths: ValuePath[] = await vgs.getValuePaths(opportunityId, context.organization_id);
      if (paths.length === 0) return "";

      const top3 = paths.slice(0, 3);
      return top3.map((p, i) => {
        const capNames = p.capabilities.map(c => c.name).join(", ");
        const metricNames = p.metrics.map(m => m.name).join(", ");
        return `Path ${i + 1}: ${capNames} → ${metricNames} → ${p.value_driver.name} (confidence: ${(p.path_confidence * 100).toFixed(0)}%)`;
      }).join("\n");
    } catch (err) {
      logger.warn("NarrativeAgent: graph path read failed — proceeding without graph context", {
        error: (err as Error).message,
        opportunityId,
        organizationId: context.organization_id,
      });
      return "";
    }
  }

  /**
   * Writes one narrative_explains_hypothesis edge per hypothesis referenced
   * in the narrative output. All writes are fire-and-forget via safeWrite.
   */
  private async writeNarrativeEdges(
    narrativeOutput: NarrativeOutput,
    context: LifecycleContext,
  ): Promise<void> {
    let opportunityId: string | undefined;
    let organizationId: string | undefined;
    try {
      const safeCtxResult = this.graphWriter.getSafeContext(context);
      opportunityId = safeCtxResult.opportunityId;
      organizationId = safeCtxResult.organizationId;
    } catch {
      return;
    }
    if (!opportunityId || !organizationId) return;

    const safeCtx = { opportunityId, organizationId, agentName: "NarrativeAgent" };
    const vgs = this.valueGraphService ?? defaultValueGraphService;

    // One edge per proof point — each represents a narrative claim about a hypothesis
    const writes: Array<() => Promise<unknown>> = [];
    for (const _proofPoint of narrativeOutput.key_proof_points) {
      writes.push(() =>
        this.graphWriter.writeEdge(context, {
          from_entity_type: "narrative",
          from_entity_id: this.graphWriter.generateNodeId(),
          to_entity_type: "value_hypothesis",
          to_entity_id: this.graphWriter.generateNodeId(),
          edge_type: "narrative_explains_hypothesis",
          confidence_score: narrativeOutput.defense_readiness_score,
          created_by_agent: "NarrativeAgent",
        })
      );
    }

    if (writes.length > 0) {
      await this.graphWriter.safeWriteBatch(writes);
    }
  }
}
