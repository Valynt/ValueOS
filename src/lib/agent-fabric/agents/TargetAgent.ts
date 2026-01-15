/**
 * Target Agent
 *
 * VOS Lifecycle Stage: TARGET
 *
 * Creates business cases with value trees, ROI models, and value commitments.
 *
 * Responsibilities:
 * - Build hierarchical Value Trees from capabilities to outcomes
 * - Create ROI calculation models with formulas
 * - Generate Value Commits with specific KPI targets
 * - Link capabilities to financial outcomes
 * - Set baseline and target values with confidence levels
 * - Create assumptions with provenance tracking
 */

import { BaseAgent } from "./BaseAgent";
import { ModelService } from "../../../services/ModelService";
import {
  getCausalTruthService,
  CausalTruthService,
} from "../../../services/CausalTruthService";
import {
  getAdvancedCausalEngine,
  AdvancedCausalEngine,
} from "../../../services/reasoning/AdvancedCausalEngine";
import { z } from "zod";
import { logger } from "../../../lib/logger";
import { DEFAULT_AGENT_FABRIC_CONFIG } from "../../../config/agentFabric";
import type {
  ROIModel,
  TargetAgentInput,
  TargetAgentOutput,
  ValueCommit,
  ValueTree,
  ConfidenceLevel,
} from "../../../types/vos";

import { AgentConfig } from "../../../types/agent";

export class TargetAgent extends BaseAgent {
  private causalTruthService: CausalTruthService;
  private advancedCausalEngine: AdvancedCausalEngine;

