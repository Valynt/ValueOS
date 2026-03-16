import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class MockLLMGateway {
    constructor(_provider?: string) {}
    complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({ result: "ok", hallucination_check: false }),
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: unknown) {}
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

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: {
    isKilled: vi.fn().mockResolvedValue(false),
  },
}));

// --- Imports ---

import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { BaseAgent } from "../BaseAgent";
import { agentKillSwitchService } from "../../../../services/agents/AgentKillSwitchService.js";

const killSwitchMock = vi.mocked(agentKillSwitchService);

// --- Concrete subclass ---

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "opportunity";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({ test: true }, "success");
  }

  async invokeSecure<T>(
    sessionId: string,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      trackPrediction?: boolean;
      confidenceThresholds?: { low: number; high: number };
      context?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ) {
    return this.secureInvoke(sessionId, prompt, schema, options);
  }
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "test-agent",
    name: "TestAgent",
    type: "opportunity" as never,
    lifecycle_stage: "opportunity",
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
    ...overrides,
  };
}

const schema = z.object({
  result: z.string(),
  hallucination_check: z.boolean().optional(),
});

// --- Tests ---

describe("BaseAgent kill switch", () => {
  let agent: TestAgent;
  let mockCircuitBreaker: InstanceType<typeof CircuitBreaker> & {
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    killSwitchMock.isKilled.mockResolvedValue(false);

    const mockLLMGateway = new LLMGateway("custom");
    const mockMemorySystem = new MemorySystem({} as never);
    mockCircuitBreaker = new CircuitBreaker() as typeof mockCircuitBreaker;

    agent = new TestAgent(
      makeConfig(),
      "org-123",
      mockMemorySystem,
      mockLLMGateway,
      mockCircuitBreaker,
    );
  });

  it("executes normally when kill switch is off", async () => {
    const result = await agent.invokeSecure("session-1", "test prompt", schema);
    expect(result.result).toBe("ok");
  });

  it("throws when kill switch is on", async () => {
    killSwitchMock.isKilled.mockResolvedValue(true);
    await expect(
      agent.invokeSecure("session-1", "test prompt", schema),
    ).rejects.toThrow("disabled by kill switch");
  });

  it("calls isKilled with the agent name", async () => {
    await agent.invokeSecure("session-1", "test prompt", schema);
    expect(killSwitchMock.isKilled).toHaveBeenCalledWith("TestAgent");
  });

  it("does not call circuitBreaker.execute when killed", async () => {
    killSwitchMock.isKilled.mockResolvedValue(true);
    await expect(
      agent.invokeSecure("session-1", "test prompt", schema),
    ).rejects.toThrow("disabled by kill switch");
    expect(mockCircuitBreaker.execute).not.toHaveBeenCalled();
  });
});
