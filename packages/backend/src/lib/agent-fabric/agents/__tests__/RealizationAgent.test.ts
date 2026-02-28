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

import { RealizationAgent } from "../RealizationAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "realization-agent",
    name: "realization",
    type: "realization" as AgentConfig["type"],
    lifecycle_stage: "realization",
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
    lifecycle_stage: "realization",
    workspace_data: {},
    user_inputs: { query: "Analyze KPI realization for cloud migration" },
    ...overrides,
  };
}

function makeLLMResponse(): string {
  return JSON.stringify({
    kpi_variances: [
      {
        kpi_name: "Infrastructure cost reduction",
        target_value: 300000,
        actual_value: 270000,
        variance_percent: -10,
        unit: "usd",
        status: "at_risk",
        trend: "improving",
        explanation: "Savings are 10% below target but trending upward.",
      },
      {
        kpi_name: "Labor efficiency",
        target_value: 200000,
        actual_value: 220000,
        variance_percent: 10,
        unit: "usd",
        status: "exceeded",
        trend: "stable",
        explanation: "Exceeded target by 10% due to automation gains.",
      },
      {
        kpi_name: "Migration timeline",
        target_value: 6,
        actual_value: 8,
        variance_percent: -33,
        unit: "months",
        status: "off_track",
        trend: "declining",
        explanation: "Migration delayed by 2 months due to legacy system complexity.",
      },
    ],
    overall_realization_percent: 72,
    risk_flags: [
      {
        severity: "high",
        category: "timeline",
        description: "Migration timeline slippage threatens cost savings window.",
        affected_kpis: ["Infrastructure cost reduction", "Migration timeline"],
        recommended_action: "Allocate additional migration resources.",
      },
    ],
    interventions: [
      {
        title: "Accelerate legacy system migration",
        priority: "high",
        description: "Add dedicated migration team for remaining legacy systems.",
        expected_impact: "Reduce timeline by 1 month, recover $30K in savings.",
        effort_estimate: "2 FTEs for 4 weeks",
        affected_kpis: ["Infrastructure cost reduction", "Migration timeline"],
      },
    ],
    trend_summary:
      "Overall positive trajectory with labor efficiency exceeding targets. Infrastructure savings at risk due to timeline delays.",
    implementation_status: "implementing",
    confidence: 0.78,
  });
}

function makeKPITargetMemories() {
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
        baseline_value: 1000000,
        target_value: 700000,
        unit: "usd",
        timeframe_months: 12,
        organization_id: "org-1",
      },
    },
  ];
}

function mockLLMComplete(
  llmGateway: InstanceType<typeof LLMGateway>,
  content: string,
) {
  vi.mocked(llmGateway.complete).mockResolvedValue({
    id: "resp-1",
    model: "test-model",
    content,
    finish_reason: "stop",
    usage: { prompt_tokens: 500, completion_tokens: 800, total_tokens: 1300 },
  } as any);
}

// --- Tests ---

describe("RealizationAgent", () => {
  let agent: RealizationAgent;
  let llmGateway: InstanceType<typeof LLMGateway>;
  let memorySystem: InstanceType<typeof MemorySystem>;

  beforeEach(() => {
    llmGateway = new LLMGateway("custom");
    memorySystem = new MemorySystem({} as any);
    const circuitBreaker = new CircuitBreaker() as any;

    agent = new RealizationAgent(
      makeConfig(),
      "org-1",
      memorySystem,
      llmGateway,
      circuitBreaker,
    );
  });

  it("returns failure when no KPI targets exist in memory", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue([]);

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("No KPI targets found");
  });

  it("returns failure when context is invalid", async () => {
    const ctx = makeContext({ organization_id: "" });

    await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
  });

  it("executes end-to-end with valid LLM response", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("success");
    expect(result.agent_type).toBe("realization");
    expect(result.lifecycle_stage).toBe("realization");
    expect(result.result.kpi_variances).toBeDefined();
    expect(result.result.overall_realization_percent).toBe(72);
    expect(result.result.kpi_count).toBe(3);
    expect(result.result.off_track_count).toBe(1);
  });

  it("stores realization results in memory with tenant isolation", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());
    mockLLMComplete(llmGateway, makeLLMResponse());

    await agent.execute(makeContext());

    expect(memorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      "ws-1",
      "realization",
      "semantic",
      expect.stringContaining("Realization: 72% achieved"),
      expect.objectContaining({
        organization_id: "org-1",
        realization_data: true,
        off_track_count: 1,
      }),
      "org-1",
    );
  });

  it("returns failure when LLM call fails", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());
    vi.mocked(llmGateway.complete).mockRejectedValue(new Error("LLM timeout"));

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("Realization analysis generation failed");
  });

  it("produces SDUI sections with KPI variance data", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    const sections = result.result.sdui_sections as Array<Record<string, unknown>>;
    expect(sections.length).toBeGreaterThanOrEqual(2);

    const componentTypes = sections.map(s => s.component);
    expect(componentTypes).toContain("AgentResponseCard");
    expect(componentTypes).toContain("KPIForm");
  });

  it("generates warnings for critical risks", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());

    const response = JSON.parse(makeLLMResponse());
    response.risk_flags[0].severity = "critical";
    mockLLMComplete(llmGateway, JSON.stringify(response));

    const result = await agent.execute(makeContext());

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toContain("critical risk");
  });

  it("generates warnings when majority of KPIs are off track", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());

    const response = JSON.parse(makeLLMResponse());
    // Make all 3 KPIs off_track
    response.kpi_variances.forEach((kv: Record<string, unknown>) => {
      kv.status = "off_track";
    });
    mockLLMComplete(llmGateway, JSON.stringify(response));

    const result = await agent.execute(makeContext());

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes("off track"))).toBe(true);
  });

  it("includes risk flags and interventions in SDUI when present", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeKPITargetMemories());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    const sections = result.result.sdui_sections as Array<Record<string, unknown>>;
    const componentTypes = sections.map(s => s.component);
    expect(componentTypes).toContain("RiskFlagList");
    expect(componentTypes).toContain("InterventionList");
  });
});
