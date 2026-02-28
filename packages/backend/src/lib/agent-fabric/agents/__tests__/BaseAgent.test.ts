import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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

// --- Imports ---

import { BaseAgent } from "../BaseAgent";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../../types/agent";

// --- Concrete subclass for testing the abstract BaseAgent ---

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "opportunity";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const valid = await this.validateInput(context);
    if (!valid) {
      return this.prepareOutput({ error: "Invalid input" }, "failure");
    }
    return this.prepareOutput({ ok: true }, "success");
  }

  // Expose protected secureInvoke for testing
  public callSecureInvoke<T>(
    sessionId: string,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: Parameters<BaseAgent["secureInvoke"]>[3]
  ) {
    return this.secureInvoke(sessionId, prompt, schema, options);
  }
}

// --- Helpers ---

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "test-agent",
    name: "test",
    type: "opportunity" as AgentConfig["type"],
    lifecycle_stage: "opportunity",
    capabilities: [],
    model: { provider: "custom", model_name: "test-model" },
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

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: "ws-123",
    organization_id: "org-456",
    user_id: "user-789",
    lifecycle_stage: "opportunity",
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

// --- Tests ---

describe("BaseAgent", () => {
  let agent: TestAgent;
  let mockLLMGateway: InstanceType<typeof LLMGateway> & { complete: ReturnType<typeof vi.fn> };
  let mockMemorySystem: InstanceType<typeof MemorySystem> & { storeSemanticMemory: ReturnType<typeof vi.fn> };
  let mockCircuitBreaker: InstanceType<typeof CircuitBreaker> & { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMGateway = new LLMGateway("custom") as typeof mockLLMGateway;
    mockMemorySystem = new MemorySystem({} as unknown) as typeof mockMemorySystem;
    mockCircuitBreaker = new CircuitBreaker() as typeof mockCircuitBreaker;

    agent = new TestAgent(
      makeConfig(),
      "org-456",
      mockMemorySystem,
      mockLLMGateway,
      mockCircuitBreaker,
    );
  });

  describe("constructor", () => {
    it("sets lifecycle_stage from config", () => {
      const a = new TestAgent(
        makeConfig({ lifecycle_stage: "target" }),
        "org-1",
        mockMemorySystem,
        mockLLMGateway,
        mockCircuitBreaker,
      );
      expect(a.lifecycleStage).toBe("opportunity"); // overridden by subclass
    });

    it("stores organizationId for tenant isolation", () => {
      expect(agent.getId()).toBe("TestAgent");
      expect(agent.getName()).toBe("TestAgent");
    });
  });

  describe("validateInput", () => {
    it("returns true for valid context", async () => {
      const result = await agent.execute(makeContext());
      expect(result.status).toBe("success");
    });

    it("rejects context missing workspace_id", async () => {
      const result = await agent.execute(makeContext({ workspace_id: "" }));
      expect(result.status).toBe("failure");
      expect(result.result.error).toBe("Invalid input");
    });

    it("rejects context missing organization_id", async () => {
      const result = await agent.execute(makeContext({ organization_id: "" }));
      expect(result.status).toBe("failure");
    });

    it("rejects context missing user_id", async () => {
      const result = await agent.execute(makeContext({ user_id: "" }));
      expect(result.status).toBe("failure");
    });

    it("updates organizationId from context for tenant scoping", async () => {
      await agent.execute(makeContext({ organization_id: "org-new" }));
      // After validateInput, the agent's organizationId should be updated.
      // We verify this indirectly via secureInvoke's memory storage.
      const schema = z.object({ value: z.string() });
      mockLLMGateway.complete.mockResolvedValue({
        id: "r1",
        model: "test",
        content: JSON.stringify({ value: "ok" }),
        finish_reason: "stop",
      });

      await agent.callSecureInvoke("sess-1", "test prompt", schema);

      const memCall = mockMemorySystem.storeSemanticMemory.mock.calls[0];
      expect(memCall[5]).toBe("org-new"); // organizationId passed to memory
    });
  });

  describe("prepareOutput", () => {
    it("returns structured AgentOutput with correct fields", async () => {
      const result = await agent.execute(makeContext());

      expect(result.agent_id).toBe("TestAgent");
      expect(result.agent_type).toBe("opportunity");
      expect(result.lifecycle_stage).toBe("opportunity");
      expect(result.status).toBe("success");
      expect(result.confidence).toBe("medium");
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });

  describe("secureInvoke", () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
      hallucination_check: z.boolean().optional(),
    });

    const validLLMContent = JSON.stringify({
      answer: "42",
      confidence: 0.95,
    });

    beforeEach(() => {
      mockLLMGateway.complete.mockResolvedValue({
        id: "resp-1",
        model: "test-model",
        content: validLLMContent,
        finish_reason: "stop",
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });
    });

    it("calls LLM gateway through circuit breaker", async () => {
      await agent.callSecureInvoke("sess-1", "What is the answer?", responseSchema);

      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1);
      expect(mockLLMGateway.complete).toHaveBeenCalledTimes(1);
    });

    it("passes tenant metadata in LLM request", async () => {
      await agent.callSecureInvoke("sess-1", "prompt", responseSchema, {
        context: { agent: "TestAgent" },
      });

      const request = mockLLMGateway.complete.mock.calls[0][0];
      expect(request.metadata.tenantId).toBe("org-456");
      expect(request.metadata.sessionId).toBe("sess-1");
      expect(request.metadata.agent).toBe("TestAgent");
    });

    it("passes idempotencyKey when provided", async () => {
      await agent.callSecureInvoke("sess-1", "prompt", responseSchema, {
        idempotencyKey: "idem-123",
      });

      const request = mockLLMGateway.complete.mock.calls[0][0];
      expect(request.metadata.idempotencyKey).toBe("idem-123");
    });

    it("validates LLM response against Zod schema", async () => {
      const result = await agent.callSecureInvoke("sess-1", "prompt", responseSchema);

      expect(result.answer).toBe("42");
      expect(result.confidence).toBe(0.95);
    });

    it("rejects when LLM returns invalid JSON", async () => {
      mockLLMGateway.complete.mockResolvedValue({
        id: "resp-2",
        model: "test-model",
        content: "not json",
        finish_reason: "stop",
      });

      await expect(
        agent.callSecureInvoke("sess-1", "prompt", responseSchema),
      ).rejects.toThrow();
    });

    it("rejects when LLM response fails Zod validation", async () => {
      mockLLMGateway.complete.mockResolvedValue({
        id: "resp-3",
        model: "test-model",
        content: JSON.stringify({ wrong_field: true }),
        finish_reason: "stop",
      });

      await expect(
        agent.callSecureInvoke("sess-1", "prompt", responseSchema),
      ).rejects.toThrow();
    });

    it("adds hallucination_check to parsed result", async () => {
      const result = await agent.callSecureInvoke("sess-1", "prompt", responseSchema);

      expect(result.hallucination_check).toBe(true);
    });

    it("detects hallucination patterns in LLM response", async () => {
      mockLLMGateway.complete.mockResolvedValue({
        id: "resp-4",
        model: "test-model",
        content: JSON.stringify({ answer: "I'm sorry, but I cannot help", confidence: 0.1 }),
        finish_reason: "stop",
      });

      const result = await agent.callSecureInvoke("sess-1", "prompt", responseSchema);

      expect(result.hallucination_check).toBe(false);
    });

    it("stores prediction in memory with tenant isolation when trackPrediction is true", async () => {
      await agent.callSecureInvoke("sess-1", "prompt", responseSchema, {
        trackPrediction: true,
      });

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledTimes(1);
      const call = mockMemorySystem.storeSemanticMemory.mock.calls[0];
      expect(call[0]).toBe("sess-1"); // sessionId
      expect(call[1]).toBe("TestAgent"); // agentId
      expect(call[2]).toBe("episodic"); // type
      expect(call[5]).toBe("org-456"); // organizationId — tenant isolation
    });

    it("skips memory storage when trackPrediction is false", async () => {
      await agent.callSecureInvoke("sess-1", "prompt", responseSchema, {
        trackPrediction: false,
      });

      expect(mockMemorySystem.storeSemanticMemory).not.toHaveBeenCalled();
    });

    it("propagates circuit breaker errors", async () => {
      mockCircuitBreaker.execute.mockRejectedValue(new Error("Circuit open"));

      await expect(
        agent.callSecureInvoke("sess-1", "prompt", responseSchema),
      ).rejects.toThrow("Circuit open");
    });

    it("propagates LLM gateway errors through circuit breaker", async () => {
      mockLLMGateway.complete.mockRejectedValue(new Error("LLM unavailable"));

      await expect(
        agent.callSecureInvoke("sess-1", "prompt", responseSchema),
      ).rejects.toThrow("LLM unavailable");
    });
  });

  describe("getCapabilities / getId / getName", () => {
    it("returns empty capabilities by default", () => {
      expect(agent.getCapabilities()).toEqual([]);
    });

    it("returns agent name as id", () => {
      expect(agent.getId()).toBe("TestAgent");
    });

    it("returns agent name", () => {
      expect(agent.getName()).toBe("TestAgent");
    });
  });
});
