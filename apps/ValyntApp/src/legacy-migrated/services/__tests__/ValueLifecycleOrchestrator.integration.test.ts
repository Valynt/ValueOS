import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { ValueLifecycleOrchestrator } from "../src/services/ValueLifecycleOrchestrator";
import { createClient } from "@supabase/supabase-js";
import { LLMGateway } from "../src/lib/agent-fabric/LLMGateway";
import { MemorySystem } from "../src/lib/agent-fabric/MemorySystem";
import { AuditLogger } from "../src/lib/agent-fabric/AuditLogger";
import { agentTelemetryService } from "../src/services/agents/telemetry/AgentTelemetryService";

// Mock external dependencies
vi.mock("@supabase/supabase-js");
vi.mock("../src/lib/agent-fabric/LLMGateway");
vi.mock("../src/lib/agent-fabric/MemorySystem");
vi.mock("../src/lib/agent-fabric/AuditLogger");

describe("ValueLifecycleOrchestrator Integration Tests", () => {
  let orchestrator: ValueLifecycleOrchestrator;
  let mockSupabase: any;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;

  beforeAll(() => {
    // Setup mocks
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: "test-id" }, error: null })),
          })),
        })),
      })),
    };

    mockLLMGateway = {
      healthCheck: vi.fn(() => Promise.resolve(true)),
    };

    mockMemorySystem = {
      healthCheck: vi.fn(() => Promise.resolve(true)),
    };

    mockAuditLogger = {
      healthCheck: vi.fn(() => Promise.resolve(true)),
    };

    (createClient as any).mockReturnValue(mockSupabase);
    (LLMGateway as any).mockImplementation(() => mockLLMGateway);
    (MemorySystem as any).mockImplementation(() => mockMemorySystem);
    (AuditLogger as any).mockImplementation(() => mockAuditLogger);

    orchestrator = new ValueLifecycleOrchestrator(
      mockSupabase,
      mockLLMGateway,
      mockMemorySystem,
      mockAuditLogger
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Lifecycle Execution", () => {
    it("should execute full opportunity to realization lifecycle", async () => {
      const context = {
        userId: "test-user",
        organizationId: "test-org",
        sessionId: "test-session",
      };

      // Mock agent responses for each stage
      const mockAgentExecute = vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: { opportunityId: "opp-1", description: "Test opportunity" },
          confidence: "high",
        })
        .mockResolvedValueOnce({
          success: true,
          data: { targetId: "target-1", goals: ["goal1"], metrics: ["metric1"] },
          confidence: "high",
        })
        .mockResolvedValueOnce({
          success: true,
          data: { expansionId: "exp-1", valueTree: {}, strategies: [] },
          confidence: "high",
        })
        .mockResolvedValueOnce({
          success: true,
          data: { integrityId: "int-1", validations: [], risks: [] },
          confidence: "high",
        })
        .mockResolvedValueOnce({
          success: true,
          data: { realizationId: "real-1", commitments: [], outcomes: [] },
          confidence: "high",
        });

      // Mock agent constructor
      const MockAgentClass = vi.fn().mockImplementation(() => ({
        execute: mockAgentExecute,
      }));

      // Override the agent creation
      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      // Execute opportunity stage
      const opportunityResult = await orchestrator.executeLifecycleStage(
        "opportunity",
        {},
        context
      );

      expect(opportunityResult.success).toBe(true);
      expect(opportunityResult.data.opportunityId).toBe("opp-1");

      // Execute target stage
      const targetResult = await orchestrator.executeLifecycleStage(
        "target",
        { opportunity_result_id: "opp-1" },
        context
      );

      expect(targetResult.success).toBe(true);
      expect(targetResult.data.targetId).toBe("target-1");

      // Execute expansion stage
      const expansionResult = await orchestrator.executeLifecycleStage(
        "expansion",
        { value_tree_id: "tree-1" },
        context
      );

      expect(expansionResult.success).toBe(true);
      expect(expansionResult.data.expansionId).toBe("exp-1");

      // Execute integrity stage
      const integrityResult = await orchestrator.executeLifecycleStage(
        "integrity",
        { roi_model_id: "roi-1" },
        context
      );

      expect(integrityResult.success).toBe(true);
      expect(integrityResult.data.integrityId).toBe("int-1");

      // Execute realization stage
      const realizationResult = await orchestrator.executeLifecycleStage(
        "realization",
        { value_commit_id: "commit-1" },
        context
      );

      expect(realizationResult.success).toBe(true);
      expect(realizationResult.data.realizationId).toBe("real-1");
    }, 30000); // Extended timeout for full lifecycle

    it("should handle agent execution failures with compensation", async () => {
      const context = {
        userId: "test-user",
        organizationId: "test-org",
        sessionId: "test-session-fail",
      };

      // Mock agent that fails
      const mockAgentExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: "Agent execution failed",
        data: null,
      });

      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      // Execute stage that should fail
      await expect(
        orchestrator.executeLifecycleStage("opportunity", {}, context)
      ).rejects.toThrow();

      // Verify telemetry was recorded
      const traces = agentTelemetryService.getCompletedTraces();
      expect(traces.length).toBeGreaterThan(0);
      expect(traces[0].status).toBe("failed");
    });

    it("should enforce prerequisite validation", async () => {
      const context = {
        userId: "test-user",
        organizationId: "test-org",
        sessionId: "test-session-prereq",
      };

      // Try to execute expansion without value_tree_id
      await expect(
        orchestrator.executeLifecycleStage(
          "expansion",
          {}, // Missing value_tree_id
          context
        )
      ).rejects.toThrow("Missing prerequisites for expansion");
    });

    it("should handle concurrent stage executions", async () => {
      const context1 = {
        userId: "test-user-1",
        organizationId: "test-org",
        sessionId: "test-session-concurrent-1",
      };

      const context2 = {
        userId: "test-user-2",
        organizationId: "test-org",
        sessionId: "test-session-concurrent-2",
      };

      const mockAgentExecute = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunityId: "opp-concurrent", description: "Concurrent opportunity" },
        confidence: "high",
      });

      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      // Execute multiple stages concurrently
      const [result1, result2] = await Promise.all([
        orchestrator.executeLifecycleStage("opportunity", {}, context1),
        orchestrator.executeLifecycleStage("opportunity", {}, context2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.stageExecutionId).not.toBe(result2.stageExecutionId);
    });

    it("should integrate with telemetry service", async () => {
      const context = {
        userId: "test-user-telemetry",
        organizationId: "test-org",
        sessionId: "test-session-telemetry",
      };

      const mockAgentExecute = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunityId: "opp-telemetry", description: "Telemetry test" },
        confidence: "high",
      });

      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      await orchestrator.executeLifecycleStage("opportunity", {}, context);

      // Verify telemetry was recorded
      const traces = agentTelemetryService.getCompletedTraces();
      const recentTrace = traces.find((t) => t.sessionId === context.sessionId);

      expect(recentTrace).toBeDefined();
      expect(recentTrace!.agentType).toBe("opportunity");
      expect(recentTrace!.status).toBe("completed");
      expect(recentTrace!.steps.length).toBeGreaterThan(0);
    });

    it("should persist results to database", async () => {
      const context = {
        userId: "test-user-persist",
        organizationId: "test-org",
        sessionId: "test-session-persist",
      };

      const mockAgentExecute = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunityId: "opp-persist", description: "Persistence test" },
        confidence: "high",
      });

      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      await orchestrator.executeLifecycleStage("opportunity", {}, context);

      // Verify database was called
      expect(mockSupabase.from).toHaveBeenCalledWith("opportunity_results");
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should trigger circuit breaker on repeated failures", async () => {
      const context = {
        userId: "test-user-circuit",
        organizationId: "test-org",
        sessionId: "test-session-circuit",
      };

      const mockAgentExecute = vi.fn().mockRejectedValue(new Error("Agent failure"));

      (orchestrator as any).getAgentForStage = vi.fn().mockReturnValue({
        execute: mockAgentExecute,
      });

      // Trigger multiple failures to trip circuit breaker
      for (let i = 0; i < 6; i++) {
        await expect(
          orchestrator.executeLifecycleStage("opportunity", {}, context)
        ).rejects.toThrow();
      }

      // Circuit breaker should now be open
      await expect(orchestrator.executeLifecycleStage("opportunity", {}, context)).rejects.toThrow(
        "Circuit breaker is open"
      );
    });
  });

  describe("Workflow State Management", () => {
    it("should respect workflow pause state", async () => {
      const context = {
        userId: "test-user-workflow",
        organizationId: "test-org",
        sessionId: "test-session-workflow-paused",
      };

      // Mock workflow store to return paused
      const mockWorkflowStore = {
        getStatus: vi.fn().mockReturnValue("PAUSED"),
      };

      (orchestrator as any).ensureWorkflowActive = vi.fn().mockImplementation(() => {
        const status = mockWorkflowStore.getStatus(context.sessionId);
        if (status === "PAUSED") {
          throw new Error(`Workflow ${context.sessionId} is paused`);
        }
      });

      await expect(orchestrator.executeLifecycleStage("opportunity", {}, context)).rejects.toThrow(
        "Workflow test-session-workflow-paused is paused"
      );
    });
  });
});
