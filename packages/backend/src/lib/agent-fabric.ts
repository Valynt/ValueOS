/**
 * AgentFabric — Root entry point for value case generation
 *
 * This module is the public API surface for agent-based value case generation.
 * It delegates to the AgentFactory + HypothesisLoop pipeline.
 */
import {
  LoopResultSchema,
  ValueHypothesisSchema,
} from "./agents/orchestration/index.js";
import { logger } from "./logger.js";
import type { AgentFactoryDeps } from "./agent-fabric/AgentFactory.js";
import type { LifecycleContext } from "../types/agent.js";
import { createAgentFactory } from "./agent-fabric/AgentFactory.js";

// ============================================================================
// Types
// ============================================================================

export interface AgentFabricResult {
  value_case_id: string;
  company_profile: {
    company_name: string;
    industry: string;
  };
  value_maps: Array<{
    feature: string;
    capability: string;
    business_outcome: string;
    value_driver: string;
  }>;
  kpi_hypotheses: Array<{
    kpi_name: string;
    target_value: number;
  }>;
  financial_model: {
    roi_percentage: number;
    npv_amount: number;
    payback_months: number;
    cost_breakdown: Record<string, number>;
  };
  assumptions: Array<{ name: string; value: string }>;
  quality_score: number;
  execution_metadata: ExecutionMetadata;
}

export interface ExecutionMetadata {
  execution_id: string;
  iteration_count: number;
  total_tokens: number;
  total_latency_ms: number;
  agent_contributions: Record<string, unknown>;
  loop_contract_valid: boolean;
}

// ============================================================================
// AgentFabric
// ============================================================================

export class AgentFabric {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly provider: string;
  private factoryDeps: AgentFactoryDeps | null = null;

  constructor(
    supabaseUrl: string,
    supabaseAnonKey: string,
    provider: string,
  ) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.provider = provider;
  }

  /**
   * Inject real agent factory dependencies required for processUserInput.
   */
  setFactoryDeps(deps: AgentFactoryDeps): void {
    this.factoryDeps = deps;
  }

  async initialize(): Promise<void> {
    logger.info("AgentFabric initialized", {
      provider: this.provider,
      hasFactoryDeps: this.factoryDeps !== null,
    });
  }

  /**
   * Generate a value case from user input.
   *
   * Requires factoryDeps (via setFactoryDeps) and an organizationId.
   */
  async processUserInput(
    userInput: string,
    organizationId: string,
  ): Promise<AgentFabricResult> {
    if (!this.factoryDeps) {
      throw new Error(
        "AgentFabric requires factoryDeps. Call setFactoryDeps() before processUserInput().",
      );
    }

    return this.executeWithAgentPipeline(userInput, organizationId);
  }

  // --------------------------------------------------------------------------
  // Real agent pipeline
  // --------------------------------------------------------------------------

  private async executeWithAgentPipeline(
    userInput: string,
    organizationId: string,
  ): Promise<AgentFabricResult> {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const factory = createAgentFactory(this.factoryDeps!);

    const agentContributions: Record<string, unknown> = {};
    let totalTokens = 0;

    // Run opportunity agent to generate initial hypotheses
    const opportunityAgent = factory.create("opportunity", organizationId);
    const opportunityResult = await opportunityAgent.execute({
      workspace_id: executionId,
      organization_id: organizationId,
      user_id: "system",
      lifecycle_stage: opportunityAgent.lifecycleStage as LifecycleContext["lifecycle_stage"],
      workspace_data: {},
      user_inputs: { query: userInput },
      metadata: { valueCaseId: executionId },
    });
    agentContributions.opportunity = opportunityResult;
    totalTokens += opportunityResult.metadata.token_usage?.total_tokens ?? 0;

    // Validate hypotheses against the LoopResult contract
    const rawHypotheses = (opportunityResult.result as Record<string, unknown>)?.hypotheses;
    const hypotheses = (Array.isArray(rawHypotheses) ? rawHypotheses : []).map(
      (h: Record<string, unknown>) =>
        ValueHypothesisSchema.parse({
          id: (h.id as string) ?? `hyp-${Math.random().toString(36).slice(2, 8)}`,
          description: (h.description as string) ?? userInput,
          confidence: (h.confidence as number) ?? 0.5,
          category: (h.category as string) ?? "opportunity",
          estimatedValue: (h.estimatedValue as number) ?? 0,
        }),
    );

    // Run financial-modeling agent if available
    let financialModel = {
      roi_percentage: 0,
      npv_amount: 0,
      payback_months: 0,
      cost_breakdown: {} as Record<string, number>,
    };

    if (factory.hasFabricAgent("financial-modeling")) {
      const finAgent = factory.create("financial-modeling", organizationId);
      const finResult = await finAgent.execute({
        workspace_id: executionId,
        organization_id: organizationId,
        user_id: "system",
        lifecycle_stage: finAgent.lifecycleStage as LifecycleContext["lifecycle_stage"],
        workspace_data: {},
        user_inputs: { query: JSON.stringify(hypotheses) },
        metadata: { valueCaseId: executionId },
      });
      agentContributions["financial-modeling"] = finResult;
      totalTokens += finResult.metadata.token_usage?.total_tokens ?? 0;

      const fm = (finResult.result as Record<string, unknown>)?.financialModel as
        | Record<string, unknown>
        | undefined;
      if (fm) {
        financialModel = {
          roi_percentage: (fm.roi_percentage as number) ?? 0,
          npv_amount: (fm.npv_amount as number) ?? 0,
          payback_months: (fm.payback_months as number) ?? 0,
          cost_breakdown: (fm.cost_breakdown as Record<string, number>) ?? {},
        };
      }
    }

    // Validate the full loop result
    const loopContract = LoopResultSchema.safeParse({
      valueCaseId: executionId,
      tenantId: organizationId,
      hypotheses,
      valueTree: null,
      evidenceBundle: null,
      narrative: null,
      objections: [],
      revisionCount: 1,
      finalState: "DRAFT",
      success: true,
    });

    const totalLatencyMs = Date.now() - startTime;
    const oppData = opportunityResult.result as Record<string, unknown> | undefined;

    return {
      value_case_id: executionId,
      company_profile: {
        company_name: (oppData?.companyName as string) ?? "Unknown",
        industry: (oppData?.industry as string) ?? "Unknown",
      },
      value_maps:
        (oppData?.valueMaps as AgentFabricResult["value_maps"]) ?? [],
      kpi_hypotheses: hypotheses.map((h) => ({
        kpi_name: h.description,
        target_value: h.estimatedValue ?? 0,
      })),
      financial_model: financialModel,
      assumptions:
        (oppData?.assumptions as AgentFabricResult["assumptions"]) ?? [],
      quality_score: ((opportunityResult.metadata as unknown as Record<string, unknown>)?.qualityScore as number) ?? 0,
      execution_metadata: {
        execution_id: executionId,
        iteration_count: 1,
        total_tokens: totalTokens,
        total_latency_ms: totalLatencyMs,
        agent_contributions: agentContributions,
        loop_contract_valid: loopContract.success,
      },
    };
  }
}
