import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must be before imports) ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    constructor(_provider?: string) {}
    complete = vi.fn();
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    constructor(_config?: unknown) {}
    store = vi.fn();
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn();
    clear = vi.fn();
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

// AgentIdentity mock — controls which tools are allowed
vi.mock("../../../auth/AgentIdentity.js", () => ({
  createAgentIdentity: vi.fn((_id: string, agentType: string, orgId: string) => ({
    agent_id: _id,
    agent_type: agentType,
    organization_id: orgId,
    permissions: ["tool:allowed_tool"],
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })),
  canUseTool: vi.fn((identity: { permissions: string[] }, toolName: string) =>
    identity.permissions.includes(`tool:${toolName}`),
  ),
  PermissionDeniedError: class PermissionDeniedError extends Error {
    constructor(agentType: string, tool: string) {
      super(`Agent '${agentType}' is not permitted to use tool '${tool}'`);
      this.name = "PermissionDeniedError";
    }
  },
}));

// ToolRegistry mock
vi.mock("../../../../services/tools/ToolRegistry.js", () => ({
  toolRegistry: {
    execute: vi.fn().mockResolvedValue({ success: true, data: "tool-result" }),
  },
}));

// --- Imports ---

import { toolRegistry } from "../../../../services/tools/ToolRegistry.js";
import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../../types/agent";
import { PermissionDeniedError } from "../../../auth/AgentIdentity.js";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { BaseAgent } from "../BaseAgent";

// --- Concrete subclass ---

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "opportunity";
  public readonly version = "1.0.0";
  public readonly name = "TestAgent";

  async execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({}, "success");
  }

  // Expose invokeTool for testing
  async callTool(toolName: string, params: Record<string, unknown>) {
    return this.invokeTool(toolName, params);
  }
}

function makeAgent() {
  const config: AgentConfig = {
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
  };
  return new TestAgent(
    config,
    "org-123",
    new MemorySystem({} as never),
    new LLMGateway("custom"),
    new CircuitBreaker(),
  );
}

// --- Tests ---

describe("BaseAgent.invokeTool permission enforcement (F-013)", () => {
  let agent: TestAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = makeAgent();
  });

  it("delegates to toolRegistry when tool is permitted", async () => {
    const result = await agent.callTool("allowed_tool", { input: "x" });
    expect(result.success).toBe(true);
    expect(vi.mocked(toolRegistry.execute)).toHaveBeenCalledWith(
      "allowed_tool",
      { input: "x" },
      expect.objectContaining({ agentType: "TestAgent", tenantId: "org-123" }),
    );
  });

  it("throws PermissionDeniedError when tool is not in policy", async () => {
    await expect(agent.callTool("forbidden_tool", {})).rejects.toThrow(
      PermissionDeniedError,
    );
    await expect(agent.callTool("forbidden_tool", {})).rejects.toThrow(
      "not permitted to use tool 'forbidden_tool'",
    );
  });

  it("does not call toolRegistry when permission is denied", async () => {
    await expect(agent.callTool("forbidden_tool", {})).rejects.toThrow();
    expect(vi.mocked(toolRegistry.execute)).not.toHaveBeenCalled();
  });

  it("passes tenantId from organizationId to toolRegistry context", async () => {
    await agent.callTool("allowed_tool", {});
    expect(vi.mocked(toolRegistry.execute)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tenantId: "org-123" }),
    );
  });

  it("re-creates identity when cached identity has expired", async () => {
    const { createAgentIdentity } = await import("../../../auth/AgentIdentity.js");
    const mockCreate = vi.mocked(createAgentIdentity);

    // First call returns an already-expired identity
    mockCreate.mockReturnValueOnce({
      agent_id: "TestAgent",
      agent_type: "TestAgent",
      organization_id: "org-123",
      permissions: ["tool:allowed_tool"],
      issued_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 1).toISOString(), // expired
    });
    // Second call returns a fresh identity
    mockCreate.mockReturnValueOnce({
      agent_id: "TestAgent",
      agent_type: "TestAgent",
      organization_id: "org-123",
      permissions: ["tool:allowed_tool"],
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    // First invokeTool uses the expired identity (still has permissions, so succeeds)
    // and should trigger a refresh for the next call
    await agent.callTool("allowed_tool", {});
    // Second invokeTool should have triggered a second createAgentIdentity call
    await agent.callTool("allowed_tool", {});

    // createAgentIdentity should have been called at least twice (initial + refresh)
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
