/**
 * Tests that secureInvoke resolves the real userId from context
 * and falls back to "system" with a warn log when absent (F-004).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({ result: "ok", hallucination_check: true }),
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
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

import { z } from "zod";

import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { logger } from "../../logger.js";
import { BaseAgent } from "../agents/BaseAgent.js";
import { AuditLogger } from "../AuditLogger.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";

const schema = z.object({ result: z.string(), hallucination_check: z.boolean().optional() });

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "discovery";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(_ctx: LifecycleContext): Promise<AgentOutput> {
    // prepareOutput is @deprecated but acceptable in test stubs.
    return this.prepareOutput({}, "success");
  }

  // Expose secureInvoke for testing — context variant
  async invokeSecure(sessionId: string, prompt: string, context: Record<string, unknown>) {
    return this.secureInvoke(sessionId, prompt, schema, { context });
  }

  // Expose secureInvoke for testing — options.userId variant
  async invokeSecureWithUserId(
    sessionId: string,
    prompt: string,
    userId: string,
    context: Record<string, unknown>,
  ) {
    return this.secureInvoke(sessionId, prompt, schema, { userId, context });
  }
}

/** Canonical AgentConfig shape matching AgentFactory.test.ts fixtures. */
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
  return new TestAgent(makeConfig(), "org-test", mem, llm, cb);
}

describe("BaseAgent.secureInvoke userId resolution (F-004)", () => {
  let agent: TestAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = makeAgent();
  });

  it("uses userId from context.userId when present", async () => {
    await agent.invokeSecure("sess-1", "test prompt", { userId: "user-real-123" });

    const auditLogger = (agent as unknown as { auditLogger: AuditLogger }).auditLogger;
    expect(auditLogger.logLLMInvocation).toHaveBeenCalledOnce();
    const call = vi.mocked(auditLogger.logLLMInvocation).mock.calls[0][0];
    expect(call.userId).toBe("user-real-123");
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("no userId in context"),
      expect.anything(),
    );
  });

  it("uses userId from context.user_id when context.userId absent", async () => {
    await agent.invokeSecure("sess-2", "test prompt", { user_id: "user-snake-456" });

    const auditLogger = (agent as unknown as { auditLogger: AuditLogger }).auditLogger;
    const call = vi.mocked(auditLogger.logLLMInvocation).mock.calls[0][0];
    expect(call.userId).toBe("user-snake-456");
  });

  it("falls back to 'system' and emits warn when no userId in context", async () => {
    await agent.invokeSecure("sess-3", "test prompt", {});

    const auditLogger = (agent as unknown as { auditLogger: AuditLogger }).auditLogger;
    const call = vi.mocked(auditLogger.logLLMInvocation).mock.calls[0][0];
    expect(call.userId).toBe("system");
    expect(logger.warn).toHaveBeenCalledWith(
      "secureInvoke: no userId in context, falling back to 'system'",
      expect.objectContaining({ agent: "TestAgent", session_id: "sess-3" }),
    );
  });

  it("options.userId takes precedence over context.userId", async () => {
    await agent.invokeSecureWithUserId(
      "sess-4",
      "test prompt",
      "options-user-999",
      { userId: "context-user-111" },
    );

    const auditLogger = (agent as unknown as { auditLogger: AuditLogger }).auditLogger;
    const call = vi.mocked(auditLogger.logLLMInvocation).mock.calls[0][0];
    expect(call.userId).toBe("options-user-999");
  });

  it("warn log fires exactly once when no userId is present", async () => {
    await agent.invokeSecure("sess-5", "test prompt", {});

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "secureInvoke: no userId in context, falling back to 'system'",
      expect.objectContaining({ agent: "TestAgent", session_id: "sess-5" }),
    );
  });
});
