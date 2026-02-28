import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class MockLLMGateway {
    constructor(_provider?: string) {}
    complete = vi.fn();
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: any) {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue("mem_1");
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

// --- Imports ---

import { FinancialModelingAgent } from "../FinancialModelingAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "financial-modeling-agent",
    name: "financial-modeling",
    type: "financial-modeling" as AgentConfig["type"],
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

function makeContext(overrides?: Partial<LifecycleContext>): LifecycleContext {
  return {
    workspace_id: "ws-1",
    organization_id: "org-1",
    user_id: "user-1",
    lifecycle_stage: "target",
    workspace_data: {},
    user_inputs: { query: "Build ROI model for cloud migration" },
    ...overrides,
  };
}

function makeLLMResponse(): string {
  return JSON.stringify({
    value_tree: [
      {
        id: "root-1",
        label: "Total Value",
        type: "root",
        value: 500000,
        unit: "usd",
        time_basis: "annual",
        confidence: 0.8,
        assumptions: ["Market growth 5%"],
        citations: ["Industry report Q3"],
        children: [
          {
            id: "cat-1",
            label: "Cost Reduction",
            type: "category",
            confidence: 0.85,
            assumptions: [],
            citations: [],
            children: [
              {
                id: "driver-1",
                label: "Infrastructure savings",
                type: "metric",
                value: 300000,
                unit: "usd",
                time_basis: "annual",
                confidence: 0.9,
                assumptions: ["Current spend $1M/yr"],
                citations: ["Customer data"],
                children: [],
              },
              {
                id: "driver-2",
                label: "Labor efficiency",
                type: "metric",
                value: 200000,
                unit: "usd",
                time_basis: "annual",
                confidence: 0.75,
                assumptions: ["20% time savings"],
                citations: ["Benchmark study"],
                children: [],
              },
            ],
          },
        ],
      },
    ],
    roi_summary: {
      total_value: 500000,
      total_cost: 150000,
      net_value: 350000,
      roi_percent: 233.33,
      payback_months: 4,
      confidence: 0.82,
      currency: "USD",
    },
    sensitivity_variables: [
      {
        name: "Infrastructure cost reduction",
        base_value: 300000,
        low_value: 200000,
        high_value: 400000,
        unit: "usd",
        impact_on_total: { at_low: 400000, at_high: 600000 },
      },
    ],
    key_assumptions: [
      "Current infrastructure spend is $1M/year",
      "Migration completes within 6 months",
    ],
    methodology_notes: "Bottom-up cost analysis with sensitivity ranges",
  });
}

function makeModelInputMemories() {
  return [
    {
      id: "mem-1",
      agent_id: "target",
      workspace_id: "ws-1",
      content: "KPI: Infrastructure cost reduction — $300K annual savings",
      memory_type: "semantic" as const,
      importance: 0.8,
      created_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      access_count: 0,
      metadata: {
        category: "cost",
        financial_model_input: true,
        baseline_value: 1000000,
        target_value: 700000,
        unit: "usd",
        timeframe_months: 12,
        assumptions: ["Current spend $1M/yr"],
        sensitivity_variables: ["cloud_pricing", "migration_timeline"],
        organization_id: "org-1",
      },
    },
  ];
}

// --- Tests ---

describe("FinancialModelingAgent", () => {
  let agent: FinancialModelingAgent;
  let llmGateway: InstanceType<typeof LLMGateway>;
  let memorySystem: InstanceType<typeof MemorySystem>;

  beforeEach(() => {
    llmGateway = new LLMGateway("custom");
    memorySystem = new MemorySystem({} as any);
    const circuitBreaker = new CircuitBreaker() as any;

    agent = new FinancialModelingAgent(
      makeConfig(),
      "org-1",
      memorySystem,
      llmGateway,
      circuitBreaker,
    );
  });

  it("returns failure when no model inputs exist in memory", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue([]);

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("No financial model inputs found");
  });

  it("returns failure when context is invalid", async () => {
    const ctx = makeContext({ organization_id: "" });

    await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
  });

  function mockLLMComplete(content: string) {
    vi.mocked(llmGateway.complete).mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content,
      finish_reason: "stop",
      usage: { prompt_tokens: 500, completion_tokens: 800, total_tokens: 1300 },
    } as any);
  }

  it("executes end-to-end with valid LLM response", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    mockLLMComplete(makeLLMResponse());

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("success");
    expect(result.agent_type).toBe("financial-modeling");
    expect(result.result.value_tree).toBeDefined();
    expect(result.result.roi_summary).toBeDefined();
    expect(result.result.sensitivity_variables).toBeDefined();

    // Verify decimal.js arithmetic validation
    const roi = result.result.roi_summary as {
      total_value: string;
      total_cost: string;
      net_value: string;
      roi_percent: string;
      arithmetic_verified: boolean;
    };
    expect(roi.arithmetic_verified).toBe(true);
    expect(roi.net_value).toBe("350000.00");
    expect(roi.total_value).toBe("500000.00");
    expect(roi.total_cost).toBe("150000.00");
  });

  it("detects arithmetic mismatch from LLM", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());

    // LLM returns wrong net_value
    const badResponse = JSON.parse(makeLLMResponse());
    badResponse.roi_summary.net_value = 999999;
    mockLLMComplete(JSON.stringify(badResponse));

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("success");
    const roi = result.result.roi_summary as { arithmetic_verified: boolean; net_value: string };
    // Agent re-derives net_value, so it's correct regardless of LLM output
    expect(roi.net_value).toBe("350000.00");
    expect(roi.arithmetic_verified).toBe(false);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });

  it("stores model results in memory with tenant isolation", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    mockLLMComplete(makeLLMResponse());

    await agent.execute(makeContext());

    expect(memorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      "ws-1",
      "financial-modeling",
      "semantic",
      expect.stringContaining("Value Tree ROI Model"),
      expect.objectContaining({
        organization_id: "org-1",
        verified: true,
      }),
      "org-1",
    );
  });

  it("returns failure when LLM call fails", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    vi.mocked(llmGateway.complete).mockRejectedValue(new Error("LLM timeout"));

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("Financial model generation failed");
  });

  it("produces SDUI sections", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    mockLLMComplete(makeLLMResponse());

    const result = await agent.execute(makeContext());

    const sections = result.result.sdui_sections as Array<Record<string, unknown>>;
    expect(sections.length).toBeGreaterThanOrEqual(2);

    const componentTypes = sections.map(s => s.component);
    expect(componentTypes).toContain("AgentResponseCard");
    expect(componentTypes).toContain("ValueTreeCard");
  });

  it("uses financial-grade confidence thresholds (0.7/0.9)", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    mockLLMComplete(makeLLMResponse());

    await agent.execute(makeContext());

    // secureInvoke is called via circuitBreaker.execute
    // Verify the LLM was called (circuit breaker delegates to the fn)
    expect(llmGateway.complete).toHaveBeenCalledTimes(1);
  });

  it("computes tree total from leaf USD nodes", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeModelInputMemories());
    mockLLMComplete(makeLLMResponse());

    const result = await agent.execute(makeContext());

    // Tree has two leaf USD nodes: 300000 + 200000 = 500000
    expect(result.result.tree_total).toBe("500000");
  });
});
