import { v4 as uuidv4 } from "uuid";

import { LLMGateway } from "../../lib/agent-fabric/LLMGateway";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem";
import { logger } from "../../lib/logger";
import type { SimulationResult } from "../UnifiedAgentOrchestrator";
import { WorkflowDAG, WorkflowStage } from "../../types/workflow";

export interface WorkflowSimulationService {
  simulateWorkflow(
    workflowDefinitionId: string,
    context?: Record<string, unknown>,
    options?: { maxSteps?: number; stopOnFailure?: boolean }
  ): Promise<SimulationResult>;
}

export class DefaultWorkflowSimulationService implements WorkflowSimulationService {
  constructor(
    private readonly llmGateway: LLMGateway,
    private readonly memorySystem: MemorySystem,
    private readonly getWorkflowDefinition: (workflowDefinitionId: string) => Promise<{ dag_schema: WorkflowDAG }>,
    private readonly isEnabled: () => boolean,
  ) {}

  async simulateWorkflow(
    workflowDefinitionId: string,
    context: Record<string, unknown> = {},
    options?: { maxSteps?: number; stopOnFailure?: boolean }
  ): Promise<SimulationResult> {
    if (!this.isEnabled()) {
      throw new Error("Simulation is disabled");
    }

    const simulationId = uuidv4();
    const definition = await this.getWorkflowDefinition(workflowDefinitionId);
    const dag = definition.dag_schema;
    const orgId = String(context.organizationId ?? context.tenantId ?? "");
    const similarEpisodes = await this.memorySystem.retrieve({
      agent_id: "orchestrator",
      organization_id: orgId,
      limit: 5,
    });

    const stepsSimulated: Array<Record<string, unknown>> = [];
    let currentStageId = dag.initial_stage;
    let simulationContext = { ...context };
    let stepNumber = 0;
    const maxSteps = options?.maxSteps || 50;
    let totalConfidence = 0;
    let successProbability = 1;

    while (currentStageId && stepNumber < maxSteps) {
      const stage = dag.stages.find((s) => s.id === currentStageId);
      if (!stage) break;
      stepNumber++;
      const prediction = await this.predictStageOutcome(stage, simulationContext, similarEpisodes);
      stepsSimulated.push({
        stage_id: currentStageId,
        stage_name: stage.name,
        predicted_outcome: prediction.outcome,
        confidence: prediction.confidence,
        estimated_duration_seconds: prediction.estimatedDuration,
      });
      totalConfidence += prediction.confidence;
      successProbability *= prediction.confidence;
      simulationContext = { ...simulationContext, ...prediction.outcome };
      const transition = stage.transitions?.find((t) => (t.condition ? prediction.outcome.success !== false : true));
      currentStageId = transition?.to_stage ?? undefined;
      if (dag.final_stages?.includes(currentStageId || "")) break;
    }

    const avgConfidence = stepsSimulated.length > 0 ? totalConfidence / stepsSimulated.length : 0;

    return {
      simulation_id: simulationId,
      workflow_definition_id: workflowDefinitionId,
      predicted_outcome: simulationContext,
      confidence_score: avgConfidence,
      risk_assessment: {
        low_confidence_steps: stepsSimulated.filter((s) => Number(s.confidence) < 0.7).length,
        estimated_cost_usd: stepsSimulated.length * 0.01,
        requires_approval: stepsSimulated.some((s) => String(s.stage_name ?? "").includes("delete") || String(s.stage_name ?? "").includes("remove")),
      },
      steps_simulated: stepsSimulated,
      duration_estimate_seconds: stepsSimulated.reduce((sum, s) => sum + Number(s.estimated_duration_seconds ?? 0), 0),
      success_probability: successProbability,
    };
  }

  async predictStageOutcome(stage: WorkflowStage, context: Record<string, unknown>, similarEpisodes: unknown[]): Promise<{ outcome: Record<string, unknown>; confidence: number; estimatedDuration: number }> {
    const prompt = `Predict the outcome of workflow stage: ${stage.name}`;
    try {
      const organizationId = String(context.organizationId ?? context.organization_id ?? "");
      const response = await this.llmGateway.complete({
        messages: [{ role: "user", content: `${prompt}\nContext: ${JSON.stringify(context)}` }],
        max_tokens: 500,
        temperature: 0.3,
        metadata: { tenantId: organizationId, agentType: "workflow_predictor", similarEpisodeCount: similarEpisodes.length },
      });
      const parsed = JSON.parse(response.content) as Record<string, unknown>;
      return {
        outcome: (parsed.outcome as Record<string, unknown>) || { success: true },
        confidence: Number(parsed.confidence ?? 0.7),
        estimatedDuration: Number(parsed.estimatedDuration ?? 5),
      };
    } catch (error) {
      logger.warn("Failed to predict stage outcome, using defaults", { error });
      return { outcome: { success: true }, confidence: 0.5, estimatedDuration: 10 };
    }
  }
}
