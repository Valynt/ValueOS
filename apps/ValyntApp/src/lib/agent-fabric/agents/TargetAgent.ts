/**
 * Target Agent
 *
 * Validates and refines target definitions with strict schema validation,
 * ensuring targets are measurable, achievable, and aligned with business objectives.
 */

import { BaseAgent, ValueLifecycleStage } from "../BaseAgent";
import { AgentRequest, AgentResponse, AgentCapability } from "../../../services/agents/core/IAgent";
import { AgentConfig, AgentType, ConfidenceLevel } from "../../../types/agent";
import { z } from "zod";
import {
  getAdvancedCausalEngine,
  AdvancedCausalEngine,
} from "../../../services/reasoning/AdvancedCausalEngine";

// ============================================================================
// Target Agent Schemas
// ============================================================================

export const TargetAgentInputSchema = z.object({
  targetId: z.string().optional(),
  title: z.string().min(1, "Target title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(["revenue", "cost", "efficiency", "strategic", "compliance"]),
  currentValue: z.number().min(0, "Current value must be non-negative"),
  targetValue: z.number().min(0, "Target value must be non-negative"),
  unit: z.string().min(1, "Unit is required"),
  timeframe: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime(),
    duration: z.string().optional(),
  }),
  owner: z.object({
    name: z.string().min(1, "Owner name is required"),
    role: z.string().min(1, "Owner role is required"),
    department: z.string().optional(),
  }),
  stakeholders: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        influence: z.enum(["low", "medium", "high"]),
        required: z.boolean(),
      })
    )
    .optional(),
  kpis: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        target: z.number(),
        current: z.number(),
        unit: z.string(),
      })
    )
    .optional(),
  assumptions: z.array(z.string()).optional(),
  risks: z
    .array(
      z.object({
        description: z.string(),
        probability: z.enum(["low", "medium", "high"]),
        impact: z.enum(["low", "medium", "high"]),
        mitigation: z.string().optional(),
      })
    )
    .optional(),
  dependencies: z
    .array(
      z.object({
        description: z.string(),
        critical: z.boolean(),
        status: z.enum(["pending", "in_progress", "completed"]),
      })
    )
    .optional(),
  successCriteria: z.array(z.string()).min(1, "At least one success criterion is required"),
  measurementMethod: z.string().min(1, "Measurement method is required"),
  reviewFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  budget: z
    .object({
      allocated: z.number().optional(),
      spent: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
});

export type TargetAgentInput = z.infer<typeof TargetAgentInputSchema>;

export interface TargetValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: Array<{
    severity: "error" | "warning" | "info";
    field: string;
    message: string;
    suggestion?: string;
  }>;
  recommendations: string[];
  confidence: number; // 0-1
  estimatedDifficulty: "low" | "medium" | "high";
  resourceRequirements: {
    time: string;
    budget: number;
    skills: string[];
    tools: string[];
  };
}

export interface TargetAnalysis {
  targetId: string;
  validationResult: TargetValidation;
  causalTrace?: {
    impactCascade: Array<{
      action: string;
      targetKpi: string;
      effect: {
        direction: "increase" | "decrease" | "neutral";
        magnitude: number;
        confidence: number;
      };
      linkedOpportunity?: string;
    }>;
    verified: boolean;
    confidence: number;
  };
  feasibility: {
    score: number; // 0-100
    factors: Array<{
      factor: string;
      score: number;
      weight: number;
      explanation: string;
    }>;
    timeline: {
      realistic: boolean;
      suggestedAdjustment?: string;
      confidence: number;
    };
  };
  strategicAlignment: {
    score: number; // 0-100
    businessObjectives: string[];
    kpiAlignment: string[];
    stakeholderSupport: number; // 0-1
  };
  riskAssessment: {
    overallRisk: "low" | "medium" | "high";
    criticalRisks: Array<{
      risk: string;
      probability: number;
      impact: number;
      mitigation: string;
    }>;
    riskMitigation: string[];
  };
  implementation: {
    phases: Array<{
      phase: string;
      duration: string;
      activities: string[];
      deliverables: string[];
      dependencies: string[];
    }>;
    milestones: Array<{
      milestone: string;
      date: string;
      criteria: string[];
    }>;
  };
  monitoring: {
    kpis: Array<{
      name: string;
      target: number;
      current: number;
      unit: string;
      frequency: string;
      owner: string;
    }>;
    alerts: Array<{
      condition: string;
      threshold: number;
      action: string;
    }>;
  };
}

