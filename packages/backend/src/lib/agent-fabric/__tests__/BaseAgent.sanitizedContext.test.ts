/**
 * Tests that secureInvoke passes sanitizedContext (not raw context) to
 * LLMGateway.complete, so PII/secret fields are redacted before reaching
 * LLM request metadata (P0-3).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({ result: "ok", hallucination_check: true }),
      model: "test-model",
      finish_reason: "stop",
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  },
}));

vi.mock("../MemorySystem.js", () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue("mem_2");
  },
}));

vi.mock("../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../AuditLogger.js", () => ({
  AuditLogger: class {
    logLLMInvocation = vi.fn().mockResolvedValue(undefined);
    logMemoryStore = vi.fn().mockResolvedValue(undefined);
    logVetoDecision = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../KnowledgeFabricValidator.js", () => ({
  KnowledgeFabricValidator: class {},
}));

vi.mock("../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: {
    isKilled: vi.fn().mockResolvedValue(false),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { z } from "zod";

import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { BaseAgent } from "../agents/BaseAgent.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";

// ---------------------------------------------------------------------------
// Test agent
// ---------------------------------------------------------------------------

const schema = z.object({ result: z.string(), hallucination_check: z.boolean().optional() });

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "discovery";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(_ctx: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({}, "success");
  }

  async invokeSecure(sessionId: string, prompt: string, context: Record<string, unknown>) {
    return this.secureInvoke(sessionId, prompt, schema, { context });
  }
}

// ---------------------------------------------------------------------------
// Canonical AgentConfig fixture (matches AgentFactory.test.ts shape)
// ---------------------------------------------------------------------------

function makeConfig(): AgentConfig {
  return {
    id: "test-agent",
    name: "TestAgent",
    type: "opportunity" as never,
    lifecycle_stage: "discovery",
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

function makeAgent() {
  const llm = new LLMGateway("custom");
  const mem = new MemorySystem({} as never);
  const cb = new CircuitBreaker();
  return {
    agent: new TestAgent(makeConfig(), "org-test", mem, llm, cb),
    llm,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseAgent.secureInvoke — sanitized context in LLM metadata (P0-3)", () => {
  let agent: TestAgent;
  let mockLLM: InstanceType<typeof LLMGateway> & { complete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    const built = makeAgent();
    agent = built.agent;
    mockLLM = built.llm as typeof mockLLM;
  });

  it("redacts known PII fields before they reach LLM metadata", async () => {
    await agent.invokeSecure("sess-pii", "prompt", {
      email: "user@example.com",
      custom_field: "safe-value",
    });

    expect(mockLLM.complete).toHaveBeenCalledOnce();
    const [request] = mockLLM.complete.mock.calls[0] as [{ metadata: Record<string, unknown> }][];
    expect(request.metadata.email).toBe("[REDACTED]");
  });

  it("passes non-PII fields through to LLM metadata unchanged", async () => {
    await agent.invokeSecure("sess-passthrough", "prompt", {
      trace_id: "abc-123",
      custom_label: "my-label",
    });

    expect(mockLLM.complete).toHaveBeenCalledOnce();
    const [request] = mockLLM.complete.mock.calls[0] as [{ metadata: Record<string, unknown> }][];
    expect(request.metadata.trace_id).toBe("abc-123");
    expect(request.metadata.custom_label).toBe("my-label");
  });

  it("redacts known secret fields before they reach LLM metadata", async () => {
    await agent.invokeSecure("sess-secret", "prompt", {
      token: "super-secret-token",
      api_key: "sk-12345",
    });

    expect(mockLLM.complete).toHaveBeenCalledOnce();
    const [request] = mockLLM.complete.mock.calls[0] as [{ metadata: Record<string, unknown> }][];
    expect(request.metadata.token).toBe("[REDACTED]");
    expect(request.metadata.api_key).toBe("[REDACTED]");
  });

  it("explicit named fields (tenantId, sessionId, userId) are not overridden by context", async () => {
    // Even if context contains a 'tenantId' key, the factory-injected value wins
    // because named fields are placed after the sanitizedContext spread.
    await agent.invokeSecure("sess-override", "prompt", {
      tenantId: "attacker-org",
      sessionId: "attacker-session",
    });

    expect(mockLLM.complete).toHaveBeenCalledOnce();
    const [request] = mockLLM.complete.mock.calls[0] as [{ metadata: Record<string, unknown> }][];
    // The agent was constructed with "org-test" — that must win.
    expect(request.metadata.tenantId).toBe("org-test");
    expect(request.metadata.sessionId).toBe("sess-override");
  });
});
