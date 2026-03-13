/**
 * AgentFabric — Root entry point for value case generation
 *
 * This module is the public API surface for agent-based value case generation.
 * It delegates to the AgentFactory + HypothesisLoop pipeline when available,
 * and falls back to a clearly-gated stub for local development only.
 *
 * IMPORTANT: The stub path is blocked in production and requires an explicit
 * environment variable to enable in non-production environments.
 */
import {
  LoopResultSchema,
  ValueHypothesisSchema,
} from "./agents/orchestration/index.js";
import { logger } from "./logger.js";
import type { AgentFactoryDeps } from "./agent-fabric/AgentFactory.js";
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
  /** When true, the result came from the stub path, not real agents */
  is_stub: boolean;
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
   * Inject real agent factory dependencies. When set, processUserInput
   * delegates to the full agent pipeline instead of the stub.
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
   * When factoryDeps are injected, this delegates to the real agent pipeline.
   * Otherwise, it falls back to the development stub (blocked in production).
   */
  async processUserInput(
    userInput: string,
    organizationId?: string,
  ): Promise<AgentFabricResult> {
    if (this.factoryDeps && organizationId) {
      return this.executeWithAgentPipeline(userInput, organizationId);
    }

    return this.executeStub(userInput);
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
      input: userInput,
      valueCaseId: executionId,
      organizationId,
      sessionId: executionId,
    });
    agentContributions.opportunity = opportunityResult;
    totalTokens += (opportunityResult.metadata as Record<string, number>)?.tokensUsed ?? 0;

    // Validate hypotheses against the LoopResult contract
    const rawHypotheses = (opportunityResult.data as Record<string, unknown>)?.hypotheses;
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
        input: JSON.stringify(hypotheses),
        valueCaseId: executionId,
        organizationId,
        sessionId: executionId,
      });
      agentContributions["financial-modeling"] = finResult;
      totalTokens += (finResult.metadata as Record<string, number>)?.tokensUsed ?? 0;

      const fm = (finResult.data as Record<string, unknown>)?.financialModel as
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
    const oppData = opportunityResult.data as Record<string, unknown> | undefined;

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
      quality_score: (opportunityResult.metadata as Record<string, number>)?.qualityScore ?? 0,
      execution_metadata: {
        execution_id: executionId,
        iteration_count: 1,
        total_tokens: totalTokens,
        total_latency_ms: totalLatencyMs,
        agent_contributions: agentContributions,
        loop_contract_valid: loopContract.success,
        is_stub: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Development stub (gated)
  // --------------------------------------------------------------------------

  private async executeStub(userInput: string): Promise<AgentFabricResult> {
    if (isProductionBuild()) {
      throw new Error(
        "AgentFabric stub is disabled in production. " +
          "Inject factoryDeps via setFactoryDeps() for real agent execution.",
      );
    }

    if (process.env.AGENT_FABRIC_ALLOW_STUB !== "true") {
      throw new Error(
        "AgentFabric stub requires AGENT_FABRIC_ALLOW_STUB=true " +
          "for local non-production usage. " +
          "In production, inject factoryDeps via setFactoryDeps().",
      );
    }

    logger.warn("AgentFabric executing in STUB mode", {
      input_length: userInput.length,
    });

    const hypothesis = ValueHypothesisSchema.parse({
      id: "hyp-stub-1",
      description: userInput,
      confidence: 0.8,
      category: "opportunity",
      estimatedValue: 100000,
    });

    const loopContract = LoopResultSchema.safeParse({
      valueCaseId: "value-case-stub",
      tenantId: "stub-tenant",
      hypotheses: [hypothesis],
      valueTree: null,
      evidenceBundle: null,
      narrative: null,
      objections: [],
      revisionCount: 0,
      finalState: "DRAFT",
      success: true,
    });

    return {
      value_case_id: "value-case-stub",
      company_profile: {
        company_name: "Prospect (stub)",
        industry: "Unknown",
      },
      value_maps: [],
      kpi_hypotheses: [
        { kpi_name: "Conversion Rate", target_value: 5 },
      ],
      financial_model: {
        roi_percentage: 15,
        npv_amount: 1500000,
        payback_months: 12,
        cost_breakdown: {
          implementation: 500000,
          operations: 250000,
        },
      },
      assumptions: [],
      quality_score: 12,
      execution_metadata: {
        execution_id: "stub-exec",
        iteration_count: 1,
        total_tokens: 0,
        total_latency_ms: 0,
        agent_contributions: { opportunity: hypothesis },
        loop_contract_valid: loopContract.success,
        is_stub: true,
      },
    };
  }
}

function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}