export class TargetAgent extends BaseAgent {
  readonly agentId = "target-agent";
  readonly name = "TargetAgent";
  readonly version = "1.0.0";
  readonly lifecycleStage = ValueLifecycleStage.DEFINITION;

  private causalEngine: AdvancedCausalEngine;

  constructor(config: AgentConfig) {
    super(config);
    this.causalEngine = getAdvancedCausalEngine();
  }

  getAgentType(): AgentType {
    return "target";
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "target_validation",
        name: "Target Validation",
        description: "Validate and refine target definitions",
        enabled: true,
        category: "validation",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "feasibility_analysis",
        name: "Feasibility Analysis",
        description: "Analyze target feasibility",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "strategic_alignment",
        name: "Strategic Alignment",
        description: "Assess strategic alignment",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "risk_assessment",
        name: "Risk Assessment",
        description: "Assess implementation risks",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Validate input schema
      const validatedInput = this.validateAndParseInput(request);

      // Perform comprehensive target analysis
      const analysis = await this.analyzeTarget(validatedInput);

      // Store validation results in memory
      await this.storeMemory("episodic", `Target Validation: ${validatedInput.title}`, {
        validation: analysis.validationResult,
        timestamp: new Date().toISOString(),
      });

      // Check causal trace requirement
      if (!analysis.causalTrace?.verified) {
        return this.createResponse(
          false,
          `Target rejected: No verified causal link to business opportunities. Causal confidence: ${analysis.causalTrace?.confidence || 0}`,
          "low" as ConfidenceLevel,
          "Target must provide causal trace linking back to verified Opportunity"
        );
      }

      // Generate response
      const response = this.createResponse(
        true,
        this.formatTargetResponse(analysis),
        analysis.validationResult.score >= 70
          ? ("high" as ConfidenceLevel)
          : ("medium" as ConfidenceLevel),
        `Target validation completed with overall score ${analysis.validationResult.score}/100`
      );

      return response;
    } catch (error) {
      return this.createResponse(
        false,
        (error as Error).message,
        "low" as ConfidenceLevel,
        `Error validating target: ${(error as Error).message}`
      );
    }
  }

  private validateAndParseInput(request: AgentRequest): TargetAgentInput {
    // Extract input data
    const inputData = {
      ...request.parameters,
      ...request.context,
      query: request.query,
    };

    // Validate with Zod schema
    try {
      const validated = TargetAgentInputSchema.parse(inputData);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  private async analyzeTarget(input: TargetAgentInput): Promise<TargetAnalysis> {
    // Perform validation
    const validation = await this.validateTarget(input);

    // Validate causal trace - ensure target is linked to verified opportunities
    const causalTrace = await this.validateCausalTrace(input);

    // Assess feasibility
    const feasibility = await this.assessFeasibility(input);

    // Analyze strategic alignment
    const strategicAlignment = await this.analyzeStrategicAlignment(input);

    // Assess risks
    const riskAssessment = await this.assessRisks(input);

    // Create implementation plan
    const implementation = await this.createImplementationPlan(input);

    // Define monitoring approach
    const monitoring = await this.defineMonitoring(input);

    return {
      targetId: input.targetId || `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      validationResult: validation,
      causalTrace,
      feasibility,
      strategicAlignment,
      riskAssessment,
      implementation,
      monitoring,
    };
  }

  private async validateCausalTrace(
    input: TargetAgentInput
  ): Promise<TargetAnalysis["causalTrace"]> {
    try {
      // Infer the action from the target description
      const action = this.inferActionFromTarget(input);

      // Get the target KPI from the input
      const targetKpi = this.extractTargetKpi(input);

      // Use AdvancedCausalEngine to get causal inference
      const causalInference = await this.causalEngine.inferCausalRelationship(action, targetKpi, {
        category: input.category,
        timeframe: input.timeframe,
        currentValue: input.currentValue,
        targetValue: input.targetValue,
      });

      // Check if this target is linked to verified opportunities
      const linkedOpportunity = await this.findLinkedOpportunity(action, targetKpi);

      const impactCascade = [
        {
          action,
          targetKpi,
          effect: {
            direction: causalInference.effect.direction,
            magnitude: causalInference.effect.magnitude,
            confidence: causalInference.confidence,
          },
          linkedOpportunity,
        },
      ];

      return {
        impactCascade,
        verified: !!linkedOpportunity,
        confidence: causalInference.confidence,
      };
    } catch (error) {
      // If causal validation fails, return unverified trace
      return {
        impactCascade: [],
        verified: false,
        confidence: 0,
      };
    }
  }

  private inferActionFromTarget(input: TargetAgentInput): string {
    // Simple inference based on category and description
    const categoryActions: Record<string, string> = {
      revenue: "increase_revenue",
      cost: "reduce_costs",
      efficiency: "improve_efficiency",
      strategic: "strategic_initiative",
      compliance: "ensure_compliance",
    };

    return categoryActions[input.category] || "business_improvement";
  }

  private extractTargetKpi(input: TargetAgentInput): string {
    // Extract KPI name from title or description
    const kpiKeywords = [
      "revenue",
      "cost",
      "efficiency",
      "productivity",
      "satisfaction",
      "retention",
    ];
    const text = `${input.title} ${input.description}`.toLowerCase();

    for (const keyword of kpiKeywords) {
      if (text.includes(keyword)) {
        return keyword;
      }
    }

    return "business_metric";
  }

  private async findLinkedOpportunity(
    action: string,
    targetKpi: string
  ): Promise<string | undefined> {
    // Query memory for verified opportunities that could lead to this target
    try {
      const opportunities = await this.queryMemory("semantic", {
        type: "opportunity",
        verified: true,
        relatedActions: [action],
        targetKpis: [targetKpi],
      });

      if (opportunities && opportunities.length > 0) {
        return opportunities[0].id;
      }
    } catch (error) {
      // Memory query failed, return undefined
    }

    return undefined;
  }

  private async validateTarget(input: TargetAgentInput): Promise<TargetValidation> {
    const issues: TargetValidation["issues"] = [];
    let score = 100;

    // Basic validation checks
    if (input.targetValue <= input.currentValue) {
      issues.push({
        severity: "error",
        field: "targetValue",
        message: "Target value must be greater than current value",
        suggestion: "Set a realistic target that exceeds the current value",
      });
      score -= 30;
    }

    const improvement = ((input.targetValue - input.currentValue) / input.currentValue) * 100;
    if (improvement > 500) {
      issues.push({
        severity: "warning",
        field: "targetValue",
        message: "Target represents very large improvement (>500%)",
        suggestion: "Consider breaking this into smaller, incremental targets",
      });
      score -= 15;
    } else if (improvement < 10) {
      issues.push({
        severity: "info",
        field: "targetValue",
        message: "Target represents small improvement (<10%)",
        suggestion: "Consider if this target is ambitious enough",
      });
      score -= 5;
    }

    // Timeframe validation
    const endDate = new Date(input.timeframe.end);
    const now = new Date();
    const duration = endDate.getTime() - now.getTime();
    const days = duration / (1000 * 60 * 60 * 24);

    if (days < 7) {
      issues.push({
        severity: "warning",
        field: "timeframe.end",
        message: "Target timeframe is very short (< 7 days)",
        suggestion: "Allow more time for meaningful progress",
      });
      score -= 10;
    } else if (days > 365) {
      issues.push({
        severity: "info",
        field: "timeframe.end",
        message: "Target timeframe is very long (> 1 year)",
        suggestion: "Consider breaking into shorter-term milestones",
      });
      score -= 5;
    }

    // Success criteria validation
    if (!input.successCriteria || input.successCriteria.length === 0) {
      issues.push({
        severity: "error",
        field: "successCriteria",
        message: "Success criteria are required",
        suggestion: "Define clear, measurable success criteria",
      });
      score -= 25;
    }

    // Measurement method validation
    if (!input.measurementMethod || input.measurementMethod.length < 10) {
      issues.push({
        severity: "warning",
        field: "measurementMethod",
        message: "Measurement method should be detailed",
        suggestion: "Specify exactly how and when the target will be measured",
      });
      score -= 10;
    }

    // Calculate confidence based on validation score
    const confidence = Math.max(0, score / 100);

    // Determine difficulty
    let estimatedDifficulty: "low" | "medium" | "high" = "medium";
    if (improvement > 200 || days < 30) {
      estimatedDifficulty = "high";
    } else if (improvement < 50 && days > 180) {
      estimatedDifficulty = "low";
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, input);

    // Calculate resource requirements
    const resourceRequirements = this.calculateResourceRequirements(input, estimatedDifficulty);

    return {
      isValid: score >= 70, // Consider valid if score is 70 or above
      score: Math.max(0, score),
      issues,
      recommendations,
      confidence,
      estimatedDifficulty,
      resourceRequirements,
    };
  }

  private async assessFeasibility(input: TargetAgentInput): Promise<TargetAnalysis["feasibility"]> {
    const factors = [
      {
        factor: "Value Gap",
        score: this.calculateValueGapScore(input),
        weight: 0.25,
        explanation: "Assesses the reasonableness of the improvement target",
      },
      {
        factor: "Timeframe",
        score: this.calculateTimeframeScore(input),
        weight: 0.2,
        explanation: "Evaluates if the timeline is realistic for the target",
      },
      {
        factor: "Resources",
        score: this.calculateResourceScore(input),
        weight: 0.2,
        explanation: "Considers available resources and dependencies",
      },
      {
        factor: "Complexity",
        score: this.calculateComplexityScore(input),
        weight: 0.15,
        explanation: "Assesses the technical and operational complexity",
      },
      {
        factor: "Risk",
        score: this.calculateRiskScore(input),
        weight: 0.2,
        explanation: "Evaluates potential risks and mitigation strategies",
      },
    ];

    const weightedScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);

    const timeline = {
      realistic: weightedScore >= 70,
      suggestedAdjustment:
        weightedScore < 70 ? this.suggestTimelineAdjustment(input, weightedScore) : undefined,
      confidence: weightedScore / 100,
    };

    return {
      score: weightedScore,
      factors,
      timeline,
    };
  }

  private async analyzeStrategicAlignment(
    input: TargetAgentInput
  ): Promise<TargetAnalysis["strategicAlignment"]> {
    // Use LLM to analyze strategic alignment
    const prompt = this.buildStrategicAlignmentPrompt(input);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a strategic business analyst. Analyze how well the target aligns with business objectives and KPIs.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    return this.parseStrategicAlignment(llmResponse.content, input);
  }

  private async assessRisks(input: TargetAgentInput): Promise<TargetAnalysis["riskAssessment"]> {
    const risks = input.risks || [];

    // Calculate overall risk score
    const riskScores = risks.map((risk) => {
      const probabilityScore =
        risk.probability === "low" ? 0.3 : risk.probability === "medium" ? 0.6 : 0.9;
      const impactScore = risk.impact === "low" ? 0.3 : risk.impact === "medium" ? 0.6 : 0.9;
      return probabilityScore * impactScore;
    });

    const avgRiskScore =
      risks.length > 0 ? riskScores.reduce((sum, score) => sum + score, 0) / risks.length : 0.3;

    let overallRisk: "low" | "medium" | "high" = "medium";
    if (avgRiskScore < 0.4) overallRisk = "low";
    if (avgRiskScore > 0.7) overallRisk = "high";

    const criticalRisks = risks
      .filter((risk) => {
        const probScore =
          risk.probability === "low" ? 0.3 : risk.probability === "medium" ? 0.6 : 0.9;
        const impactScore = risk.impact === "low" ? 0.3 : risk.impact === "medium" ? 0.6 : 0.9;
        return probScore * impactScore > 0.5;
      })
      .map((risk) => ({
        risk: risk.description,
        probability: risk.probability === "low" ? 0.3 : risk.probability === "medium" ? 0.6 : 0.9,
        impact: risk.impact === "low" ? 0.3 : risk.impact === "medium" ? 0.6 : 0.9,
        mitigation: risk.mitigation || "No mitigation specified",
      }));

    const riskMitigation = [
      "Regular progress monitoring",
      "Stakeholder communication",
      "Contingency planning",
      "Resource allocation review",
    ];

    return {
      overallRisk,
      criticalRisks,
      riskMitigation,
    };
  }

  private async createImplementationPlan(
    input: TargetAgentInput
  ): Promise<TargetAnalysis["implementation"]> {
    const phases = [
      {
        phase: "Planning",
        duration: "1-2 weeks",
        activities: [
          "Finalize target definition",
          "Secure stakeholder buy-in",
          "Develop detailed project plan",
          "Allocate resources",
        ],
        deliverables: ["Project charter", "Resource plan", "Risk register"],
        dependencies: [],
      },
      {
        phase: "Execution",
        duration: this.calculateExecutionDuration(input),
        activities: [
          "Implement core changes",
          "Monitor progress",
          "Adjust approach as needed",
          "Regular stakeholder updates",
        ],
        deliverables: ["Progress reports", "Updated metrics", "Issue logs"],
        dependencies: ["Planning"],
      },
      {
        phase: "Validation",
        duration: "1-2 weeks",
        activities: [
          "Measure target achievement",
          "Validate results",
          "Document lessons learned",
          "Celebrate success",
        ],
        deliverables: ["Final report", "Success validation", "Lessons learned"],
        dependencies: ["Execution"],
      },
    ];

    const endDate = new Date(input.timeframe.end);
    const now = new Date();
    const days = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Create milestones with proper date formatting
    const milestones = [
      {
        milestone: "Target Definition Complete",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        criteria: ["Target defined", "Stakeholders aligned", "Resources allocated"],
      },
      {
        milestone: "50% Progress",
        date: new Date(
          Date.now() +
            parseInt(this.calculateExecutionDuration(input).match(/\d+/)?.[0] || "60") *
              24 *
              60 *
              60 *
              60 *
              1000
        )
          .toISOString()
          .split("T")[0],
        criteria: ["50% of target achieved", "No major blockers", "On track timeline"],
      },
      {
        milestone: "Target Achievement",
        date:
          input.timeframe.end?.split("T")[0] ||
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        criteria: ["Target value achieved", "Success criteria met", "Stakeholder acceptance"],
      },
    ];

    return {
      phases,
      milestones,
    };
  }

  private async defineMonitoring(input: TargetAgentInput): Promise<TargetAnalysis["monitoring"]> {
    const kpis = input.kpis?.map((kpi) => ({
      name: kpi.name,
      target: kpi.target,
      current: kpi.current,
      unit: kpi.unit,
      frequency: kpi.frequency || "monthly",
      owner: kpi.owner || "Target Owner",
    })) || [
      {
        name: input.title,
        target: input.targetValue,
        current: input.currentValue,
        unit: input.unit,
        frequency: input.reviewFrequency || "monthly",
        owner: input.owner?.name || "Target Owner",
      },
    ];

    const alerts = [
      {
        condition: "Progress < 50%",
        threshold: 0.5,
        action: "Review and adjust approach",
      },
      {
        condition: "Risk escalation",
        threshold: 1,
        action: "Immediate stakeholder meeting",
      },
      {
        condition: "Resource shortage",
        threshold: 1,
        action: "Reallocate resources or adjust timeline",
      },
    ];

    return {
      kpis,
      alerts,
    };
  }

  // Helper methods
  private calculateValueGapScore(input: TargetAgentInput): number {
    const improvement = ((input.targetValue - input.currentValue) / input.currentValue) * 100;
    if (improvement < 10) return 100; // Very conservative
    if (improvement < 50) return 90; // Conservative
    if (improvement < 100) return 80; // Moderate
    if (improvement < 200) return 60; // Ambitious
    if (improvement < 500) return 40; // Very ambitious
    return 20; // Extremely ambitious
  }

  private calculateTimeframeScore(input: TargetAgentInput): number {
    const endDate = new Date(input.timeframe.end);
    const now = new Date();
    const days = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    const improvement = ((input.targetValue - input.currentValue) / input.currentValue) * 100;

    // Check if timeframe is appropriate for the improvement
    if (improvement < 50 && days > 180) return 100; // Long time for small improvement
    if (improvement < 100 && days > 90) return 90; // Good time for moderate improvement
    if (improvement < 200 && days > 60) return 80; // Reasonable time
    if (improvement < 500 && days > 30) return 60; // Tight but possible
    return 40; // Very tight timeframe
  }

  private calculateResourceScore(input: TargetAgentInput): number {
    // This would integrate with actual resource availability
    // For now, return a reasonable default
    return 75;
  }

  private calculateComplexityScore(input: TargetAgentInput): number {
    let complexity = 50; // Base complexity

    // Adjust based on factors
    if (input.stakeholders && input.stakeholders.length > 5) complexity -= 10;
    if (input.dependencies && input.dependencies.length > 3) complexity -= 15;
    if (input.risks && input.risks.length > 5) complexity -= 10;
    if (input.category === "strategic" || input.category === "compliance") complexity -= 10;

    return Math.max(20, Math.min(100, complexity));
  }

  private calculateRiskScore(input: TargetAgentInput): number {
    if (!input.risks || input.risks.length === 0) return 90;

    const highRiskCount = input.risks.filter(
      (r) => r.probability === "high" && r.impact === "high"
    ).length;
    const totalRisks = input.risks.length;

    if (highRiskCount > 0) return 40;
    if (totalRisks > 5) return 60;
    if (totalRisks > 2) return 75;
    return 85;
  }

  private suggestTimelineAdjustment(input: TargetAgentInput, score: number): string {
    const improvement = ((input.targetValue - input.currentValue) / input.currentValue) * 100;

    if (score < 50) {
      return "Consider extending the timeline by 50-100% or reducing the target value";
    } else if (score < 70) {
      return "Consider modest timeline extension or breaking into phases";
    }

    return "Timeline is reasonable with minor adjustments";
  }

  private generateRecommendations(
    issues: TargetValidation["issues"],
    input: TargetAgentInput
  ): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on issues
    issues.forEach((issue) => {
      if (issue.suggestion) {
        recommendations.push(issue.suggestion);
      }
    });

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push("Target appears well-defined and achievable");
    }

    recommendations.push("Establish regular review cadence");
    recommendations.push("Ensure stakeholder communication plan");
    recommendations.push("Define clear success metrics");

    return recommendations;
  }

  private calculateResourceRequirements(
    input: TargetAgentInput,
    difficulty: "low" | "medium" | "high"
  ): TargetValidation["resourceRequirements"] {
    const baseRequirements = {
      low: {
        time: "1-2 months",
        budget: 10000,
        skills: ["Basic analysis"],
        tools: ["Spreadsheet"],
      },
      medium: {
        time: "3-6 months",
        budget: 50000,
        skills: ["Project management", "Data analysis"],
        tools: ["Project management software"],
      },
      high: {
        time: "6-12 months",
        budget: 200000,
        skills: ["Advanced analytics", "Change management"],
        tools: ["Analytics platform"],
      },
    };

    return baseRequirements[difficulty];
  }

  private buildStrategicAlignmentPrompt(input: TargetAgentInput): string {
    return `
Analyze the strategic alignment of this target:

TARGET DETAILS:
- Title: ${input.title}
- Description: ${input.description}
- Category: ${input.category}
- Current Value: ${input.currentValue} ${input.unit}
- Target Value: ${input.targetValue} ${input.unit}
- Owner: ${input.owner.name} (${input.owner.role})
- Success Criteria: ${input.successCriteria.join(", ")}

Please provide analysis in this format:
{
  "score": 85,
  "businessObjectives": ["Objective 1", "Objective 2"],
  "kpiAlignment": ["KPI 1", "KPI 2"],
  "stakeholderSupport": 0.8
}

Focus on how well this target aligns with typical business objectives and KPIs for the ${input.category} category.
    `.trim();
  }

  private parseStrategicAlignment(
    content: string,
    input: TargetAgentInput
  ): TargetAnalysis["strategicAlignment"] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    } catch (error) {
      // Fallback to basic analysis
    }

    return {
      score: 75,
      businessObjectives: [`Improve ${input.category} metrics`],
      kpiAlignment: [`${input.category} performance`],
      stakeholderSupport: 0.7,
    };
  }

  private calculateExecutionDuration(input: TargetAgentInput): string {
    const endDate = new Date(input.timeframe.end);
    const now = new Date();
    const days = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Subtract planning and validation phases
    const executionDays = Math.max(30, days - 30);

    return `${Math.round(executionDays / 7)} weeks`;
  }

  private async storeTargetAnalysis(
    analysis: TargetAnalysis,
    request: AgentRequest
  ): Promise<void> {
    // Store the analysis in episodic memory
    await this.storeMemory("episodic", `Target Analysis: ${analysis.targetId}`, {
      analysis,
      timestamp: new Date().toISOString(),
    });

    // Store key insights in semantic memory
    await this.storeMemory(
      "semantic",
      `Target validation score for ${analysis.targetId}: ${analysis.validationResult.score}`,
      {
        targetId: analysis.targetId,
        validationScore: analysis.validationResult.score,
        isValid: analysis.validationResult.score >= 70,
      }
    );
  }

  private formatTargetResponse(analysis: TargetAnalysis): string {
    const {
      validationResult,
      feasibility,
      strategicAlignment,
      riskAssessment,
      implementation,
      monitoring,
    } = analysis;

    return `
# Target Validation Analysis

## Target Overview
**ID**: ${analysis.targetId}
**Status**: ${validationResult.isValid ? "✅ VALID" : "❌ NEEDS ADJUSTMENT"}
**Score**: ${validationResult.score}/100
**Confidence**: ${(validationResult.confidence * 100).toFixed(1)}%

## Validation Issues
${
  validationResult.issues.length > 0
    ? validationResult.issues
        .map(
          (issue) =>
            `- **${issue.severity.toUpperCase()}** (${issue.field}): ${issue.message}${issue.suggestion ? ` - ${issue.suggestion}` : ""}`
        )
        .join("\n")
    : "No major issues identified"
}

## Recommendations
${validationResult.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join("\n")}

## Feasibility Assessment
**Overall Score**: ${feasibility.score}/100
**Timeline**: ${feasibility.timeline.realistic ? "✅ Realistic" : "⚠️ Needs Adjustment"}
${feasibility.timeline.suggestedAdjustment ? `**Suggestion**: ${feasibility.timeline.suggestedAdjustment}` : ""}

### Feasibility Factors
${feasibility.factors.map((factor) => `- **${factor.factor}**: ${factor.score}/100 (${factor.explanation})`).join("\n")}

## Strategic Alignment
**Alignment Score**: ${strategicAlignment.score}/100
**Stakeholder Support**: ${(strategicAlignment.stakeholderSupport * 100).toFixed(1)}%

### Business Objectives
${strategicAlignment.businessObjectives.map((obj) => `- ${obj}`).join("\n")}

### KPI Alignment
${strategicAlignment.kpiAlignment.map((kpi) => `- ${kpi}`).join("\n")}

## Risk Assessment
**Overall Risk**: ${riskAssessment.overallRisk.toUpperCase()}

### Critical Risks
${
  riskAssessment.criticalRisks.length > 0
    ? riskAssessment.criticalRisks
        .map(
          (risk) =>
            `- **${risk.risk}** (Probability: ${(risk.probability * 100).toFixed(0)}%, Impact: ${(risk.impact * 100).toFixed(0)}%)`
        )
        .join("\n")
    : "No critical risks identified"
}

### Risk Mitigation
${riskAssessment.riskMitigation.map((mitigation) => `- ${mitigation}`).join("\n")}

## Implementation Plan
### Phases
${implementation.phases
  .map(
    (phase, index) => `
#### Phase ${index + 1}: ${phase.phase}
**Duration**: ${phase.duration}
**Activities**: ${phase.activities.map((a) => `- ${a}`).join("\n")}
**Deliverables**: ${phase.deliverables.map((d) => `- ${d}`).join("\n")}
${phase.dependencies.length > 0 ? `**Dependencies**: ${phase.dependencies.join(", ")}` : ""}
`
  )
  .join("\n")}

### Milestones
${implementation.milestones
  .map(
    (milestone, index) => `${index + 1}. **${milestone.milestone}** (${milestone.date})
   - Criteria: ${milestone.criteria.join(", ")}`
  )
  .join("\n")}

## Monitoring Plan
### KPIs
${monitoring.kpis.map((kpi) => `- **${kpi.name}**: ${kpi.current}/${kpi.target} ${kpi.unit} (${kpi.frequency}, ${kpi.owner})`).join("\n")}

### Alerts
${monitoring.alerts.map((alert) => `- **${alert.condition}**: ${alert.action}`).join("\n")}

## Resource Requirements
- **Time**: ${validationResult.resourceRequirements.time}
- **Budget**: $${validationResult.resourceRequirements.budget.toLocaleString()}
- **Skills**: ${validationResult.resourceRequirements.skills.join(", ")}
- **Tools**: ${validationResult.resourceRequirements.tools.join(", ")}
    `.trim();
  }

  private createErrorResponse(error: Error, executionTime: number): AgentResponse {
    return this.createResponse(
      false,
      `Error analyzing target: ${error.message}`,
      0,
      undefined,
      undefined,
      undefined,
      executionTime
    );
  }
}
