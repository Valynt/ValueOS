import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the global logger
vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}));

// Mock external services
vi.mock("../AgentSDUIAdapter.js", () => ({
  agentSDUIAdapter: {
    processAgentOutputWithIntents: vi.fn()
  }
}));

vi.mock("../../sdui/CanvasSchemaService.js", () => ({
  canvasSchemaService: {
    invalidateCache: vi.fn(),
    getCachedSchema: vi.fn(),
    cacheSchemaWithCAS: vi.fn()
  }
}));

vi.mock("../../sdui/ComponentMutationService.js", () => ({
  getComponentMutationService: vi.fn()
}));

import { AgentOutputListener, agentOutputListener } from "../AgentOutputListener";
import { agentSDUIAdapter } from "../AgentSDUIAdapter.js";
import { canvasSchemaService } from "../../sdui/CanvasSchemaService.js";
import { getComponentMutationService } from "../../sdui/ComponentMutationService.js";
import { AgentOutput } from "../../../types/agent-output";

describe("AgentOutputListener", () => {
  let listener: AgentOutputListener;

  beforeEach(() => {
    listener = new AgentOutputListener();
    vi.clearAllMocks();
  });

  describe("Constructor and state management", () => {
    it("should initialize enabled to true and clear map", () => {
      // @ts-expect-error accessing private property for testing
      expect(listener.enabled).toBe(true);
      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.size).toBe(0);
    });

    it("should disable and enable correctly", () => {
      listener.disable();
      // @ts-expect-error accessing private property for testing
      expect(listener.enabled).toBe(false);

      listener.enable();
      // @ts-expect-error accessing private property for testing
      expect(listener.enabled).toBe(true);
    });
  });

  describe("Callback management", () => {
    it("should register agent specific callback", () => {
      const cb = vi.fn();
      listener.onAgentOutput("agent1", cb);

      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("agent1")).toHaveLength(1);
      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("agent1")![0]).toBe(cb);
    });

    it("should register wildcard callback", () => {
      const cb = vi.fn();
      listener.onAnyAgentOutput(cb);

      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("*")).toHaveLength(1);
      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("*")![0]).toBe(cb);
    });

    it("should remove specific callback", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      listener.onAgentOutput("agent1", cb1);
      listener.onAgentOutput("agent1", cb2);

      listener.removeCallback("agent1", cb1);

      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("agent1")).toHaveLength(1);
      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.get("agent1")![0]).toBe(cb2);
    });

    it("should handle removing callback that does not exist", () => {
      const cb = vi.fn();
      listener.removeCallback("agent1", cb); // Should not throw
    });

    it("should clear all callbacks", () => {
      listener.onAgentOutput("agent1", vi.fn());
      listener.onAnyAgentOutput(vi.fn());

      listener.clearCallbacks();

      // @ts-expect-error accessing private property for testing
      expect(listener.agentListeners.size).toBe(0);
    });
  });

  describe("handleAgentOutput", () => {
    const mockOutput: AgentOutput = {
      agent_id: "agent1",
      agent_type: "test_type",
      execution_id: "exec1",
      status: "success",
      workspaceId: "workspace1",
      result: { data: {}, confidence: 1 },
      metadata: { execution_time_ms: 100, model_version: "v1", timestamp: "now", retry_count: 0 }
    };

    it("should skip processing if disabled", async () => {
      const emitSpy = vi.spyOn(listener, "emit");
      listener.disable();

      await listener.handleAgentOutput(mockOutput);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("should emit events and call callbacks on normal execution", async () => {
      const emitSpy = vi.spyOn(listener, "emit");
      const cbSpecific = vi.fn().mockResolvedValue(undefined);
      const cbWildcard = vi.fn().mockResolvedValue(undefined);

      listener.onAgentOutput("agent1", cbSpecific);
      listener.onAnyAgentOutput(cbWildcard);

      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({ type: "none" } as any);

      await listener.handleAgentOutput(mockOutput);

      expect(emitSpy).toHaveBeenCalledWith("agent:output", mockOutput);
      expect(cbSpecific).toHaveBeenCalledWith(mockOutput);
      expect(cbWildcard).toHaveBeenCalledWith(mockOutput);
      expect(emitSpy).toHaveBeenCalledWith("agent:complete", mockOutput);
    });

    it("should catch and log errors from specific callbacks but continue execution", async () => {
      const emitSpy = vi.spyOn(listener, "emit");
      const cbSpecific = vi.fn().mockRejectedValue(new Error("Callback failed"));
      const cbWildcard = vi.fn().mockResolvedValue(undefined);

      listener.onAgentOutput("agent1", cbSpecific);
      listener.onAnyAgentOutput(cbWildcard);

      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({ type: "none" } as any);

      await listener.handleAgentOutput(mockOutput);

      expect(cbWildcard).toHaveBeenCalledWith(mockOutput); // Still called
      expect(emitSpy).toHaveBeenCalledWith("agent:complete", mockOutput); // Still called
    });

    it("should emit error event if overall process throws", async () => {
      const emitSpy = vi.spyOn(listener, "emit").mockImplementationOnce(() => {
        throw new Error("Force Error");
      });

      await listener.handleAgentOutput(mockOutput);

      expect(emitSpy).toHaveBeenCalledWith("agent:error", {
        output: mockOutput,
        error: "Force Error"
      });
      expect(emitSpy).not.toHaveBeenCalledWith("agent:complete", mockOutput);
    });

    describe("SDUI processing", () => {
      it("should handle full_schema update", async () => {
        vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({ type: "full_schema" } as any);

        await listener.handleAgentOutput(mockOutput);

        expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith("workspace1");
      });

      it("should handle atomic_actions with success", async () => {
        const mockActions = [{ type: "update", path: "test" }];
        vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
          type: "atomic_actions",
          actions: mockActions
        } as any);

        const mockCurrentSchema = { type: "schema" };
        const mockNewSchema = { type: "new_schema" };

        vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(mockCurrentSchema);

        const applyActionsMock = vi.fn().mockResolvedValue({
          layout: mockNewSchema,
          results: [{ success: true }]
        });

        vi.mocked(getComponentMutationService).mockReturnValue({
          applyActions: applyActionsMock
        } as any);

        await listener.handleAgentOutput(mockOutput);

        expect(applyActionsMock).toHaveBeenCalledWith(mockCurrentSchema, mockActions);
        expect(canvasSchemaService.cacheSchemaWithCAS).toHaveBeenCalledWith("workspace1", mockNewSchema);
      });

      it("should handle atomic_actions with all failures", async () => {
        const mockActions = [{ type: "update", path: "test" }];
        vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
          type: "atomic_actions",
          actions: mockActions
        } as any);

        const mockCurrentSchema = { type: "schema" };

        vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(mockCurrentSchema);

        const applyActionsMock = vi.fn().mockResolvedValue({
          layout: mockCurrentSchema,
          results: [{ success: false }]
        });

        vi.mocked(getComponentMutationService).mockReturnValue({
          applyActions: applyActionsMock
        } as any);

        await listener.handleAgentOutput(mockOutput);

        expect(applyActionsMock).toHaveBeenCalledWith(mockCurrentSchema, mockActions);
        expect(canvasSchemaService.cacheSchemaWithCAS).not.toHaveBeenCalled();
      });

      it("should invalidate cache if no cached schema found for atomic actions", async () => {
        vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
          type: "atomic_actions",
          actions: [{ type: "update", path: "test" }]
        } as any);

        vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(null);

        await listener.handleAgentOutput(mockOutput);

        expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith("workspace1");
      });
    });
  });

  describe("Singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(agentOutputListener).toBeInstanceOf(AgentOutputListener);
    });
  });
});
