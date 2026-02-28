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

import { ExpansionAgent } from "../ExpansionAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, LifecycleContext } from "../../../../types/agent";

// --- Helpers ---

function makeConfig(): AgentConfig {
  return {
    id: "expansion-agent",
    name: "expansion",
    type: "expansion" as AgentConfig["type"],
    lifecycle_stage: "expansion",
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
    lifecycle_stage: "expansion",
    workspace_data: {},
    user_inputs: { query: "Find expansion opportunities for cloud migration" },
    ...overrides,
  };
}

function makeLLMResponse(): string {
  return JSON.stringify({
    target_contexts: [
      {
        context_name: "EMEA Data Centers",
        similarity_score: 0.85,
        transferable_elements: [
          "Cloud migration playbook",
          "Automation scripts",
          "Vendor contracts",
        ],
        adaptation_requirements: [
          "GDPR compliance adjustments",
          "Local vendor onboarding",
        ],
        estimated_value: 450000,
        estimated_effort: "3 months, 4 FTEs",
        risk_level: "medium",
      },
      {
        context_name: "APAC Branch Offices",
        similarity_score: 0.65,
        transferable_elements: [
          "Cloud migration playbook",
          "Monitoring dashboards",
        ],
        adaptation_requirements: [
          "Latency optimization for APAC regions",
          "Local language support",
          "Different cloud provider in some regions",
        ],
        estimated_value: 280000,
        estimated_effort: "5 months, 3 FTEs",
        risk_level: "high",
      },
    ],
    scaling_factors: [
      {
        name: "Standardized migration playbook",
        type: "enabler",
        impact: "high",
        description: "Documented process reduces ramp-up time by 60%.",
      },
      {
        name: "Regional compliance requirements",
        type: "constraint",
        impact: "medium",
        description: "Each region has different data residency requirements.",
        mitigation: "Pre-assess compliance per region before starting.",
      },
    ],
    replication_readiness_percent: 72,
    total_expansion_value: 730000,
    recommended_sequence: ["EMEA Data Centers", "APAC Branch Offices"],
    key_risks: [
      "Regional compliance delays",
      "Vendor availability in APAC",
    ],
    playbook_summary:
      "Start with EMEA (highest similarity). Apply migration playbook with GDPR adjustments. Use EMEA learnings to de-risk APAC rollout.",
    confidence: 0.74,
  });
}

function makeRealizationMemory() {
  return [
    {
      id: "mem-r1",
      agent_id: "realization",
      workspace_id: "ws-1",
      content:
        "Realization: 72% achieved. 3 KPIs tracked, 1 off-track, 1 at-risk.",
      memory_type: "semantic" as const,
      importance: 0.78,
      created_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      access_count: 0,
      metadata: {
        overall_realization_percent: 72,
        implementation_status: "implementing",
        kpi_count: 3,
        off_track_count: 1,
        at_risk_count: 1,
        realization_data: true,
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
    usage: { prompt_tokens: 600, completion_tokens: 900, total_tokens: 1500 },
  } as any);
}

// --- Tests ---

describe("ExpansionAgent", () => {
  let agent: ExpansionAgent;
  let llmGateway: InstanceType<typeof LLMGateway>;
  let memorySystem: InstanceType<typeof MemorySystem>;

  beforeEach(() => {
    llmGateway = new LLMGateway("custom");
    memorySystem = new MemorySystem({} as any);
    const circuitBreaker = new CircuitBreaker() as any;

    agent = new ExpansionAgent(
      makeConfig(),
      "org-1",
      memorySystem,
      llmGateway,
      circuitBreaker,
    );
  });

  it("returns failure when no realization data exists in memory", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue([]);

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("No realization data found");
  });

  it("returns failure when context is invalid", async () => {
    const ctx = makeContext({ organization_id: "" });

    await expect(agent.execute(ctx)).rejects.toThrow("Invalid input context");
  });

  it("executes end-to-end with valid LLM response", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("success");
    expect(result.agent_type).toBe("expansion");
    expect(result.lifecycle_stage).toBe("expansion");
    expect(result.result.target_contexts).toBeDefined();
    expect(result.result.context_count).toBe(2);
    expect(result.result.replication_readiness_percent).toBe(72);
    expect(result.result.total_expansion_value).toBe(730000);
  });

  it("stores expansion results in memory with tenant isolation", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    mockLLMComplete(llmGateway, makeLLMResponse());

    await agent.execute(makeContext());

    expect(memorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      "ws-1",
      "expansion",
      "semantic",
      expect.stringContaining("Expansion Plan"),
      expect.objectContaining({
        organization_id: "org-1",
        expansion_data: true,
        context_count: 2,
      }),
      "org-1",
    );
  });

  it("returns failure when LLM call fails", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    vi.mocked(llmGateway.complete).mockRejectedValue(new Error("LLM timeout"));

    const result = await agent.execute(makeContext());

    expect(result.status).toBe("failure");
    expect(result.result.error).toContain("Expansion analysis generation failed");
  });

  it("produces SDUI sections with context comparison", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    const sections = result.result.sdui_sections as Array<Record<string, unknown>>;
    expect(sections.length).toBeGreaterThanOrEqual(2);

    const componentTypes = sections.map(s => s.component);
    expect(componentTypes).toContain("AgentResponseCard");
    expect(componentTypes).toContain("KPIForm");
    expect(componentTypes).toContain("ScalingFactorAnalysis");
  });

  it("includes recommended sequence in output", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    const sequence = result.result.recommended_sequence as string[];
    expect(sequence).toEqual(["EMEA Data Centers", "APAC Branch Offices"]);
  });

  it("includes reasoning with expansion value", async () => {
    vi.mocked(memorySystem.retrieve).mockResolvedValue(makeRealizationMemory());
    mockLLMComplete(llmGateway, makeLLMResponse());

    const result = await agent.execute(makeContext());

    expect(result.reasoning).toContain("2 expansion contexts");
    expect(result.reasoning).toContain("730,000");
  });
});
