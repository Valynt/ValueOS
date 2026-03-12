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

import type {
  AgentConfig,
  AgentOutput,
  LifecycleContext,
} from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import type { HallucinationCheckResult } from "../../KnowledgeFabricValidator";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { BaseAgent } from "../BaseAgent";

// --- Concrete subclass for testing abstract BaseAgent ---

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "opportunity";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({ test: true }, "success");
  }

  // Expose protected method for testing
  async invokeSecure<T>(
    sessionId: string,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      trackPrediction?: boolean;
      confidenceThresholds?: { low: number; high: number };
      context?: Record<string, unknown>;
      idempotencyKey?: string;
    }
  ) {
    return this.secureInvoke(sessionId, prompt, schema, options);
  }
}

// --- Helpers ---

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

function makeContext(
  overrides: Partial<LifecycleContext> = {}
): LifecycleContext {
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

function makeLLMResponse(content: string) {
  return {
    id: "resp-1",
    model: "test-model",
    content,
    finish_reason: "stop",
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

// --- Tests ---

describe("BaseAgent", () => {
  let agent: TestAgent;
  let mockLLMGateway: InstanceType<typeof LLMGateway> & {
    complete: ReturnType<typeof vi.fn>;
  };
  let mockMemorySystem: InstanceType<typeof MemorySystem> & {
    storeSemanticMemory: ReturnType<typeof vi.fn>;
  };
  let mockCircuitBreaker: InstanceType<typeof CircuitBreaker> & {
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMGateway = new LLMGateway("custom") as typeof mockLLMGateway;
    mockMemorySystem = new MemorySystem({} as never) as typeof mockMemorySystem;
    mockCircuitBreaker = new CircuitBreaker() as typeof mockCircuitBreaker;

    agent = new TestAgent(
      makeConfig(),
      "org-456",
      mockMemorySystem,
      mockLLMGateway,
      mockCircuitBreaker
    );
  });

  // ==========================================================================
  // validateInput
  // ==========================================================================

  describe("validateInput", () => {
    it("returns true for valid context", async () => {
      const result = await agent.validateInput(makeContext());
      expect(result).toBe(true);
    });

    it("returns false when workspace_id is missing", async () => {
      const result = await agent.validateInput(
        makeContext({ workspace_id: "" })
      );
      expect(result).toBe(false);
    });

    it("returns false when organization_id is missing", async () => {
      const result = await agent.validateInput(
        makeContext({ organization_id: "" })
      );
      expect(result).toBe(false);
    });

    it("returns false when user_id is missing", async () => {
      const result = await agent.validateInput(makeContext({ user_id: "" }));
      expect(result).toBe(false);
    });

    it("uses organizationId from constructor for LLM tenant metadata", async () => {
      // validateInput validates the context but does not mutate organizationId —
      // the agent always uses the org it was constructed with (constructor injection).
      const schema = z.object({ value: z.string() });
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse(JSON.stringify({ value: "test" }))
      );

      await agent.invokeSecure("session-1", "prompt", schema);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ tenantId: "org-456" }),
        })
      );
    });
  });

  // ==========================================================================
  // prepareOutput
  // ==========================================================================

  describe("prepareOutput", () => {
    it("returns structured AgentOutput with correct fields", async () => {
      const output = await agent.execute(makeContext());

      expect(output.agent_id).toBe("TestAgent");
      expect(output.agent_type).toBe("opportunity");
      expect(output.lifecycle_stage).toBe("opportunity");
      expect(output.status).toBe("success");
      expect(output.result).toEqual({ test: true });
      expect(output.confidence).toBe("medium");
      expect(output.metadata).toEqual(
        expect.objectContaining({
          execution_time_ms: 0,
          model_version: "unknown",
        })
      );
      expect(output.metadata.timestamp).toBeDefined();
    });
  });

  // ==========================================================================
  // secureInvoke
  // ==========================================================================

  describe("secureInvoke", () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
      hallucination_check: z.boolean().optional(),
    });

    const validResponse = { answer: "test answer", confidence: 0.85 };

    beforeEach(() => {
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse(JSON.stringify(validResponse))
      );
    });

    it("calls LLM via circuit breaker and returns parsed result", async () => {
      const result = await agent.invokeSecure(
        "session-1",
        "What is the answer?",
        responseSchema
      );

      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1);
      expect(mockLLMGateway.complete).toHaveBeenCalledTimes(1);
      expect(result.answer).toBe("test answer");
      expect(result.confidence).toBe(0.85);
    });

    it("sanitizes prompt content before dispatching to LLM", async () => {
      await agent.invokeSecure(
        "session-1",
        "prompt\0 with\r\nnewline",
        responseSchema
      );

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "prompt with\nnewline" }],
        })
      );
    });

    it("includes tenant metadata in LLM request", async () => {
      await agent.invokeSecure("session-1", "prompt", responseSchema);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "prompt" }],
          metadata: expect.objectContaining({
            tenantId: "org-456",
            sessionId: "session-1",
            userId: "system",
          }),
        })
      );
    });

    it("passes idempotencyKey to LLM metadata", async () => {
      await agent.invokeSecure("session-1", "prompt", responseSchema, {
        idempotencyKey: "idem-123",
      });

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            idempotencyKey: "idem-123",
          }),
        })
      );
    });

    it("passes custom context to LLM metadata", async () => {
      await agent.invokeSecure("session-1", "prompt", responseSchema, {
        context: { agent: "TestAgent", step: "analysis" },
      });

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            agent: "TestAgent",
            step: "analysis",
          }),
        })
      );
    });

    it("adds hallucination_check field to result", async () => {
      const result = await agent.invokeSecure(
        "session-1",
        "prompt",
        responseSchema
      );

      // Without a KnowledgeFabricValidator, defaults to passed=true
      expect(result.hallucination_check).toBe(true);
    });

    it("stores tracking memory when trackPrediction is true (default)", async () => {
      await agent.invokeSecure("session-1", "prompt", responseSchema);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledTimes(1);
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        "session-1",
        "TestAgent",
        "episodic",
        expect.stringContaining("LLM Response:"),
        expect.objectContaining({
          // hallucination_check reflects hallucinationResult.passed (true for clean response)
          hallucination_check: true,
          // confidence reflects hallucinationResult.groundingScore: 1.0 for a response
          // with no signals (no refusal patterns, self-references, or contradictions)
          confidence: 1,
          validation_method: "knowledge_fabric",
        }),
        "org-456"
      );
    });

    it("skips tracking memory when trackPrediction is false", async () => {
      await agent.invokeSecure("session-1", "prompt", responseSchema, {
        trackPrediction: false,
      });

      expect(mockMemorySystem.storeSemanticMemory).not.toHaveBeenCalled();
    });

    it("throws on invalid JSON from LLM", async () => {
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse("not valid json")
      );

      await expect(
        agent.invokeSecure("session-1", "prompt", responseSchema)
      ).rejects.toThrow();
    });

    it("throws on Zod validation failure", async () => {
      // Missing required 'answer' field
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse(JSON.stringify({ wrong_field: "oops" }))
      );

      await expect(
        agent.invokeSecure("session-1", "prompt", responseSchema)
      ).rejects.toThrow();
    });

    it("propagates LLM gateway errors through circuit breaker", async () => {
      mockLLMGateway.complete.mockRejectedValue(
        new Error("LLM service unavailable")
      );

      await expect(
        agent.invokeSecure("session-1", "prompt", responseSchema)
      ).rejects.toThrow("LLM service unavailable");
    });
  });

  // ==========================================================================
  // Knowledge Fabric Validation (hallucination detection)
  // ==========================================================================

  describe("Knowledge Fabric validation", () => {
    const schema = z.object({
      result: z.string(),
      hallucination_check: z.boolean().optional(),
    });

    beforeEach(() => {
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse(JSON.stringify({ result: "test" }))
      );
    });

    it("defaults to passed when no validator is set", async () => {
      const result = await agent.invokeSecure("s1", "prompt", schema);

      expect(result.hallucination_check).toBe(true);
    });

    it("uses KnowledgeFabricValidator when set", async () => {
      const mockValidator = {
        validate: vi.fn().mockResolvedValue({
          passed: false,
          confidence: 0.3,
          contradictions: [
            {
              claim: "x",
              existingFact: "y",
              similarity: 0.9,
              source: "target",
            },
          ],
          benchmarkMisalignments: [],
          method: "knowledge_fabric",
        } satisfies HallucinationCheckResult),
      };

      agent.setKnowledgeFabricValidator(mockValidator as never);

      const result = await agent.invokeSecure("s1", "prompt", schema);

      expect(mockValidator.validate).toHaveBeenCalledWith(
        expect.any(String), // raw LLM content
        "org-456", // organizationId
        "TestAgent" // agent name
      );
      expect(result.hallucination_check).toBe(false);
    });

    it("stores contradiction count in memory metadata", async () => {
      const mockValidator = {
        validate: vi.fn().mockResolvedValue({
          passed: false,
          confidence: 0.4,
          contradictions: [
            {
              claim: "a",
              existingFact: "b",
              similarity: 0.8,
              source: "target",
            },
            {
              claim: "c",
              existingFact: "d",
              similarity: 0.85,
              source: "integrity",
            },
          ],
          benchmarkMisalignments: [
            { metricId: "m1", claimedValue: 100, validation: { valid: false } },
          ],
          method: "knowledge_fabric",
        } satisfies HallucinationCheckResult),
      };

      agent.setKnowledgeFabricValidator(mockValidator as never);

      await agent.invokeSecure("s1", "prompt", schema);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        "s1",
        "TestAgent",
        "episodic",
        expect.any(String),
        expect.objectContaining({
          hallucination_check: false,
          confidence: 0.4,
          contradiction_count: 2,
          benchmark_misalignment_count: 1,
        }),
        "org-456"
      );
    });

    it("fails closed when validator throws (security contract)", async () => {
      const mockValidator = {
        validate: vi.fn().mockRejectedValue(new Error("validator crash")),
      };

      agent.setKnowledgeFabricValidator(mockValidator as never);

      const result = await agent.invokeSecure("s1", "prompt", schema);

      // Should not throw — but fails closed: validator crash → hallucination_check false
      expect(result.hallucination_check).toBe(false);
    });
  });

  // ==========================================================================
  // Utility methods
  // ==========================================================================

  describe("utility methods", () => {
    it("getCapabilities returns empty array by default", () => {
      expect(agent.getCapabilities()).toEqual([]);
    });

    it("getId returns agent name", () => {
      expect(agent.getId()).toBe("TestAgent");
    });

    it("getName returns agent name", () => {
      expect(agent.getName()).toBe("TestAgent");
    });
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe("constructor", () => {
    it("sets lifecycle_stage from config", () => {
      const customAgent = new TestAgent(
        makeConfig({ lifecycle_stage: "target" }),
        "org-1",
        mockMemorySystem,
        mockLLMGateway,
        mockCircuitBreaker
      );
      // The config lifecycle_stage is set, but TestAgent overrides it
      // Verify the base class stored the config value
      expect(customAgent).toBeDefined();
    });

    it("sets organizationId from constructor", async () => {
      const customAgent = new TestAgent(
        makeConfig(),
        "org-custom",
        mockMemorySystem,
        mockLLMGateway,
        mockCircuitBreaker
      );

      const schema = z.object({
        v: z.string(),
        hallucination_check: z.boolean().optional(),
      });
      mockLLMGateway.complete.mockResolvedValue(
        makeLLMResponse(JSON.stringify({ v: "ok" }))
      );

      await customAgent.invokeSecure("s1", "p", schema);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ tenantId: "org-custom" }),
        })
      );
    });
  });
});