  public lifecycleStage = "target";
  public version = "1.0";
  public name = "Target Agent";

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error("Supabase client is required for TargetAgent");
    }
    this.causalTruthService = getCausalTruthService();
    this.advancedCausalEngine = getAdvancedCausalEngine();

    // Initialize causal truth service if not already done
    if (!this.causalTruthService) {
      throw new Error("CausalTruthService initialization failed");
    }
  }

  async execute(
    sessionId: string,
    input: TargetAgentInput
  ): Promise<TargetAgentOutput> {
    const startTime = Date.now();

    const objectivesText = JSON.stringify(input.businessObjectives, null, 2);
    const capabilitiesText = JSON.stringify(input.capabilities, null, 2);

    const prompt = `You are a value engineering expert creating a comprehensive business case with ROI modeling.

BUSINESS OBJECTIVES:
${objectivesText}

CAPABILITIES (Solution Features):
${capabilitiesText}

Your task is to create:
1. **Value Tree**: A hierarchical structure showing how capabilities drive outcomes which impact KPIs which generate financial value
2. **ROI Model**: Formula-based calculations showing financial impact
3. **Value Commit**: Specific, measurable commitments at point of sale

Provenance requirements:
- Every ROI calculation must list input_variables with name, source, and description
- Provide source_references mapping each variable back to a KPI, capability, or assumption
- Include a reasoning_trace (80+ chars) describing the logic/provenance of each calculation
- Return a business_case_summary plus a confidence_level for the overall chain

Return ONLY valid JSON in this exact format:
{
  "value_tree": {
    "name": "<descriptive name>",
    "description": "<what this value tree represents>",
    "nodes": [
      {
        "node_id": "cap_1",
        "label": "<Capability name>",
        "type": "capability",
        "reference_id": "<capability_id from input>"
      },
      {
        "node_id": "outcome_1",
        "label": "<Outcome description>",
        "type": "outcome"
      },
      {
        "node_id": "kpi_1",
        "label": "<KPI name>",
        "type": "kpi"
      },
      {
        "node_id": "financial_1",
        "label": "<Financial metric>",
        "type": "financialMetric"
      }
    ],
    "links": [
      {
        "parent_node_id": "cap_1",
        "child_node_id": "outcome_1",
        "weight": 1.0
      }
    ]
  },
  "roi_model": {
    "name": "<ROI Model Name>",
    "assumptions": [
      "<assumption 1 with source>",
      "<assumption 2 with source>"
    ],
    "calculations": [
      {
        "name": "annual_time_savings_hours",
        "formula": "employees * hours_per_week * 52 * efficiency_gain",
        "description": "Total hours saved per year",
        "calculation_order": 1,
        "result_type": "intermediate",
        "unit": "hours",
        "input_variables": [
          { "name": "employees", "source": "discovery:headcount", "description": "Number of impacted employees" },
          { "name": "hours_per_week", "source": "benchmark:industry_hours", "description": "Average hours per week" },
          { "name": "efficiency_gain", "source": "capability:automation", "description": "Expected efficiency delta" }
        ],
        "source_references": { "employees": "kpi:headcount", "efficiency_gain": "capability:automation" },
        "reasoning_trace": "Explain how each variable influences the impact and cite its source"
      },
      {
        "name": "annual_cost_savings",
        "formula": "annual_time_savings_hours * hourly_rate",
        "description": "Cost savings from time reduction",
        "calculation_order": 2,
        "result_type": "cost",
        "unit": "USD",
        "input_variables": [
          { "name": "hourly_rate", "source": "finance:blended_rate", "description": "Fully loaded rate" }
        ],
        "source_references": { "hourly_rate": "benchmark:finance" },
        "reasoning_trace": "Show why the financial rate is conservative and sourced"
      },
      {
        "name": "total_roi",
        "formula": "((annual_cost_savings * 3) - total_investment) / total_investment * 100",
        "description": "3-year ROI percentage",
        "calculation_order": 3,
        "result_type": "intermediate",
        "unit": "percent",
        "input_variables": [
          { "name": "total_investment", "source": "sales:pricing", "description": "Implementation and subscription" }
        ],
        "source_references": { "total_investment": "order_form:pricing" },
        "reasoning_trace": "Connect ROI back to upstream calculations and assumptions"
      }
    ],
    "confidence_level": "medium"
  },
  "kpi_targets": [
    {
      "kpi_name": "<KPI name>",
      "baseline_value": 100,
      "target_value": 150,
      "unit": "<unit>",
      "deadline": "2025-12-31",
      "confidence_level": "high"
    }
  ],
  "value_commit": {
    "notes": "<commitment statement>",
    "target_date": "2025-12-31"
  },
  "business_case_summary": "<executive summary of the business case>",
  "confidence_level": "<high|medium|low>",
  "reasoning": "<your methodology and key decisions>"
}`;

    // SECURITY FIX: Use secureInvoke() for hallucination detection and circuit breaker
    const targetSchema = z.object({
      target_metrics: z.array(z.any()),
      financial_model: z.any(),
      success_criteria: z.array(z.any()),
      assumptions: z.array(z.any()),
      confidence_level: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional(),
    });

    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      targetSchema,
      {
        trackPrediction: true,
        confidenceThresholds: {
          minimum: 0.6,
          acceptable: 0.85,
          review_required: 0.7,
        },
        context: {
          agent: "TargetAgent",
        },
      }
    );

    const parsed = secureResult.result;
    const response = {
      content: JSON.stringify(parsed),
      tokens_used: 0,
      model: "gpt-4",
    };

    const valueTree: Omit<ValueTree, "id" | "created_at" | "updated_at"> = {
      value_case_id: input.valueCaseId,
      use_case_id: undefined,
      name: parsed.value_tree.name,
      description: parsed.value_tree.description,
      version: 1,
      is_published: false,
    };

    const roiModel: Omit<
      ROIModel,
      "id" | "value_tree_id" | "created_at" | "updated_at"
    > = {
      organization_id: this.organizationId || "",
      financial_model_id: undefined,
      name: parsed.roi_model.name,
      assumptions: await this.groundROIAssumptions(
        parsed.roi_model.assumptions,
        input.capabilities
      ),
      version: "1.0",
      confidence_level: await this.validateROIConfidence(
        parsed.roi_model.confidence_level as ConfidenceLevel,
        input.capabilities
      ),
    };

    const valueCommit: Omit<
      ValueCommit,
      "id" | "value_tree_id" | "created_at"
    > = {
      value_case_id: input.valueCaseId,
      committed_by: undefined,
      committed_by_name: undefined,
      status: "active",
      date_committed: new Date().toISOString(),
      target_date: parsed.value_commit.target_date,
      notes: parsed.value_commit.notes,
      metadata: {},
    };

    const durationMs = Date.now() - startTime;

    await this.logMetric(
      sessionId,
      "tokens_used",
      response.tokens_used,
      "tokens"
    );
    await this.logMetric(sessionId, "latency_ms", durationMs, "ms");
    await this.logMetric(
      sessionId,
      "value_tree_nodes",
      parsed.value_tree.nodes.length,
      "count"
    );
    await this.logMetric(
      sessionId,
      "kpi_targets",
      parsed.kpi_targets.length,
      "count"
    );
    await this.logPerformanceMetric(sessionId, "target_execute", durationMs, {
      nodes: parsed.value_tree.nodes.length,
      kpi_targets: parsed.kpi_targets.length,
    });

    await this.logExecution(
      sessionId,
      "target_business_case_creation",
      input,
      {
        value_tree_nodes: parsed.value_tree.nodes.length,
        roi_calculations: parsed.roi_model.calculations.length,
        kpi_targets: parsed.kpi_targets.length,
      },
      parsed.reasoning,
      parsed.confidence_level,
      [
        {
          type: "value_tree_generation",
          model: response.model,
          tokens: response.tokens_used,
        },
      ]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Business Case: ${parsed.business_case_summary}`,
      {
        value_tree: valueTree,
        roi_model: roiModel,
        kpi_targets: parsed.kpi_targets,
      },
      this.organizationId // SECURITY: Tenant isolation
    );

    return {
      valueTree: valueTree as ValueTree,
      roiModel: roiModel as ROIModel,
      valueCommit: valueCommit as ValueCommit,
      kpiTargets: parsed.kpi_targets,
      businessCase: {
        summary: parsed.business_case_summary,
        nodes: parsed.value_tree.nodes,
        links: parsed.value_tree.links,
        calculations: parsed.roi_model.calculations,
        kpi_targets: parsed.kpi_targets,
        reasoning: parsed.reasoning,
        confidence_level: parsed.confidence_level,
      },
    };
  }

  /**
   * Persist complete Target artifacts to database using the ModelService.
   */
  async persistTargetArtifacts(
    output: TargetAgentOutput,
    valueCaseId: string,
    sessionId?: string
  ): Promise<{
    valueTreeId: string;
    roiModelId: string;
    valueCommitId: string;
  }> {
    if (!this.organizationId || !this.userId) {
      throw new Error(
        "Agent is missing required user and organization context."
      );
    }

    const context = {
      userId: this.userId,
      organizationId: this.organizationId,
      sessionId: sessionId,
    };

    const modelService = new ModelService(context);

    // Note: The provenance logging logic that was here previously should be
    // moved into the ModelService as well, ideally into an AuditService that
    // the ModelService would use. For this refactoring step, we are focusing
    // on moving the core persistence logic.

    return modelService.persistBusinessCase(output, valueCaseId);
  }

  // ============================================================================
  // ROI Grounding Methods
  // ============================================================================

  /**
   * Ground ROI assumptions in causal evidence
   */
  private async groundROIAssumptions(
    assumptions: any[],
    capabilities: any[]
  ): Promise<any[]> {
    const groundedAssumptions = [];

    for (const assumption of assumptions) {
      try {
        // Find causal evidence for this assumption
        const causalEvidence = await this.findCausalEvidenceForAssumption(
          assumption,
          capabilities
        );

        // Calculate risk-adjusted assumption
        const riskAdjusted = await this.calculateRiskAdjustedAssumption(
          assumption,
          causalEvidence
        );

        // Add provenance tracking
        const groundedAssumption = {
          ...assumption,
          causalEvidence: causalEvidence.map((evidence) => ({
            action: evidence.action,
            targetKpi: evidence.targetKpi,
            confidence: evidence.confidence,
            evidenceSources: evidence.evidence.map(
              (src: any) => src.source_name
            ),
            methodology: evidence.methodology,
          })),
          riskAdjustment: riskAdjusted,
          provenance: {
            originalAssumption: assumption,
            groundedAt: Date.now(),
            evidenceCount: causalEvidence.length,
            confidenceAdjustment: riskAdjusted.confidenceAdjustment,
          },
        };

        groundedAssumptions.push(groundedAssumption);
      } catch (error) {
        logger.warn("Failed to ground ROI assumption", {
          assumption: assumption.description || assumption.name,
          error: error instanceof Error ? error.message : String(error),
        });

        // Keep original assumption if grounding fails
        groundedAssumptions.push(assumption);
      }
    }

    return groundedAssumptions;
  }

  /**
   * Validate ROI confidence against causal evidence
   */
  private async validateROIConfidence(
    originalConfidence: ConfidenceLevel,
    capabilities: any[]
  ): Promise<ConfidenceLevel> {
    try {
      // Get causal evidence for all capabilities
      const allEvidence = [];

      for (const capability of capabilities) {
        const evidence = this.causalTruthService.search({
          action: capability.name,
          minConfidence: 0.6,
        });
        allEvidence.push(...evidence);
      }

      // Calculate evidence-based confidence
      const avgEvidenceConfidence =
        allEvidence.length > 0
          ? allEvidence.reduce((sum, e) => sum + e.confidence, 0) /
            allEvidence.length
          : 0.5;

      // Map confidence levels
      const confidenceMap: Record<ConfidenceLevel, number> =
        DEFAULT_AGENT_FABRIC_CONFIG.confidenceThresholds.levels;

      const originalNumeric = confidenceMap[originalConfidence] || 0.5;

      // Adjust confidence based on evidence
      const adjustedConfidence = (originalNumeric + avgEvidenceConfidence) / 2;

      // Convert back to confidence level
      const { acceptable, reviewRequired } =
        DEFAULT_AGENT_FABRIC_CONFIG.confidenceThresholds.validation;

      if (adjustedConfidence >= acceptable) return "high";
      if (adjustedConfidence >= reviewRequired) return "high";
      if (adjustedConfidence >= 0.5) return "medium"; // Keep 0.5 as fallback floor for medium
      return "low";
    } catch (error) {
      logger.warn("Failed to validate ROI confidence", {
        originalConfidence,
        error: error instanceof Error ? error.message : String(error),
      });

      return originalConfidence;
    }
  }

  /**
   * Find causal evidence for a specific assumption
   */
  private async findCausalEvidenceForAssumption(
    assumption: any,
    capabilities: any[]
  ): Promise<any[]> {
    const evidence = [];

    // Extract key metrics from assumption
    const assumptionMetrics = this.extractMetricsFromAssumption(assumption);

    for (const metric of assumptionMetrics) {
      for (const capability of capabilities) {
        try {
          // Use advanced causal engine for probabilistic inference
          const inference =
            await this.advancedCausalEngine.inferCausalRelationship(
              capability.name,
              metric,
              {
                industry: assumption.context?.industry,
                companySize: assumption.context?.companySize,
              }
            );

          if (inference.confidence >= 0.6) {
            evidence.push(inference);
          }
        } catch (error) {
          // Fall back to basic causal truth service
          const basicEvidence = this.causalTruthService.search({
            action: capability.name,
            kpi: metric,
            minConfidence: 0.6,
          });

          evidence.push(...basicEvidence);
        }
      }
    }

    return evidence;
  }

  /**
   * Calculate risk-adjusted assumption values
   */
  private async calculateRiskAdjustedAssumption(
    assumption: any,
    evidence: any[]
  ): Promise<any> {
    if (evidence.length === 0) {
      return {
        originalValue: assumption.value,
        adjustedValue: assumption.value,
        confidenceAdjustment: 0,
        riskLevel: "high",
      };
    }

    // Calculate average confidence from evidence
    const avgConfidence =
      evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;

    // Calculate confidence adjustment
    const confidenceAdjustment = (avgConfidence - 0.5) * 0.4; // Max 20% adjustment

    // Apply risk adjustment to assumption value
    let adjustedValue = assumption.value;
    if (typeof assumption.value === "number") {
      adjustedValue = assumption.value * (1 + confidenceAdjustment);
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high";
    if (avgConfidence >= 0.8) riskLevel = "low";
    else if (avgConfidence >= 0.6) riskLevel = "medium";
    else riskLevel = "high";

    return {
      originalValue: assumption.value,
      adjustedValue,
      confidenceAdjustment,
      riskLevel,
      evidenceStrength: evidence.length,
    };
  }

  /**
   * Extract relevant metrics from assumption text
   */
  private extractMetricsFromAssumption(assumption: any): string[] {
    const metrics = [];
    const text = (
      assumption.description ||
      assumption.name ||
      ""
    ).toLowerCase();

    // Common business metrics
    const metricPatterns = [
      "revenue",
      "profit",
      "cost",
      "efficiency",
      "productivity",
      "satisfaction",
      "retention",
      "conversion",
      "engagement",
      "growth",
      "margin",
      "roi",
      "npv",
      "payback",
    ];

    for (const metric of metricPatterns) {
      if (text.includes(metric)) {
        metrics.push(metric);
      }
    }

    return metrics;
  }

  /**
   * Perform scenario-based sensitivity analysis
   */
  async performSensitivityAnalysis(
    roiModel: any,
    scenarios: Array<{
      name: string;
      assumptions: Record<string, any>;
      probability: number;
    }>
  ): Promise<any[]> {
    const results = [];

    for (const scenario of scenarios) {
      try {
        // Apply scenario assumptions
        const adjustedModel = this.applyScenarioToModel(roiModel, scenario);

        // Calculate ROI under scenario
        const scenarioRoi = await this.calculateScenarioROI(adjustedModel);

        // Assess scenario risk
        const riskAssessment = await this.assessScenarioRisk(
          scenario,
          adjustedModel
        );

        results.push({
          scenario: scenario.name,
          probability: scenario.probability,
          roi: scenarioRoi,
          risk: riskAssessment,
          assumptions: scenario.assumptions,
        });
      } catch (error) {
        logger.warn("Failed to analyze scenario", {
          scenario: scenario.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Apply scenario assumptions to ROI model
   */
  private applyScenarioToModel(model: any, scenario: any): any {
    const adjustedModel = JSON.parse(JSON.stringify(model)); // Deep clone

    // Apply scenario adjustments to assumptions
    for (const [key, value] of Object.entries(scenario.assumptions)) {
      const assumption = adjustedModel.assumptions.find(
        (a: any) => a.name === key
      );
      if (assumption) {
        assumption.value = value;
      }
    }

    return adjustedModel;
  }

  /**
   * Calculate ROI for a specific scenario
   */
  private async calculateScenarioROI(model: any): Promise<any> {
    // Simplified ROI calculation - in practice would use sophisticated financial modeling
    let totalBenefits = 0;
    let totalCosts = 0;

    for (const assumption of model.assumptions) {
      if (assumption.type === "benefit") {
        totalBenefits += assumption.value || 0;
      } else if (assumption.type === "cost") {
        totalCosts += assumption.value || 0;
      }
    }

    const roi =
      totalCosts > 0 ? ((totalBenefits - totalCosts) / totalCosts) * 100 : 0;

    return {
      totalBenefits,
      totalCosts,
      netBenefit: totalBenefits - totalCosts,
      roi,
      paybackPeriod: totalCosts > 0 ? totalCosts / (totalBenefits / 12) : 0, // months
    };
  }

  /**
   * Assess scenario risk based on causal evidence
   */
  private async assessScenarioRisk(scenario: any, model: any): Promise<any> {
    const riskFactors = [];
    let overallRisk = 0;

    for (const assumption of model.assumptions) {
      try {
        // Check causal evidence for assumption
        const evidence = await this.findCausalEvidenceForAssumption(
          assumption,
          []
        );

        if (evidence.length === 0) {
          riskFactors.push({
            assumption: assumption.name,
            risk: "high",
            reason: "No causal evidence found",
          });
          overallRisk += 0.3;
        } else if (evidence[0].confidence < 0.7) {
          riskFactors.push({
            assumption: assumption.name,
            risk: "medium",
            reason: "Low confidence in causal evidence",
          });
          overallRisk += 0.15;
        }
      } catch (error) {
        riskFactors.push({
          assumption: assumption.name,
          risk: "unknown",
          reason: "Failed to assess evidence",
        });
        overallRisk += 0.2;
      }
    }

    // Normalize risk score
    overallRisk = Math.min(1, overallRisk / model.assumptions.length);

    // Adjust risk based on scenario probability - lower probability scenarios are riskier
    const probabilityAdjustment = scenario.probability
      ? 1 - scenario.probability
      : 0.5;
    overallRisk = Math.min(1, overallRisk + probabilityAdjustment);

    return {
      overallRisk,
      riskLevel:
        overallRisk >= 0.7 ? "high" : overallRisk >= 0.4 ? "medium" : "low",
      riskFactors,
    };
  }
}
