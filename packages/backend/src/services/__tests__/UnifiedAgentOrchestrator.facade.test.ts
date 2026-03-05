import { describe, expect, it, vi } from "vitest";

import { UnifiedAgentOrchestrator } from "../UnifiedAgentOrchestrator";

describe("UnifiedAgentOrchestrator facade delegation", () => {
  it("delegates render and execution store methods", async () => {
    const orchestrator = new UnifiedAgentOrchestrator();
    const renderSpy = vi.fn().mockResolvedValue({ type: "sdui-page", payload: null });
    const statusSpy = vi.fn().mockResolvedValue({ id: "exec-1", organization_id: "org-1", status: "running", current_stage: null });

    (orchestrator as unknown as { workflowRenderService: { generateSDUIPage: typeof renderSpy } }).workflowRenderService = {
      generateSDUIPage: renderSpy,
      generateAndRenderPage: vi.fn(),
    } as never;

    (orchestrator as unknown as { executionStore: { getExecutionStatus: typeof statusSpy; getExecutionLogs: ReturnType<typeof vi.fn> } }).executionStore = {
      getExecutionStatus: statusSpy,
      getExecutionLogs: vi.fn().mockResolvedValue([]),
      persistExecutionRecord: vi.fn(),
      updateExecutionStatus: vi.fn(),
      recordStageRun: vi.fn(),
      recordWorkflowEvent: vi.fn(),
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
    await orchestrator.getExecutionStatus("exec-1", "org-1");

    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith("exec-1", "org-1");
  });
});
