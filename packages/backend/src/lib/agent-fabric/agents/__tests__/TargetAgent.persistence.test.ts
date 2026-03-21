/**
 * TargetAgent persistence tests
 *
 * Verifies that TargetAgent calls ValueTreeRepository.replaceNodesForCase
 * when value_case_id is present in context.user_inputs, and skips persistence
 * when it is absent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = vi.fn();
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue("mem_1");
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../services/reasoning/AdvancedCausalEngine.js", () => ({
  getAdvancedCausalEngine: () => ({
    inferCausalRelationship: vi.fn().mockResolvedValue({
      action: "reduce_costs",
      targetKpi: "cost",
      effect: { direction: "decrease", magnitude: 0.2, confidence: 0.8 },
      confidence: 0.8,
      evidence: [],
      networkInference: null,
    }),
  }),
}));

const mockReplaceNodes = vi.fn().mockResolvedValue([]);
vi.mock("../../../../repositories/ValueTreeRepository.js", () => ({
  ValueTreeRepository: class {
    replaceNodesForCase = mockReplaceNodes;
    getNodesForCase = vi.fn().mockResolvedValue([]);
    deleteNodesForCase = vi.fn().mockResolvedValue(undefined);
  },
}));

// --- Imports ---

import type { AgentConfig, LifecycleContext } from "../../../../types/agent.js";
import { CircuitBreaker } from "../../CircuitBreaker.js";
import { LLMGateway } from "../../LLMGateway.js";
import { MemorySystem } from "../../MemorySystem.js";
import { TargetAgent } from "../TargetAgent.js";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "target-agent",
    name: "target",
    type: "target" as AgentConfig["type"],
    lifecycle_stage: "target",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: {
      timeout_seconds: 30,
      max_retries: 3,
      retry_delay_ms: 1000,
      enable_caching: false,
      enable_telemetry: false,
    },
    constraints: {
      max_input_tokens: 4096,
      max_output_tokens: 4096,
      allowed_actions: [],
      forbidden_actions: [],
      required_permissions: [],
    },
  };
}

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123",
    organization_id: "org-456",
    user_id: "user-789",
    lifecycle_stage: "target",
    workspace_data: {},
    user_inputs: { query: "Generate KPI targets", value_case_id: "case-abc" },
    ...overrides,
  };
}

const VALID_LLM_RESPONSE = JSON.stringify({
  kpi_definitions: [
    {
      id: "kpi-1",
      name: "Cost Reduction",
      description: "Reduce procurement costs",
      unit: "currency",
      measurement_method: "Monthly spend report",
      baseline: { value: 1000000, source: "Finance", as_of_date: "2024-01-01" },
      target: { value: 800000, timeframe_months: 12, confidence: 0.8 },
      category: "cost",
      hypothesis_id: "hyp-1",
    },
  ],
  value_driver_tree: [
    {
      id: "vd-1",
      label: "Cost Savings",
      value: "$200K",
      type: "root",
      status: "active",
      children: [
        { id: "vd-2", label: "Procurement", value: "$120K", type: "branch", status: "active", children: [] },
        { id: "vd-3", label: "Operations", value: "$80K", type: "leaf", status: "active", children: [] },
      ],
    },
  ],
  financial_model_inputs: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_title: "Cost Reduction",
      category: "cost",
      baseline_value: 1000000,
      target_value: 800000,
      unit: "usd",
      timeframe_months: 12,
      assumptions: ["Vendor consolidation feasible"],
      sensitivity_variables: ["discount_rate"],
    },
  ],
  measurement_plan: "Monthly tracking via finance dashboard",
  risks: [{ description: "Vendor resistance", likelihood: "medium", mitigation: "Early engagement" }],
});

// --- Tests ---

describe("TargetAgent persistence", () => {
  let agent: TargetAgent;
  let mockLLMGateway: InstanceType<typeof LLMGateway>;
  let mockMemorySystem: InstanceType<typeof MemorySystem>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMGateway = new LLMGateway();
    mockMemorySystem = new MemorySystem({} as never);
    const mockCircuitBreaker = new CircuitBreaker();

    agent = new TargetAgent(
      makeConfig(),
      "org-456",
      mockMemorySystem as never,
      mockLLMGateway as never,
      mockCircuitBreaker as never,
    );

    // Seed memory with a hypothesis that passes TargetAgent's filter
    // (requires verified=true, category, AND estimated_impact)
    (mockMemorySystem.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "mem-1",
        content: "Supply chain cost reduction opportunity",
        metadata: {
          verified: true,
          category: "cost_reduction",
          confidence: 0.8,
          estimated_impact: { low: 500000, high: 1200000, unit: "usd", timeframe_months: 12 },
        },
      },
    ]);

    // LLM returns valid target analysis
    (mockLLMGateway.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content: VALID_LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 },
    });
  });

  it("calls replaceNodesForCase with flattened tree when value_case_id is present", async () => {
    const ctx = makeContext();
    await agent.execute(ctx);

    expect(mockReplaceNodes).toHaveBeenCalledOnce();
    const [caseId, orgId, nodes] = mockReplaceNodes.mock.calls[0] as [string, string, unknown[]];
    expect(caseId).toBe("case-abc");
    expect(orgId).toBe("org-456");
    // Root + 2 children = 3 nodes
    expect(nodes).toHaveLength(3);
  });

  it("sets source_agent to 'target' on all nodes", async () => {
    await agent.execute(makeContext());

    const nodes = mockReplaceNodes.mock.calls[0][2] as Array<{ source_agent: string }>;
    expect(nodes.every((n) => n.source_agent === "target")).toBe(true);
  });

  it("preserves parent_node_key for child nodes", async () => {
    await agent.execute(makeContext());

    const nodes = mockReplaceNodes.mock.calls[0][2] as Array<{
      node_key: string;
      parent_node_key?: string;
    }>;
    const root = nodes.find((n) => n.node_key === "vd-1");
    const child = nodes.find((n) => n.node_key === "vd-2");
    expect(root?.parent_node_key).toBeUndefined();
    expect(child?.parent_node_key).toBe("vd-1");
  });

  it("skips persistence when value_case_id is absent", async () => {
    const ctx = makeContext({ user_inputs: { query: "Generate KPI targets" } });
    await agent.execute(ctx);

    expect(mockReplaceNodes).not.toHaveBeenCalled();
  });

  it("does not throw when persistence fails (non-fatal)", async () => {
    mockReplaceNodes.mockRejectedValueOnce(new Error("DB unavailable"));

    const ctx = makeContext();
    // Should complete without throwing
    await expect(agent.execute(ctx)).resolves.toBeDefined();
  });
});
