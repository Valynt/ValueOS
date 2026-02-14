import { LoopResultSchema, ValueHypothesisSchema } from "@valueos/agents/orchestration";

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
  execution_metadata: {
    execution_id: string;
    iteration_count: number;
    total_tokens: number;
    total_latency_ms: number;
    agent_contributions: Record<string, unknown>;
    loop_contract_valid: boolean;
  };
}

export class AgentFabric {
  constructor(
    private readonly _supabaseUrl: string,
    private readonly _supabaseAnonKey: string,
    private readonly _provider: string,
  ) {}

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async processUserInput(userInput: string): Promise<AgentFabricResult> {
    if (isProductionBuild() || process.env.AGENT_FABRIC_ALLOW_STUB !== "true") {
      throw new Error(
        "AgentFabric stub is disabled. Set AGENT_FABRIC_ALLOW_STUB=true only for local non-production usage.",
      );
    }

    const hypothesis = ValueHypothesisSchema.parse({
      id: "hyp-1",
      description: userInput,
      confidence: 0.8,
      category: "opportunity",
      estimatedValue: 100000,
    });

    const loopContract = LoopResultSchema.safeParse({
      valueCaseId: "value-case-preview",
      tenantId: "preview-tenant",
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
      value_case_id: "value-case-preview",
      company_profile: {
        company_name: "Prospect",
        industry: "Unknown",
      },
      value_maps: [],
      kpi_hypotheses: [
        {
          kpi_name: "Conversion Rate",
          target_value: 5,
        },
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
        execution_id: "preview-exec",
        iteration_count: 1,
        total_tokens: 0,
        total_latency_ms: 0,
        agent_contributions: {
          opportunity: hypothesis,
        },
        loop_contract_valid: loopContract.success,
      },
    };
  }
}

function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}
