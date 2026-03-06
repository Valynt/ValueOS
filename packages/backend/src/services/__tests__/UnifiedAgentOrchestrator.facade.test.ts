import { describe, expect, it, vi } from "vitest";

import { UnifiedAgentOrchestrator } from "../UnifiedAgentOrchestrator";

describe("UnifiedAgentOrchestrator facade delegation", () => {
  it("delegates rendering, simulation, and execution store methods", async () => {
    const orchestrator = new UnifiedAgentOrchestrator();
    const renderSpy = vi.fn().mockResolvedValue({ type: "sdui-page", payload: null });
    const renderAndDisplaySpy = vi.fn().mockResolvedValue({ response: { type: "sdui-page", payload: null }, rendered: {} });
    const statusSpy = vi.fn().mockResolvedValue({ id: "exec-1", organization_id: "org-1", status: "running", current_stage: null });
    const logsSpy = vi.fn().mockResolvedValue([]);
    const simulationSpy = vi.fn().mockResolvedValue({ simulation_id: "sim-1" });

    (orchestrator as unknown as { workflowRenderService: { generateSDUIPage: typeof renderSpy; generateAndRenderPage: typeof renderAndDisplaySpy } }).workflowRenderService = {
      generateSDUIPage: renderSpy,
      generateAndRenderPage: renderAndDisplaySpy,
    } as never;

    (orchestrator as unknown as { executionStore: { getExecutionStatus: typeof statusSpy; getExecutionLogs: typeof logsSpy } }).executionStore = {
      getExecutionStatus: statusSpy,
      getExecutionLogs: logsSpy,
      persistExecutionRecord: vi.fn(),
      updateExecutionStatus: vi.fn(),
      recordStageRun: vi.fn(),
      recordWorkflowEvent: vi.fn(),
    } as never;

    (orchestrator as unknown as { workflowSimulationService: { simulateWorkflow: typeof simulationSpy } }).workflowSimulationService = {
      simulateWorkflow: simulationSpy,
      predictStageOutcome: vi.fn(),
    } as never;

    const envelope = {
      intent: "test",
      actor: { id: "u1" },
      organizationId: "org-1",
      entryPoint: "test",
      reason: "test",
      timestamps: { requestedAt: new Date().toISOString() },
    };

    await orchestrator.generateSDUIPage(envelope, "opportunity", "hello");
    await orchestrator.generateAndRenderPage(envelope, "opportunity", "hello");
    await orchestrator.getExecutionStatus("exec-1", "org-1");
    await orchestrator.getExecutionLogs("exec-1", "org-1");
    await orchestrator.simulateWorkflow("wf-1", { organizationId: "org-1" });

    expect(renderSpy).toHaveBeenCalled();
    expect(renderAndDisplaySpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith("exec-1", "org-1");
    expect(logsSpy).toHaveBeenCalledWith("exec-1", "org-1");
    expect(simulationSpy).toHaveBeenCalledWith("wf-1", { organizationId: "org-1" }, undefined);
  });
});
